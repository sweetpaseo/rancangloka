import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const result = spawnSync(
  process.execPath,
  [resolve(repoRoot, 'scripts/bootstrap-local-d1.mjs'), '--worker', ...process.argv.slice(2)],
  {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false
  }
);

process.exit(result.status ?? 1);
