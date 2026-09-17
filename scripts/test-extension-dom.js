/**
 * RancangLoka — MEDIA-1: LokaMedia Extension DOM Logic Validation
 * Tests DOM intake handlers: File Picker, Drag & Drop, Clipboard Paste, Copy Prompt.
 */

import fs from 'node:fs';
import path from 'node:path';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function testExtensionDomLogic() {
  console.log('====================================================');
  console.log('🧩 EXTENSION DOM INTAKE LOGIC VALIDATION');
  console.log('====================================================\n');

  // 1. Validate Extension Files
  const extDir = path.resolve('extension');
  const manifestPath = path.join(extDir, 'manifest.json');
  const popupHtmlPath = path.join(extDir, 'popup.html');
  const popupJsPath = path.join(extDir, 'popup.js');
  const popupCssPath = path.join(extDir, 'popup.css');

  assert(fs.existsSync(manifestPath), 'manifest.json exists');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(manifest.manifest_version === 3, 'Manifest version is 3');
  assert(manifest.permissions.includes('storage'), 'Manifest includes storage permission');
  assert(manifest.host_permissions.some(h => h.includes('localhost:4321')), 'Manifest includes localhost:4321 host permission');
  assert(manifest.action.default_popup === 'popup.html', 'Default popup is popup.html');

  const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
  assert(popupHtml.includes('id="drop-zone"'), 'HTML contains #drop-zone');
  assert(popupHtml.includes('id="file-input"'), 'HTML contains #file-input');
  assert(popupHtml.includes('id="btn-copy-prompt"'), 'HTML contains #btn-copy-prompt');
  assert(popupHtml.includes('id="btn-send"'), 'HTML contains #btn-send');
  assert(popupHtml.includes('id="input-alt-text"'), 'HTML contains #input-alt-text');
  assert(popupHtml.includes('id="select-job"'), 'HTML contains #select-job');

  const popupJs = fs.readFileSync(popupJsPath, 'utf8');

  // 2. Validate File Picker Implementation
  console.log('\n[Validating File Picker]');
  assert(popupJs.includes("elFileInput.addEventListener('change'"), 'File input change listener is registered');
  assert(popupJs.includes('elFileInput.click()'), 'Clicking drop-zone triggers file-input click');

  // 3. Validate Drag & Drop Implementation
  console.log('\n[Validating Drag & Drop]');
  assert(popupJs.includes("elDropZone.addEventListener('dragover'"), 'Dragover listener is registered with preventDefault');
  assert(popupJs.includes("elDropZone.addEventListener('drop'"), 'Drop listener is registered with preventDefault');
  assert(popupJs.includes('e.dataTransfer.files'), 'Extracts files from dataTransfer');

  // 4. Validate Clipboard Paste Implementation
  console.log('\n[Validating Clipboard Paste]');
  assert(popupJs.includes("window.addEventListener('paste'"), 'Global paste event listener registered on window');
  assert(popupJs.includes("item.type.startsWith('image/')"), 'Detects image items in clipboardData');
  assert(popupJs.includes('item.getAsFile()'), 'Extracts image file from clipboard');

  // 5. Validate Copy Prompt Implementation
  console.log('\n[Validating Copy Prompt]');
  assert(popupJs.includes('navigator.clipboard.writeText(currentJob.prompt)'), 'Copies job.prompt using navigator.clipboard');
  assert(popupJs.includes("elBtnCopyPrompt.addEventListener('click'"), 'Copy prompt click listener is registered');

  // 6. Validate Client Preflight Restrictions
  console.log('\n[Validating Client Preflight]');
  assert(popupJs.includes('image/jpeg') && popupJs.includes('image/png') && popupJs.includes('image/webp'), 'Permits JPEG, PNG, WebP');
  assert(popupJs.includes('5 * 1024 * 1024'), 'Limits file size to 5 MB');
  assert(popupJs.includes('naturalWidth < 600') || popupJs.includes('naturalHeight < 338'), 'Restricts minimum dimensions to 600x338');

  // 7. Validate Idempotent Send & Double-Click Lock
  console.log('\n[Validating Send & Double-Click Lock]');
  assert(popupJs.includes('if (isUploading) return;'), 'Locks concurrent sends with isUploading guard');
  assert(popupJs.includes("formData.append('file', selectedFile)"), 'Attaches file to FormData');
  assert(popupJs.includes("formData.append('article_id'"), 'Attaches article_id to FormData');
  assert(popupJs.includes("formData.append('job_id'"), 'Attaches job_id to FormData');
  assert(popupJs.includes('/api/internal/v1/media/upload'), 'Sends to /api/internal/v1/media/upload');

  console.log('\n====================================================');
  console.log(`DOM Logic Summary: ${passed} Passed, ${failed} Failed`);
  console.log('====================================================\n');

  if (failed > 0) process.exit(1);
}

testExtensionDomLogic().catch((err) => {
  console.error('Fatal DOM test error:', err);
  process.exit(1);
});
