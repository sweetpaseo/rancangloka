/**
 * RancangLoka Shared Memory Adapter
 * File: src/lib/editorial/shared-memory-adapter.ts
 * 
 * Strict Invariants:
 * 1. Read-only by default: Autonomous writes are blocked unless explicitly authorized.
 * 2. Source of Truth: In-repo authoritative rules in docs/ and src/ remain authoritative.
 * 3. Zero Credentials: API keys, tokens, or private secrets must never be read or written.
 * 4. Zero Publication Authority: Shared memory cannot grant publication approval (AUTO_PUBLISH remains OFF).
 * 5. Cross-platform path resolution: Works seamlessly on both Windows and Hermes EU Linux container.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface SharedMemoryStatus {
  available: boolean;
  base_dir: string;
  is_read_only: boolean;
  total_files: number;
  categories: string[];
}

export interface SharedMemoryDocument {
  subpath: string;
  category: string;
  filename: string;
  content: string;
  updated_at: string;
}

export interface KnowledgeMatch {
  subpath: string;
  category: string;
  title: string;
  matched_text: string;
}

// Canonical candidate paths across environments
const CANDIDATE_SHARED_MEMORY_PATHS: string[] = [
  process.env.RANCANGLOKA_SHARED_MEMORY_DIR || '',
  process.env.SHARED_MEMORY_DIR || '',
  '/opt/data/rancangloka/shared-memory',           // Hermes EU primary container path
  '/opt/data/rancangloka/docs/shared-memory',      // Hermes EU secondary fallback
  'E:/antigravity/rancangloka/rancangloka-astro/docs/shared-memory', // Windows canonical path
  path.resolve(process.cwd(), 'docs/shared-memory'),                 // Astro cwd fallback
  path.resolve(process.cwd(), '../docs/shared-memory')               // Astro parent cwd fallback
].filter(Boolean);

/**
 * Resolve active shared memory directory from environment or candidate paths.
 */
export function resolveSharedMemoryDir(): string {
  for (const candidate of CANDIDATE_SHARED_MEMORY_PATHS) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    } catch {
      // Continue search if permission or path error
    }
  }

  // Default fallback to first path
  return CANDIDATE_SHARED_MEMORY_PATHS[0] || path.resolve(process.cwd(), 'docs/shared-memory');
}

/**
 * Check whether autonomous writes are enabled in current execution mode.
 * STRICT DEFAULT: FALSE (Read-Only)
 */
export function isSharedMemoryWriteEnabled(): boolean {
  return process.env.ENABLE_SHARED_MEMORY_WRITES === 'true';
}

/**
 * Get comprehensive status of shared memory directory.
 */
export function getSharedMemoryStatus(): SharedMemoryStatus {
  const baseDir = resolveSharedMemoryDir();
  const exists = fs.existsSync(baseDir);

  if (!exists) {
    return {
      available: false,
      base_dir: baseDir,
      is_read_only: true,
      total_files: 0,
      categories: []
    };
  }

  const items = fs.readdirSync(baseDir, { withFileTypes: true });
  const categories = items.filter(i => i.isDirectory() && !i.name.startsWith('.')).map(i => i.name);
  
  let totalFiles = 0;
  function countFiles(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        countFiles(path.join(dir, entry.name));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        totalFiles++;
      }
    }
  }

  countFiles(baseDir);

  return {
    available: true,
    base_dir: baseDir,
    is_read_only: !isSharedMemoryWriteEnabled(),
    total_files: totalFiles,
    categories
  };
}

/**
 * Read a Markdown document safely from shared memory.
 * Defends against path traversal attacks.
 */
