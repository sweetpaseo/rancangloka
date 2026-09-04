/**
 * Route Smoke Test for RancangLoka Astro
 * Phase 1.5 — Verifies HTTP rendering of imported article route /<generated-slug>
 */

import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { createAdminSessionToken } from '../src/lib/auth.ts';

const TEST_PORT = 4399;
const SAMPLE_PATH = path.resolve(process.cwd(), 'samples/safe-sample-article.md');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetchUrl(url);
      if (res.statusCode === 200) return true;
    } catch {
      await new Promise(r => setTimeout(r, 600));
    }
  }
  throw new Error(`Server did not respond at ${url} within ${timeoutMs}ms`);
}

async function runRouteSmokeTest() {
  console.log('=== ROUTE SMOKE TEST: HTTP RENDERING & DRAFT SAFETY ===\n');

  const rawContent = fs.readFileSync(SAMPLE_PATH, 'utf-8');

  // 1. Start Astro dev server on isolated port
  console.log(`1. Spawning Astro dev server on port ${TEST_PORT}...`);
  const isWindows = process.platform === 'win32';
  const cmd = isWindows ? 'npx.cmd' : 'npx';
  const serverProc = spawn(cmd, ['astro', 'dev', '--port', String(TEST_PORT)], {
    cwd: process.cwd(),
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer(`http://localhost:${TEST_PORT}/`);
    console.log(`✅ Astro server is running at http://localhost:${TEST_PORT}/\n`);

    // 2. Import article via HTTP POST to the running server's import API (Authenticated with Origin)
    console.log(`2. Sending HTTP POST import to http://localhost:${TEST_PORT}/api/admin/import-md...`);
    const validSessionToken = await createAdminSessionToken();
    const formData = new FormData();
    formData.append('filename', 'safe-sample-article.md');
    formData.append('content', rawContent);
    formData.append('strategy', 'overwrite');

    const importRes = await fetch(`http://localhost:${TEST_PORT}/api/admin/import-md`, {
      method: 'POST',
      headers: {
        'Cookie': `admin_session=${validSessionToken}`,
        'Origin': `http://localhost:${TEST_PORT}`
      },
      body: formData
    });
    const importJson = await importRes.json();
    console.log(`  • Import HTTP status: ${importRes.status}`);
    console.log(`  • Import response:`, importJson);

    if (importRes.status !== 200 || importJson.status !== 'success') {
      console.error('❌ HTTP import failed:', importJson);
      process.exit(1);
    }
    const slug = importJson.slug;
    console.log(`✅ Article imported successfully into dev server with slug: "${slug}"\n`);

    // 3. HTTP GET to the public route (MUST return 404 for draft)
    const publicUrl = `http://localhost:${TEST_PORT}/${slug}`;
    console.log(`3. Sending HTTP GET to public route ${publicUrl}...`);
    const publicRes = await fetch(publicUrl);

    console.log(`  • HTTP Status: ${publicRes.status}`);
    if (publicRes.status !== 404) {
      console.error(`❌ Expected public route to return HTTP 404 for draft, got ${publicRes.status}`);
      process.exit(1);
    }
    const publicBody = await publicRes.text();
    const leakedDraftWord = publicBody.includes('Dasar Pencahayaan Alami');
    if (leakedDraftWord) {
      console.error('❌ Public 404 response leaked draft title or content!');
      process.exit(1);
    }
    console.log('✅ Public route returned HTTP 404 with zero information leakage.');

    // 4. Unauthorized GET to /admin/preview/[slug] (MUST redirect to /admin/login)
    const previewUrl = `http://localhost:${TEST_PORT}/admin/preview/${slug}`;
    console.log(`4. Sending Unauthenticated HTTP GET to ${previewUrl}...`);
    const unauthPreviewRes = await fetch(previewUrl, { redirect: 'manual' });
    console.log(`  • Unauthenticated Preview Status: ${unauthPreviewRes.status}`);
    if (unauthPreviewRes.status !== 302 && unauthPreviewRes.status !== 307) {
      console.error(`❌ Expected redirect (302/307) for unauthenticated preview, got ${unauthPreviewRes.status}`);
      process.exit(1);
    }
    const redirectLocation = unauthPreviewRes.headers.get('location') || '';
    if (!redirectLocation.includes('/admin/login')) {
      console.error(`❌ Expected redirect to /admin/login, got: ${redirectLocation}`);
      process.exit(1);
    }
    console.log(`✅ Unauthenticated preview correctly redirects to: ${redirectLocation}`);

    // 5. Authorized GET to /admin/preview/[slug] (MUST return 200 with headers)
    console.log(`5. Sending Authenticated HTTP GET to ${previewUrl}...`);
    const authPreviewRes = await fetch(previewUrl, {
      headers: {
        'Cookie': `admin_session=${validSessionToken}`
      }
    });
    console.log(`  • Authenticated Preview Status: ${authPreviewRes.status}`);
    if (authPreviewRes.status !== 200) {
      console.error(`❌ Expected HTTP 200 for authenticated preview, got ${authPreviewRes.status}`);
      process.exit(1);
    }

    const previewCacheControl = authPreviewRes.headers.get('cache-control') || '';
    const previewRobots = authPreviewRes.headers.get('x-robots-tag') || '';
    console.log(`  • Cache-Control: ${previewCacheControl}`);
    console.log(`  • X-Robots-Tag: ${previewRobots}`);

    if (!previewCacheControl.includes('no-store') || !previewRobots.includes('noindex')) {
      console.error('❌ Missing required preview security headers (no-store, noindex)!');
      process.exit(1);
    }

    const previewBody = await authPreviewRes.text();
    const titleExpected = 'Dasar Pencahayaan Alami untuk Rumah Tropis';
    const hasTitle = previewBody.includes(titleExpected);
    const hasBodyHeading = previewBody.includes('Karakteristik Cahaya Pantul');
    const hasTakeaways = previewBody.includes('Perancangan bukaan yang cermat') || previewBody.includes('POKOK KAJIAN UTAMA');
    const hasAuthor = previewBody.includes('RancangLoka Editorial Desk') || previewBody.includes('Dewan Redaksi');

    console.log(`  • Title present in Preview HTML: ${hasTitle ? 'YES' : 'NO'}`);
    console.log(`  • Article Body rendered: ${hasBodyHeading ? 'YES' : 'NO'}`);
    console.log(`  • Key Takeaways rendered: ${hasTakeaways ? 'YES' : 'NO'}`);
    console.log(`  • Author attribution rendered: ${hasAuthor ? 'YES' : 'NO'}`);

    if (!hasTitle || !hasBodyHeading) {
      console.error('❌ Preview HTML missing expected title or body!');
      process.exit(1);
    }
    console.log('✅ Article preview rendered completely and safely in HTML.\n');

    // 6. Public Published Article Check
    console.log('6. Verifying public published article access...');
    const pubRes = await fetch(`http://localhost:${TEST_PORT}/tren-desain-interior-japandi-2026-hunian-minimalis`);
    console.log(`  • Published Article Status: ${pubRes.status}`);
    if (pubRes.status !== 200) {
      console.error(`❌ Expected HTTP 200 for published article, got ${pubRes.status}`);
      process.exit(1);
    }
    console.log('✅ Public published article returns HTTP 200 OK.\n');

    // 7. Draft Safety Verification
    console.log('7. Verifying Draft Safety across public feeds...');
    // Check RSS feed: Drafts must NOT appear in RSS feed
    const rssRes = await fetch(`http://localhost:${TEST_PORT}/rss.xml`);
    const rssText = await rssRes.text();
    const inRss = rssText.includes(slug);
    console.log(`  • Appears in public RSS feed (/rss.xml): ${inRss ? 'YES (LEAKED!)' : 'NO (PROTECTED DRAFT)'}`);

    // Check Homepage HTML: Drafts must NOT appear on homepage
    const homeRes = await fetch(`http://localhost:${TEST_PORT}/`);
    const homeText = await homeRes.text();
    const inHome = homeText.includes(slug);
    console.log(`  • Appears in homepage feed (/): ${inHome ? 'YES (LEAKED!)' : 'NO (PROTECTED DRAFT)'}`);

    if (inRss || inHome) {
      console.error('❌ DRAFT article leaked into public feeds!');
      process.exit(1);
    }
    console.log('✅ Draft safety confirmed: Draft returns 404 publicly and is strictly excluded from public RSS & homepage listings.\n');

    console.log('🎉 ROUTE SMOKE TEST PASSED 100%!');
    return;
  } finally {
    // Graceful server shutdown
    serverProc.kill('SIGTERM');
    try {
      if (isWindows) {
        spawn('taskkill', ['/pid', String(serverProc.pid), '/f', '/t'], { shell: true });
      }
    } catch {}
  }
}

runRouteSmokeTest().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('Smoke Test Error:', err);
  process.exit(1);
});
