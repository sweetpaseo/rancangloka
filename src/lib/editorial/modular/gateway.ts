/**
 * RancangLoka — Modular Article Architecture V1 (MAA-V1)
 * Unified Article Mutation Gateway
 * 
 * Strict Invariants:
 * 1. Single canonical boundary for all mutations (Hermes, CMS, LokaBridge, CLI).
 * 2. Strict component ownership enforcement (rejects unauthorized actors).
 * 3. Optimistic Concurrency Control (OCC) via expectedVersion checks.
 * 4. Idempotency guarantees (duplicate keys return cached success without side effects).
 * 5. Automated dependency invalidation cascades (prior QA marked STALE on content change).
 * 6. Audit history preservation for every mutation.
 */

import { createHash } from 'node:crypto';
import type {
  ArticleComponentType,
  ActorRole,
  ValidationStatus,
  StoredArticleComponent,
  ComponentDataMap
} from './types.ts';
import { enforceComponentWritePermission } from './ownership.ts';
import { getInvalidationCascades } from './dependency-invalidation.ts';
import { assembleModularArticle, type AssemblyResult } from './assembler.ts';

export class VersionConflictError extends Error {
  readonly expectedVersion: number;
  readonly actualVersion: number;
  readonly componentType: ArticleComponentType;

  constructor(componentType: ArticleComponentType, expected: number, actual: number) {
    super(
      `VERSION_CONFLICT: Component '${componentType}' expected version ${expected}, but actual version is ${actual}. ` +
      `Mutation rejected to prevent silent overwrite.`
    );
    this.name = 'VersionConflictError';
    this.componentType = componentType;
    this.expectedVersion = expected;
    this.actualVersion = actual;
  }
}

export interface MutateComponentInput<T extends ArticleComponentType = ArticleComponentType> {
  articleId: number;
  componentType: T;
  actor: ActorRole;
  expectedVersion: number;
  data: ComponentDataMap[T];
  validationStatus?: ValidationStatus;
  reason?: string;
  idempotencyKey?: string;
}

export interface MutationResult<T extends ArticleComponentType = ArticleComponentType> {
  success: boolean;
  articleId: number;
  componentType: T;
  newVersion: number;
  contentHash: string;
  validationStatus: ValidationStatus;
  invalidatedComponents: ArticleComponentType[];
  idempotentReplay?: boolean;
}

export class ModularArticleGateway {
  private readonly db: any;

  constructor(db?: any) {
    this.db = db;
  }

  /**
   * Primary entry point for any component mutation.
   */
  async mutateComponent<T extends ArticleComponentType>(
    input: MutateComponentInput<T>
  ): Promise<MutationResult<T>> {
    const { articleId, componentType, actor, expectedVersion, data, reason, idempotencyKey } = input;

    // 1. Enforce Actor Ownership Permissions
    enforceComponentWritePermission(actor, componentType);

    // 2. Validate Component Data Exists
    if (!data || typeof data !== 'object') {
      throw new Error(`INVALID_COMPONENT_DATA: Data for component '${componentType}' must be a non-null object.`);
    }

    // 3. Idempotency Check
    if (idempotencyKey && this.db) {
      try {
        const existingTx = await this.db
          .prepare('SELECT component_version, content_hash, validation_status FROM article_component_history WHERE idempotency_key = ? LIMIT 1')
          .bind(idempotencyKey)
          .first();

        if (existingTx) {
          return {
            success: true,
            articleId,
            componentType,
            newVersion: existingTx.component_version,
            contentHash: existingTx.content_hash,
            validationStatus: existingTx.validation_status as ValidationStatus,
            invalidatedComponents: [],
            idempotentReplay: true
          };
        }
      } catch (_) {
        // Continue if table or check fails
      }
    }

    // 4. Retrieve Current Component State (or default version 0)
    let currentVersion = 0;
    let currentHash = '';
    if (this.db) {
      try {
        const row = await this.db
          .prepare('SELECT component_version, content_hash FROM article_components WHERE article_id = ? AND component_type = ? LIMIT 1')
          .bind(articleId, componentType)
          .first();

        if (row) {
          currentVersion = row.component_version;
          currentHash = row.content_hash;
        }
      } catch (_) {
        // Table may be empty
      }
    }

    // 5. Optimistic Concurrency Control (OCC) Check
    if (expectedVersion !== currentVersion) {
      throw new VersionConflictError(componentType, expectedVersion, currentVersion);
    }

    // 6. Compute Component Content Hash
    const contentJson = JSON.stringify(data);
    const newContentHash = createHash('sha256').update(contentJson, 'utf8').digest('hex');
    const newVersion = currentVersion + 1;
    const validationStatus = input.validationStatus || 'DRAFT';

    // 7. Persist Component & History in DB
    if (this.db) {
      // Upsert current component
      await this.db
        .prepare(`
          INSERT INTO article_components (
            article_id, component_type, schema_version, component_version,
            content_hash, content_json, validation_status, updated_by, updated_at
          ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT (article_id, component_type) DO UPDATE SET
            component_version = excluded.component_version,
            content_hash = excluded.content_hash,
            content_json = excluded.content_json,
            validation_status = excluded.validation_status,
            updated_by = excluded.updated_by,
            updated_at = CURRENT_TIMESTAMP
        `)
        .bind(articleId, componentType, newVersion, newContentHash, contentJson, validationStatus, actor)
        .run();

      // Record to history
      await this.db
        .prepare(`
          INSERT INTO article_component_history (
            article_id, component_type, component_version, content_hash,
            content_json, validation_status, updated_by, reason, idempotency_key, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `)
        .bind(
          articleId,
          componentType,
          newVersion,
          newContentHash,
          contentJson,
          validationStatus,
          actor,
          reason || `Updated by ${actor}`,
          idempotencyKey || null
        )
        .run();
    }

    // 8. Dependency Invalidation Cascades
    const invalidated: ArticleComponentType[] = [];
    const cascades = getInvalidationCascades(componentType);

    for (const rule of cascades) {
      invalidated.push(rule.targetComponent);
      if (this.db) {
        try {
          await this.db
            .prepare(`
              UPDATE article_components SET
                validation_status = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE article_id = ? AND component_type = ?
            `)
            .bind(rule.newStatus, articleId, rule.targetComponent)
            .run();
        } catch (_) {}
      }
    }

    return {
      success: true,
      articleId,
      componentType,
      newVersion,
      contentHash: newContentHash,
      validationStatus,
      invalidatedComponents: invalidated
    };
  }

