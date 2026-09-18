import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const schema = resolve(repoRoot, 'db/schema.sql');
const config = resolve(repoRoot, 'dist/server/wrangler.json');
const wrangler = resolve(repoRoot, 'node_modules/.bin/wrangler.cmd');
const requestedDrive = process.env.RANCANGLOKA_WORKER_DRIVE || 'R:';
const drive = requestedDrive.endsWith(':') ? requestedDrive : `${requestedDrive}:`;
const mappedRoot = `${drive}\\`;

if (!existsSync(schema)) {
  console.error('Canonical schema is missing: db/schema.sql');
  process.exit(1);
}

if (!existsSync(config)) {
  console.error('Built Worker config is missing. Run npm run build first.');
  process.exit(1);
}

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

try {
  const result = spawnSync(
    wrangler,
    [
      'd1',
      'execute',
      'DB',
      '--local',
      '--cwd',
      mappedRoot,
      '--config',
      `${mappedRoot}dist\\server\\wrangler.json`,
      '--file',
      `${mappedRoot}db\\schema.sql`
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
  if (createdMapping) {
    spawnSync('subst', [drive, '/D'], { stdio: 'ignore', shell: true });
  }
}
