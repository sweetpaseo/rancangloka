/**
 * RancangLoka — Staging Ingest Secret Rotation Utility
 *
 * Rotates the HMAC ingestion key for Staging Edge Worker.
 * - Generates cryptographically secure 256-bit secret.
 * - Uploads to Cloudflare Worker secrets via wrangler CLI.
 * - Saves locally to gitignored .env.staging.local.
 * - NEVER prints the secret to stdout or logs.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const newSecretHex = crypto.randomBytes(32).toString('hex');
const newKeyId = 'hermes_staging_key_v2';

console.log('🔄 Memulai rotasi kunci HMAC Ingestion Cloudflare Staging...');

// 1. Save new secret to strictly gitignored .env.staging.local
const secretFilePath = path.join(rootDir, '.env.staging.local');
const envContent = `# RancangLoka Staging Secrets (STRICTLY GITIGNORED - DO NOT COMMIT)\nHERMES_INGEST_KEY_ID=${newKeyId}\nHERMES_INGEST_SECRET_STAGING=${newSecretHex}\n`;
fs.writeFileSync(secretFilePath, envContent, { encoding: 'utf8', mode: 0o600 });
console.log(`✓ Kunci baru berhasil disimpan secara aman di: .env.staging.local (gitignored)`);

// 2. Put secret to Cloudflare Staging Worker
try {
  console.log('☁️ Mengunggah kunci baru ke Cloudflare Staging Worker (RANCANGLOKA_HERMES_INGEST_KEY_CURRENT)...');
  execSync(`npx wrangler secret put RANCANGLOKA_HERMES_INGEST_KEY_CURRENT --env staging`, {
    input: newSecretHex,
    stdio: ['pipe', 'pipe', 'inherit'],
    cwd: rootDir
  });
  console.log('✓ Kunci RANCANGLOKA_HERMES_INGEST_KEY_CURRENT berhasil diperbarui di Cloudflare Staging.');
} catch (err) {
  console.error('❌ Gagal mengunggah secret ke Cloudflare:', err.message);
  process.exit(1);
}

// 3. Update wrangler.toml with new Key ID
const wranglerPath = path.join(rootDir, 'wrangler.toml');
let wranglerContent = fs.readFileSync(wranglerPath, 'utf8');
wranglerContent = wranglerContent.replace(
  /RANCANGLOKA_HERMES_INGEST_KEY_CURRENT_ID\s*=\s*"[^"]*"/,
  `RANCANGLOKA_HERMES_INGEST_KEY_CURRENT_ID = "${newKeyId}"`
);
fs.writeFileSync(wranglerPath, wranglerContent, 'utf8');
console.log(`✓ wrangler.toml diperbarui dengan Key ID: ${newKeyId}`);

console.log('\n================================================================');
console.log('✅ ROTASI KUNCI STAGING SELESAI DENGAN SUKSES');
console.log('================================================================');
console.log(`Key ID Baru        : ${newKeyId}`);
console.log(`Lokasi Secret File : .env.staging.local`);
console.log('Invarian Keamanan  : Nilai secret TIDAK PERNAH dicetak ke layar/log.');
console.log('================================================================\n');