export function readMemoryDoc(subpath: string): SharedMemoryDocument {
  const baseDir = resolveSharedMemoryDir();
  const safeSubpath = path.normalize(subpath).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(baseDir, safeSubpath);

  if (!fullPath.startsWith(path.resolve(baseDir))) {
    throw new Error(`[SharedMemory] Path traversal denied: ${subpath}`);
  }

  if (!fs.existsSync(fullPath)) {
    throw new Error(`[SharedMemory] Document not found: ${subpath}`);
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  const stat = fs.statSync(fullPath);
  const parts = safeSubpath.split(/[\/\\]/);
  const category = parts.length > 1 ? parts[0] : 'root';
  const filename = path.basename(fullPath);

  return {
    subpath: safeSubpath.replace(/\\/g, '/'),
    category,
    filename,
    content,
    updated_at: stat.mtime.toISOString()
  };
}

/**
 * List all Markdown documents in a subcategory or entire shared memory.
 */
export function listMemoryDocs(category?: string): SharedMemoryDocument[] {
  const baseDir = resolveSharedMemoryDir();
  if (!fs.existsSync(baseDir)) return [];

  const targetDir = category ? path.join(baseDir, category) : baseDir;
  if (!fs.existsSync(targetDir)) return [];

  const docs: SharedMemoryDocument[] = [];

  function traverse(current: string, currentCategory: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        traverse(full, currentCategory || entry.name);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const rel = path.relative(baseDir, full).replace(/\\/g, '/');
        const stat = fs.statSync(full);
        docs.push({
          subpath: rel,
          category: currentCategory || 'root',
          filename: entry.name,
          content: fs.readFileSync(full, 'utf8'),
          updated_at: stat.mtime.toISOString()
        });
      }
    }
  }

  traverse(targetDir, category || '');
  return docs;
}

/**
 * Convenience getter: Golden Article #9993 Reference
 */
export function getGoldenArticleReference(): string {
  try {
    const doc = readMemoryDoc('01-editorial-standards/golden-article-reference.md');
    return doc.content;
  } catch (err: any) {
    return `[Golden Article Fallback] #9993 Dinding Rembes dan Cat Menggelembung (Error: ${err.message})`;
  }
}

/**
 * Convenience getter: Voice & Tone Guide
 */
export function getVoiceAndToneGuide(): string {
  try {
    const doc = readMemoryDoc('01-editorial-standards/voice-and-tone-guide.md');
    return doc.content;
  } catch (err: any) {
    return `[Voice Guide Fallback] Jakarta Editorial, one idea per paragraph, zero Anda.`;
  }
}

/**
 * Convenience getter: Visual Policy Summary
 */
export function getVisualPolicySummary(): string {
  try {
    const doc = readMemoryDoc('01-editorial-standards/visual-policy-summary.md');
    return doc.content;
  } catch (err: any) {
    return `[Visual Policy Fallback] Object-First, 5 images, 1 pre-closing before decision.`;
  }
}

/**
 * Convenience getter: Verified Material Knowledge
 */
export function getMaterialBenchmarks(): string {
  try {
    const doc = readMemoryDoc('02-verified-knowledge/material-benchmarks.md');
    return doc.content;
  } catch (err: any) {
    return `[Material Knowledge Fallback] Alderon UPVC min 10 deg slope; glass laminated 25-30 kg/m2 dead load.`;
  }
}

/**
 * Convenience getter: Owner Directives
 */
export function getOwnerDirectives(): string {
  try {
    const doc = readMemoryDoc('03-owner-preferences/editorial-directives.md');
    return doc.content;
  } catch (err: any) {
    return `[Owner Directives Fallback] AUTO_PUBLISH=OFF, Monetary Silence, Evidence-First.`;
  }
}

/**
 * Query verified knowledge and standards for keyword matches.
 * Useful for Irwan (Research), Joko (Writer), and Nadia (Editor).
 */
