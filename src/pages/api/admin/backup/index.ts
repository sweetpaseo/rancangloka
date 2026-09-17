import type { APIRoute } from 'astro';
import { isValidAdminSession } from '../../../../lib/auth.ts';
import { getRuntimeEnv } from '../../../../lib/db.ts';
import {
  createBackupSet,
  runRestorePreflight,
  GoogleDriveAdapter,
  BackupScheduler
} from '../../../../lib/dr1/index.ts';

// In-memory staging state for local/dev administration
const stagingScheduler = new BackupScheduler();
const stagingDriveAdapter = new GoogleDriveAdapter('folder_staging_dr1');
const stagingBackupHistory: any[] = [];

export const GET: APIRoute = async ({ request, locals }) => {
  // Auth check: Admin session or DR-1 Bearer token
  const env = await getRuntimeEnv(locals);
  const isAuth = await isValidAdminSession(request.headers.get('cookie'), env);
  if (!isAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Admin session required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const offsiteList = await stagingDriveAdapter.listBackupSets();
  stagingScheduler.setGoogleDriveRetentionUsed(offsiteList.length);

  return new Response(
    JSON.stringify({
      health: stagingScheduler.getHealth(),
      policy: stagingScheduler.getPolicy(),
      history: stagingBackupHistory,
      offsite: {
        provider: stagingDriveAdapter.providerName,
        retentionLimit: 5,
        connected: await stagingDriveAdapter.testConnection(),
        backupSets: offsiteList
      }
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};

export const POST: APIRoute = async ({ request, locals }) => {
  const env = await getRuntimeEnv(locals);
  const isAuth = await isValidAdminSession(request.headers.get('cookie'), env);
  if (!isAuth) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Admin session required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { action, passphrase, backupSet, restoreMode } = body;

  if (action === 'CREATE_BACKUP') {
    // Generate backup from current mock/staging tables
    const sampleTables = {
      categories: {
        schemaSql: 'CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT, slug TEXT UNIQUE);',
        columns: ['id', 'name', 'slug'],
        rows: [
          { id: 1, name: 'Interior & Tata Ruang', slug: 'interior-design' },
          { id: 2, name: 'Arsitektur & Renovasi', slug: 'arsitektur-renovasi' }
        ]
      },
      articles: {
        schemaSql: 'CREATE TABLE articles (id INTEGER PRIMARY KEY, slug TEXT UNIQUE, title TEXT, status TEXT);',
        columns: ['id', 'slug', 'title', 'status'],
        rows: [
          { id: 1, slug: 'rancangloka-internal-ingest-smoke-test-2026-09-04', title: 'Smoke Test', status: 'draft' }
        ]
      },
      settings: {
        schemaSql: 'CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);',
        columns: ['key', 'value'],
        rows: [
          { key: 'site_title', value: 'RancangLoka' }
        ]
      }
    };

    const newSet = await createBackupSet(
      { tables: sampleTables },
      passphrase || undefined
    );

    stagingBackupHistory.unshift({
      backupId: newSet.backupId,
      createdAt: newSet.createdAt,
      type: newSet.manifest.backupType,
      isEncrypted: !!newSet.encryptedArchive,
      sha256: newSet.checksumsSha256,
      set: newSet
    });

    stagingScheduler.recordSuccess(stagingScheduler.generateJobId(), newSet.backupId, false);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Backup created successfully in staging environment.',
        backupSet: newSet
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (action === 'DRY_RUN_RESTORE') {
    if (!backupSet) {
      return new Response(JSON.stringify({ error: 'backupSet payload required for dry-run restore' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const mockTargetState = {
      schemaVersion: '0005',
      tables: {
        categories: [{ id: 1, name: 'Interior & Tata Ruang', slug: 'interior-design' }],
        articles: [{ id: 1, slug: 'rancangloka-internal-ingest-smoke-test-2026-09-04', title: 'Smoke Test', status: 'draft' }]
      }
    };

    const preflight = await runRestorePreflight(
      backupSet,
      mockTargetState,
      restoreMode || 'MERGE',
      passphrase || undefined
    );

    return new Response(JSON.stringify(preflight), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (action === 'OFFSITE_SYNC') {
    if (!backupSet) {
      return new Response(JSON.stringify({ error: 'backupSet payload required for offsite sync' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const offsiteResult = await stagingDriveAdapter.processOffsiteBackup(backupSet);
    return new Response(JSON.stringify(offsiteResult), {
      status: offsiteResult.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
};
