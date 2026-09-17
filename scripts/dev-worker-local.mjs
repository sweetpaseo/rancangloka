import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const entry = resolve(repoRoot, 'dist/server/entry.mjs');
const config = resolve(repoRoot, 'dist/server/wrangler.json');
const wrangler = resolve(repoRoot, 'node_modules/.bin/wrangler.cmd');
const requestedDrive = process.env.RANCANGLOKA_WORKER_DRIVE || 'R:';
const drive = requestedDrive.endsWith(':') ? requestedDrive : `${requestedDrive}:`;
const mappedRoot = `${drive}\\`;

if (!existsSync(entry) || !existsSync(config)) {
  console.error('Built Worker output is missing. Run npm run build first.');
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

const args = [
  'dev',
  '--cwd',
  mappedRoot,
  '--local',
  '--config',
  `${mappedRoot}dist\\server\\wrangler.json`,
  ...process.argv.slice(2)
];

const child = spawn(wrangler, args, {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: process.env.ASTRO_TELEMETRY_DISABLED || '1',
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || resolve(repoRoot, '.tmp/xdg')
  }
});

const cleanup = () => {
  if (createdMapping) {
    spawnSync('subst', [drive, '/D'], { stdio: 'ignore', shell: true });
  }
};

child.on('exit', (code, signal) => {
  cleanup();
  if (signal) {
    process.kill(process.pid, signal);
  }
  process.exit(code ?? 0);
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('exit', cleanup);