  /**
   * Loads all stored components for an article.
   */
  async loadArticleComponents(articleId: number): Promise<Partial<ComponentDataMap>> {
    if (!this.db) return {};

    const rows = await this.db
      .prepare('SELECT component_type, content_json FROM article_components WHERE article_id = ?')
      .bind(articleId)
      .all();

    const result: Partial<ComponentDataMap> = {};
    const items = Array.isArray(rows?.results) ? rows.results : (Array.isArray(rows) ? rows : []);

    for (const row of items) {
      try {
        result[row.component_type as ArticleComponentType] = JSON.parse(row.content_json);
      } catch (_) {}
    }

    return result;
  }

  /**
   * Produces an immutable article snapshot, stores it in article_snapshots,
   * and synchronizes the projection onto articles.content_md / articles.content_html.
   */
  async createSnapshot(params: {
    articleId: number;
    actor: ActorRole;
    qaReceipts?: Record<string, any>;
  }): Promise<{
    snapshotId: string;
    assemblyResult: AssemblyResult;
  }> {
    const { articleId, actor, qaReceipts } = params;
    const components = await this.loadArticleComponents(articleId);

    // Run deterministic assembly
    const assemblyResult = await assembleModularArticle({
      article_id: articleId,
      components
    });

    const snapshotId = `snp_${articleId}_${Date.now()}_${assemblyResult.assembly_hash.slice(0, 8)}`;

    if (this.db) {
      // 1. Insert Snapshot Record
      await this.db
        .prepare(`
          INSERT INTO article_snapshots (
            snapshot_id, article_id, schema_version, snapshot_version,
            manifest_json, assembled_md, assembled_html, visual_manifest_json,
            assembly_hash, assembly_status, is_active, qa_receipts_json, created_by, created_at
          ) VALUES (?, ?, 1, 1, ?, ?, ?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP)
        `)
        .bind(
          snapshotId,
          articleId,
          JSON.stringify(assemblyResult.component_manifest),
          assemblyResult.assembled_md,
          assemblyResult.assembled_html,
          JSON.stringify(assemblyResult.visual_manifest),
          assemblyResult.assembly_hash,
          assemblyResult.assembly_status,
          qaReceipts ? JSON.stringify(qaReceipts) : null,
          actor
        )
        .run();

      // Deactivate previous active snapshots for this article
      await this.db
        .prepare('UPDATE article_snapshots SET is_active = 0 WHERE article_id = ? AND snapshot_id != ?')
        .bind(articleId, snapshotId)
        .run();

      // 2. Synchronize Projected Read Model in `articles` table
      // Preserves title, slug, manual_hold, featured_image
      await this.db
        .prepare(`
          UPDATE articles SET
            content_md = ?,
            content_html = ?,
            content_hash = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .bind(
          assemblyResult.assembled_md,
          assemblyResult.assembled_html,
          assemblyResult.assembly_hash,
          articleId
        )
        .run();

      // 3. Update settings table with synchronized visual manifest matching the assembled hash!
      const manifestJson = JSON.stringify(assemblyResult.visual_manifest);
      await this.db
        .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
        .bind(`visual_manifest:article:${articleId}`, manifestJson)
        .run();

      if (components.identity?.canonical_slug) {
        await this.db
          .prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
          .bind(`visual_manifest:slug:${components.identity.canonical_slug}`, manifestJson)
          .run();
      }
    }

    return {
      snapshotId,
      assemblyResult
    };
  }

  /**
   * Rolls back a specific component to a prior historical version.
   */
  async rollbackComponent(params: {
    articleId: number;
    componentType: ArticleComponentType;
    targetVersion: number;
    actor: ActorRole;
    reason?: string;
  }): Promise<MutationResult> {
    const { articleId, componentType, targetVersion, actor, reason } = params;
    enforceComponentWritePermission(actor, componentType);

    if (!this.db) {
      throw new Error('Database required for component rollback.');
    }

    const historical = await this.db
      .prepare('SELECT content_json, validation_status FROM article_component_history WHERE article_id = ? AND component_type = ? AND component_version = ? LIMIT 1')
      .bind(articleId, componentType, targetVersion)
      .first();

    if (!historical) {
      throw new Error(`ROLLBACK_FAILED: Version ${targetVersion} of component '${componentType}' not found in history.`);
    }

    const data = JSON.parse(historical.content_json);

    // Get current version for OCC
    const current = await this.db
      .prepare('SELECT component_version FROM article_components WHERE article_id = ? AND component_type = ? LIMIT 1')
      .bind(articleId, componentType)
      .first();

    const expectedVersion = current?.component_version || 0;

    return this.mutateComponent({
      articleId,
      componentType,
      actor,
      expectedVersion,
      data,
      validationStatus: historical.validation_status as ValidationStatus,
      reason: reason || `Rollback to version ${targetVersion}`
    });
  }
}
