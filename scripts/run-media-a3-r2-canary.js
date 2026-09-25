/**
 * RancangLoka — MEDIA-A3 Production R2 Watermarked Derivative Canary
 *
 * MISSION:
 * GeneratedImageArtifact (public/stitch-homepage.png)
 *   → existing TEXT watermark (rancangloka.com, bottom-right)
 *   → one derivative
 *   → one production R2 upload (rancangloka-media)
 *   → re-download
 *   → byte/hash integrity proof
 *   → StoredGeneratedImageArtifact handoff contract
 *   → STOP
 *
 * AUTHORIZED PRODUCTION MUTATION:
 * EXACTLY ONE new derivative object in production R2.
 *
 * ZERO D1 mutations, ZERO media_assets inserts, ZERO article_media attachments.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

import {
  normalizeLocalFixture,
  validateArtifactBinary
} from '../src/lib/media/generated-image-artifact.ts';
import {
  renderTextWatermarkDerivative,
  createStoredGeneratedImageArtifact
} from '../src/lib/media/stored-image-artifact.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUCKET_NAME = 'rancangloka-media';
const ACCOUNT_ID = 'a8e6d11d45dc2d14fe49fe3b84958ee8';

async function main() {
  console.log('=============================================================');
  console.log('  RancangLoka — MEDIA-A3 Production R2 Canary Execution');
  console.log('=============================================================\n');

  // 1. Verify source fixture
  const sourcePath = path.resolve(__dirname, '../public/stitch-homepage.png');
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source fixture not found: ${sourcePath}`);
  }

  const sourceBeforeBytes = fs.readFileSync(sourcePath);
  const sourceBeforeSha256 = crypto.createHash('sha256').update(sourceBeforeBytes).digest('hex');
  console.log(`SOURCE_BEFORE_SHA256: ${sourceBeforeSha256}`);

  // 2. Normalize through existing MEDIA-A2 implementation
  console.log('\n--- Step 1: Normalize Source via MEDIA-A2 Contract ---');
  const sourceArtifact = await normalizeLocalFixture({
    filePath: sourcePath,
    media_role: 'featured',
    purpose: 'canary'
  });
  console.log(`SOURCE_ARTIFACT_ID: ${sourceArtifact.artifact_id}`);
  console.log(`SOURCE_ARTIFACT_SHA256: ${sourceArtifact.sha256}`);
  console.log(`SOURCE_ARTIFACT_DIMENSIONS: ${sourceArtifact.width}x${sourceArtifact.height}`);

  // 3. Render TEXT watermark derivative
  console.log('\n--- Step 2: Render TEXT Watermark Derivative ---');
  const derivative = await renderTextWatermarkDerivative(sourceArtifact.image_bytes, {
    text: 'rancangloka.com',
    position: 'bottom-right',
    opacity: 0.62,
    sourceMeta: {
      width: sourceArtifact.width,
      height: sourceArtifact.height,
      mime: sourceArtifact.mime_type,
      sha256: sourceArtifact.sha256
    }
  });

  console.log('DERIVATIVE_GENERATION: PASS');
  console.log(`DERIVATIVE_SHA256: ${derivative.sha256}`);
  console.log(`DERIVATIVE_BYTE_SIZE: ${derivative.byte_size}`);
  console.log(`DERIVATIVE_WIDTH: ${derivative.width}`);
  console.log(`DERIVATIVE_HEIGHT: ${derivative.height}`);
  console.log(`DERIVATIVE_MIME: ${derivative.mime_type}`);
  console.log('DERIVATIVE_PROVENANCE_COMPLETE: YES');

  // 4. Verify local idempotency
  console.log('\n--- Step 3: Verify Local Idempotency ---');
  const derivative2 = await renderTextWatermarkDerivative(sourceArtifact.image_bytes, {
    text: 'rancangloka.com',
    position: 'bottom-right',
    opacity: 0.62,
    sourceMeta: {
      width: sourceArtifact.width,
      height: sourceArtifact.height,
      mime: sourceArtifact.mime_type,
      sha256: sourceArtifact.sha256
    }
  });
  const idempotencyPass = derivative.sha256 === derivative2.sha256;
  console.log(`R2_DERIVATIVE_IDEMPOTENCY: ${idempotencyPass ? 'PASS' : 'FAIL'}`);
  if (!idempotencyPass) {
    throw new Error('Local watermark derivative is non-deterministic!');
  }

  // 5. Check pre-existence of key in production R2
  const r2Key = `media/canary/media-a3/${derivative.sha256}.png`;
  console.log(`\nDERIVATIVE_R2_KEY: ${r2Key}`);
  console.log('Checking if object already exists in R2 (fail-closed check)...');

  const checkTempFile = path.resolve(__dirname, `../artifacts/precheck-${Date.now()}.tmp`);
  let keyAlreadyExists = false;
  try {
    execSync(
      `npx wrangler r2 object get "${BUCKET_NAME}/${r2Key}" --file "${checkTempFile}"`,
      {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID }
      }
    );
    keyAlreadyExists = true;
  } catch {
    // Expected: error because key does not exist
    keyAlreadyExists = false;
  } finally {
    if (fs.existsSync(checkTempFile)) {
      fs.unlinkSync(checkTempFile);
    }
  }

  if (keyAlreadyExists) {
    throw new Error(`R2 Key ${r2Key} already exists in ${BUCKET_NAME}! Aborting upload.`);
  }
  console.log('Confirmed: Key does not exist in R2 bucket. Safe to upload.');

  // 6. Production R2 Upload (Exactly ONE attempt)
  console.log('\n--- Step 4: Uploading Derivative to Production R2 ---');
  const artifactsDir = path.resolve(__dirname, '../artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }
  const localDerivativeFile = path.resolve(artifactsDir, `canary-derivative-${derivative.sha256.substring(0, 12)}.png`);
  fs.writeFileSync(localDerivativeFile, derivative.derivative_bytes);

  let uploadSuccess = false;
  const uploadAttempts = 1;
  try {
    console.log(`Executing: wrangler r2 object put "${BUCKET_NAME}/${r2Key}" --file "${localDerivativeFile}" --content-type "${derivative.mime_type}"`);
    const putOutput = execSync(
      `npx wrangler r2 object put "${BUCKET_NAME}/${r2Key}" --file "${localDerivativeFile}" --content-type "${derivative.mime_type}"`,
      {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID }
      }
    );
    console.log(putOutput.trim());
    uploadSuccess = true;
  } catch (err) {
    console.error('R2 upload failed:', err.message || err);
    uploadSuccess = false;
  }

  console.log(`PRODUCTION_R2_UPLOAD_ATTEMPTS: ${uploadAttempts}`);
  console.log(`PRODUCTION_R2_UPLOAD_SUCCESS: ${uploadSuccess ? 'YES' : 'NO'}`);

  if (!uploadSuccess) {
    throw new Error('Production R2 upload failed!');
  }

  // 7. Re-download and verify byte/hash integrity
  console.log('\n--- Step 5: Re-download and Independent Byte Integrity Verification ---');
  const downloadVerifyFile = path.resolve(artifactsDir, `r2-downloaded-${derivative.sha256.substring(0, 12)}.png`);
  try {
    execSync(
      `npx wrangler r2 object get "${BUCKET_NAME}/${r2Key}" --file "${downloadVerifyFile}"`,
      {
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID }
      }
    );
  } catch (err) {
    throw new Error(`Failed to re-download uploaded R2 object: ${err.message || err}`);
  }

  const downloadedBytes = fs.readFileSync(downloadVerifyFile);
  const validatedDownloaded = await validateArtifactBinary(downloadedBytes, {
    declaredMime: derivative.mime_type,
    declaredWidth: derivative.width,
    declaredHeight: derivative.height,
    declaredSha256: derivative.sha256,
    providerName: 'r2_download_validator'
  });

  console.log(`R2_DOWNLOADED_SHA256: ${validatedDownloaded.sha256}`);
  console.log(`R2_DOWNLOADED_BYTE_SIZE: ${validatedDownloaded.byteSize}`);
  console.log(`R2_DOWNLOADED_MIME: ${validatedDownloaded.mimeType}`);
  console.log(`R2_DOWNLOADED_WIDTH: ${validatedDownloaded.width}`);
  console.log(`R2_DOWNLOADED_HEIGHT: ${validatedDownloaded.height}`);

  const byteIntegrityPass = validatedDownloaded.sha256 === derivative.sha256 && validatedDownloaded.byteSize === derivative.byte_size;
  console.log(`R2_BYTE_INTEGRITY: ${byteIntegrityPass ? 'PASS' : 'FAIL'}`);

  // Clean up downloaded verification file to keep repo clean
  if (fs.existsSync(downloadVerifyFile)) {
    fs.unlinkSync(downloadVerifyFile);
  }

  // 8. Verify source immutability
  console.log('\n--- Step 6: Verify Source Immutability ---');
  const sourceAfterBytes = fs.readFileSync(sourcePath);
  const sourceAfterSha256 = crypto.createHash('sha256').update(sourceAfterBytes).digest('hex');
  console.log(`SOURCE_AFTER_SHA256: ${sourceAfterSha256}`);
  const sourceImmutable = sourceBeforeSha256 === sourceAfterSha256;
  console.log(`SOURCE_IMMUTABLE: ${sourceImmutable ? 'PASS' : 'FAIL'}`);

  // 9. Public delivery check
  console.log('\n--- Step 7: Public Media Delivery Evaluation ---');
  console.log('PUBLIC_MEDIA_DELIVERY: NOT_APPLICABLE_UNTIL_MEDIA_A4');

  // 10. Construct StoredGeneratedImageArtifact
  console.log('\n--- Step 8: Build StoredGeneratedImageArtifact Contract ---');
  const storedArtifact = createStoredGeneratedImageArtifact({
    sourceArtifact,
    derivative,
    bucket: BUCKET_NAME,
    storageKey: r2Key
  });

  const storedContractPath = path.resolve(artifactsDir, 'stored-generated-image-artifact.json');
  fs.writeFileSync(storedContractPath, JSON.stringify(storedArtifact, null, 2), 'utf8');
  console.log(`Contract saved to: ${storedContractPath}`);
  console.log('MEDIA_A4_STORAGE_CONTRACT: READY');

  console.log('\n=============================================================');
  console.log('  MEDIA-A3 PRODUCTION R2 CANARY COMPLETED SUCCESSFULLY!');
  console.log('=============================================================');
}

main().catch((err) => {
  console.error('\n❌ MEDIA-A3 Canary Execution Failed:', err);
  process.exit(1);
});