export function querySharedMemory(keywords: string[]): KnowledgeMatch[] {
  const docs = listMemoryDocs();
  const matches: KnowledgeMatch[] = [];

  const lowerKeywords = keywords.map(k => k.toLowerCase().trim()).filter(Boolean);
  if (lowerKeywords.length === 0) return [];

  for (const doc of docs) {
    const paragraphs = doc.content.split(/\n\n+/);
    for (const p of paragraphs) {
      const lowerP = p.toLowerCase();
      const hasMatch = lowerKeywords.some(k => lowerP.includes(k));
      if (hasMatch) {
        matches.push({
          subpath: doc.subpath,
          category: doc.category,
          title: doc.filename.replace('.md', ''),
          matched_text: p.trim()
        });
      }
    }
  }

  return matches;
}

/**
 * Write a handoff, research note, or OLCI record into shared memory.
 * STRICT SAFETY ENFORCEMENT:
 * - Blocked if write is not permitted (requires allowWriteOverride or isSharedMemoryWriteEnabled()).
 * - Allowed ONLY in designated shared memory namespaces.
 * - Defends against path traversal attacks.
 * - Rejects any content containing secret signatures.
 */
export function writeMemoryNote(params: {
  category: '04-agent-handoffs' | '02-verified-knowledge' | '06-staff-memory' | '00-innovation-inbox' | '07-collaboration-threads';
  subfolder?: string;
  filename: string;
  authorStaff: string;
  content: string;
  allowWriteOverride?: boolean;
  preserveRawContent?: boolean;
}): { success: boolean; subpath: string } {
  const writePermitted = params.allowWriteOverride || isSharedMemoryWriteEnabled();
  
  if (!writePermitted) {
    throw new Error(
      `[SharedMemory:READ_ONLY_VIOLATION] Autonomous writes to shared memory are currently disabled. ` +
      `Staff '${params.authorStaff}' attempted write to '${params.category}/${params.filename}'.`
    );
  }

  // Security check: reject potential credentials/tokens
  const secretPattern = /(api[_-]?key|secret[_-]?key|bearer\s+[a-z0-9_\-\.]+|sk-[a-z0-9]{20,})/i;
  if (secretPattern.test(params.content)) {
    throw new Error(
      `[SharedMemory:SECURITY_VIOLATION] Refused write to shared memory: Content contains credential-like patterns.`
    );
  }

  // Path traversal check on input arguments
  if (params.subfolder && (params.subfolder.includes('..') || path.isAbsolute(params.subfolder))) {
    throw new Error(`[SharedMemory:PATH_VIOLATION] Path traversal denied for subfolder: ${params.subfolder}`);
  }
  if (params.filename && (params.filename.includes('..') || params.filename.includes('/') || params.filename.includes('\\'))) {
    throw new Error(`[SharedMemory:PATH_VIOLATION] Path traversal denied for filename: ${params.filename}`);
  }

  // Ensure clean filename
  const cleanFilename = params.filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_').replace(/\.md$/, '') + '.md';
  const baseDir = resolveSharedMemoryDir();
  
  // Resolve safe target directory
  const targetDir = params.subfolder ? path.join(baseDir, params.category, params.subfolder) : path.join(baseDir, params.category);

  // Path traversal check against category root
  const resolvedTarget = path.resolve(targetDir);
  const allowedParent = path.resolve(path.join(baseDir, params.category));
  if (!resolvedTarget.startsWith(allowedParent)) {
    throw new Error(`[SharedMemory:PATH_VIOLATION] Path traversal denied for target directory: ${params.category}/${params.subfolder}`);
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const fullPath = path.join(targetDir, cleanFilename);
  if (!path.resolve(fullPath).startsWith(path.resolve(baseDir))) {
    throw new Error(`[SharedMemory:PATH_VIOLATION] Path traversal denied for file: ${cleanFilename}`);
  }

  const finalContent = params.preserveRawContent
    ? params.content.trim() + '\n'
    : `<!-- Author: ${params.authorStaff} | Generated: ${new Date().toISOString()} -->\n\n` + params.content.trim() + '\n';

  fs.writeFileSync(fullPath, finalContent, 'utf8');

  const relativeSubpath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
  return {
    success: true,
    subpath: relativeSubpath
  };
}
