import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const useWorkerConfig = args.includes('--worker');
const persistToArgIndex = args.indexOf('--persist-to');
const persistTo = persistToArgIndex >= 0 ? resolve(repoRoot, args[persistToArgIndex + 1]) : null;
const requestedDrive = process.env.RANCANGLOKA_WORKER_DRIVE || 'R:';
const drive = requestedDrive.endsWith(':') ? requestedDrive : `${requestedDrive}:`;
const mappedRoot = `${drive}\\`;
const wrangler = resolve(repoRoot, 'node_modules/.bin/wrangler.cmd');

const migrationFiles = [
  '0001_category_taxonomy_expansion.sql',
  '0002_article_ingest_receipts.sql',
  '0003_canonical_editorial_author.sql',
  '0004_add_article_flags.sql',
  '0005_media_assets_and_article_media.sql',
  '0006_media_jobs_queue.sql',
  '0007_publication_readiness_and_approvals.sql',
  '0008_publication_planner.sql',
  '0009_publication_publisher.sql',
  '0010_publication_feedback.sql',
  '0011_automation_safety.sql',
  '0012_articles_created_at.sql'
];

const replayAfterBaseline = [
  '0002_article_ingest_receipts.sql',
  '0003_canonical_editorial_author.sql',
  '0005_media_assets_and_article_media.sql',
  '0006_media_jobs_queue.sql',
  '0007_publication_readiness_and_approvals.sql',
  '0008_publication_planner.sql',
  '0009_publication_publisher.sql',
  '0010_publication_feedback.sql',
  '0011_automation_safety.sql'
];

function sqlLiteral(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

function buildBootstrapSql() {
  const chunks = [
    '-- RancangLoka local D1 bootstrap: baseline schema + non-overlapping historical migrations.',
    readFileSync(resolve(repoRoot, 'db/schema.sql'), 'utf8')
  ];

  for (const file of replayAfterBaseline) {
    chunks.push(`-- Replay non-overlapping migration: ${file}`);
    chunks.push(readFileSync(resolve(repoRoot, 'db/migrations', file), 'utf8'));
  }

  chunks.push(`
CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`);

  migrationFiles.forEach((file, index) => {
    chunks.push(`INSERT OR IGNORE INTO d1_migrations (id, name, applied_at) VALUES (${index + 1}, ${sqlLiteral(file)}, CURRENT_TIMESTAMP);`);
  });

  return chunks.join('\n\n');
}

function localStateRoot() {
  if (persistTo) return resolve(persistTo, 'v3/d1/miniflare-D1DatabaseObject');
  if (useWorkerConfig) return resolve(repoRoot, 'dist/server/.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
  return resolve(repoRoot, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
}

function repairExistingBaselineColumns() {
  const stateRoot = localStateRoot();
  if (!existsSync(stateRoot)) return;

  for (const file of readdirSync(stateRoot).filter((name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite')) {
    const dbPath = join(stateRoot, file);
    const db = new DatabaseSync(dbPath);
    try {
      const articleTable = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'articles'")
        .get();
      if (!articleTable) continue;

      const columns = new Set(db.prepare('PRAGMA table_info(articles)').all().map((row) => row.name));
      const repairs = [
        ['is_sponsored', 'ALTER TABLE articles ADD COLUMN is_sponsored INTEGER DEFAULT 0'],
        ['disable_internal_links', 'ALTER TABLE articles ADD COLUMN disable_internal_links INTEGER DEFAULT 0'],
        ['created_at', 'ALTER TABLE articles ADD COLUMN created_at DATETIME']
      ];

      for (const [column, sql] of repairs) {
        if (!columns.has(column)) {
          db.exec(sql);
          columns.add(column);
        }
      }
    } finally {
      db.close();
    }
  }
}

function ensureDriveMapping() {
  if (!useWorkerConfig) return () => {};

  const currentMappings = spawnSync('subst', { encoding: 'utf8', shell: true });
  if (currentMappings.error) {
    console.error(currentMappings.error.message);
    process.exit(1);
  }

  const mappingLine = currentMappings.stdout
    .split(/\r?\n/)
    .find((line) => line.toUpperCase().startsWith(`${drive.toUpperCase()}\\:`));
  const existingTarget = mappingLine?.split(/:\s*/, 2)[1]?.trim();
  const createdMapping = !existingTarget;

  if (existingTarget && resolve(existingTarget) !== repoRoot) {
    console.error(`${drive} is already mapped to ${existingTarget}. Set RANCANGLOKA_WORKER_DRIVE to another free drive letter.`);
    process.exit(1);
  }

  if (createdMapping) {
    const mapDrive = spawnSync('subst', [drive, repoRoot], { stdio: 'inherit', shell: true });
    if (mapDrive.status !== 0) {
      process.exit(mapDrive.status ?? 1);
    }
  }

  return () => {
    if (createdMapping) {
      spawnSync('subst', [drive, '/D'], { stdio: 'ignore', shell: true });
    }
  };
}

const tempDir = resolve(repoRoot, '.tmp/local-d1-bootstrap');
mkdirSync(tempDir, { recursive: true });
const tempSql = resolve(tempDir, 'bootstrap-current.sql');
writeFileSync(tempSql, buildBootstrapSql(), 'utf8');

const cleanupDrive = ensureDriveMapping();

try {
  repairExistingBaselineColumns();

  const config = useWorkerConfig
    ? `${mappedRoot}dist\\server\\wrangler.json`
    : resolve(repoRoot, 'wrangler.toml');
  const cwdArgs = useWorkerConfig ? ['--cwd', mappedRoot] : [];
  const persistArgs = persistTo ? ['--persist-to', persistTo] : [];

  console.log(`Bootstrapping local D1 DB with ${useWorkerConfig ? 'generated Worker config' : 'root wrangler config'}.`);
  if (persistTo) console.log(`Using isolated local state: ${persistTo}`);

  const result = spawnSync(
    wrangler,
    [
      'd1',
      'execute',
      'DB',
      '--local',
      ...persistArgs,
      ...cwdArgs,
      '--config',
      config,
      '--file',
      tempSql
    ],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        ASTRO_TELEMETRY_DISABLED: process.env.ASTRO_TELEMETRY_DISABLED || '1',
        XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || resolve(repoRoot, '.tmp/xdg')
      }
    }
  );

  process.exitCode = result.status ?? 1;
} finally {
  cleanupDrive();
  try {
    rmSync(tempSql, { force: true });
  } catch {
    // Best-effort cleanup only.
  }
}
