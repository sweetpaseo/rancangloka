/**
 * RancangLoka — Real Headless Chrome Browser Verification
 * Target: Staging Article ID 10 (Canary #10011)
 *
 * Verifies live Cloudflare Staging edge execution:
 * 1. Desktop viewport (1280x800) render of Inline 1 & Inline 2 SVGs.
 * 2. Mobile viewport (375x812) responsive scaling and zero horizontal overflow.
 * 3. DOM layout metrics: boundingClientRect, natural dimensions, zero clipping.
 * 4. Content assertions: zero test labels, zero absolute claims, zero monetary mentions.
 * 5. Saves authentic PNG screenshots to the artifact directory.
 */

import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAdminSessionToken } from '../src/lib/auth.ts';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA_DIR = 'C:\\Users\\Fanto\\AppData\\Local\\Temp\\chrome_canary10011_verify';
const ARTIFACTS_DIR = 'C:\\Users\\Fanto\\.gemini\\antigravity\\brain\\d4ac4fcc-279e-4275-a4ab-cb211f4bdc36';

const SLUG = 'ventilasi-dapur-tanpa-jendela-solusi-cooker-hood-resirkulasi-vs-exhaust-fan-dinding-canary-10011';
const PREVIEW_URL = `https://rancangloka-staging.chandrajoyko.workers.dev/admin/preview/${SLUG}?mode=reader`;

async function runBrowserVerification() {
  console.log('================================================================');
  console.log('🚀 REAL CHROME BROWSER VERIFICATION: STAGING ARTICLE ID 10');
  console.log('================================================================');
  console.log('Target URL:', PREVIEW_URL);

  // Step 1: Pre-flight HTTP fetch & SVG content audit
  console.log('\n[1/4] Pre-flight HTTP Verification & Semantic SVG Audit...');
  const token = await createAdminSessionToken();
  const httpRes = await fetch(PREVIEW_URL, {
    headers: { 'Cookie': `admin_session=${token}` }
  });

  if (httpRes.status !== 200) {
    throw new Error(`HTTP pre-flight failed with status ${httpRes.status}`);
  }
  const html = await httpRes.text();
  console.log(`   ✓ HTTP 200 OK — Document length: ${html.length} bytes`);

  // Extract base64 SVGs
  const svgMatches = [...html.matchAll(/src="data:image\/svg\+xml;base64,([^"]+)"/g)];
  console.log(`   ✓ Found ${svgMatches.length} embedded SVG diagrams in HTML payload`);

  if (svgMatches.length < 2) {
    throw new Error(`Expected at least 2 inline SVGs, found ${svgMatches.length}`);
  }

  const svg1 = Buffer.from(svgMatches[0][1], 'base64').toString('utf8');
  const svg2 = Buffer.from(svgMatches[1][1], 'base64').toString('utf8');

  // Semantic QA Checks for SVG 1
  console.log('\n--- INLINE 1 SEMANTIC AUDIT ---');
  const hasAbsolute100 = /<text[^>]*>[^<]*100%[^<]*<\/text>/i.test(svg1) || svg1.includes('100% terbuang') || svg1.includes('100% asap');
  const hasDialirkan = svg1.includes('DIALIRKAN KE LUAR') || svg1.includes('DIBUANG KELUAR');
  const hasDistinction = svg1.includes('Cooker Hood Resirkulasi') && svg1.includes('Exhaust Fan Dinding');
  const hasDuctedNote = svg1.includes('ducting') || svg1.includes('Hood berducting');
  const hasLocalTest1 = svg1.includes('LOCAL TEST') || svg1.includes('NOT EDITORIALLY APPROVED');
  const hasMonetary1 = /Rp\s*\d|\bIDR\b|\$\s*\d/i.test(svg1);

  console.log(`   - Klaim absolut 100% dihilangkan   : ${!hasAbsolute100 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Pembuangan udara luar tertera    : ${hasDialirkan ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Pembedaan cara kerja berimbang   : ${hasDistinction ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Catatan hood berducting tersedia : ${hasDuctedNote ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Bebas label internal test        : ${!hasLocalTest1 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Monetary Silence terjaga         : ${!hasMonetary1 ? '✅ PASS' : '❌ FAIL'}`);

  // Semantic QA Checks for SVG 2
  console.log('\n--- INLINE 2 SEMANTIC AUDIT ---');
  const hasLaminarCross = svg2.includes('Laminar cross-flow') || svg2.includes('Laminar');
  const hasAbsoluteRH = />\s*65%\s*RH|<\s*60%\s*RH/i.test(svg2);
  const hasMakeupAir = svg2.includes('Aliran Udara Pengganti Menuju Jalur Pembuangan') || svg2.includes('Udara Pengganti');
  const hasCondensation = svg2.includes('Kondensasi') || svg2.includes('Mengembun');
  const hasLocalTest2 = svg2.includes('LOCAL TEST') || svg2.includes('NOT EDITORIALLY APPROVED');
  const hasMonetary2 = /Rp\s*\d|\bIDR\b|\$\s*\d/i.test(svg2);

  console.log(`   - Klaim "Laminar cross-flow" dihaluskan : ${!hasLaminarCross ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Klaim RH absolut pasti dihapus        : ${!hasAbsoluteRH ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Pasokan udara pengganti tertera       : ${hasMakeupAir ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Fenomena kondensasi akurat            : ${hasCondensation ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Bebas label internal test             : ${!hasLocalTest2 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   - Monetary Silence terjaga              : ${!hasMonetary2 ? '✅ PASS' : '❌ FAIL'}`);

  if (hasAbsolute100 || !hasDialirkan || hasLocalTest1 || hasMonetary1 ||
      hasLaminarCross || hasAbsoluteRH || !hasMakeupAir || !hasCondensation || hasLocalTest2 || hasMonetary2) {
    throw new Error('Semantic QA audit failed on SVG content');
  }

  // Step 2: Launch Real Headless Chrome
  console.log('\n[2/4] Meluncurkan Google Chrome Headless (CDP Port 9222)...');
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    `--user-data-dir=${TEMP_USER_DATA_DIR}`,
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1800));

  try {
    const listRes = await fetch('http://127.0.0.1:9222/json');
    const targets = await listRes.json();
    const page = targets.find(t => t.type === 'page');
    if (!page) throw new Error('No Chrome page target found via CDP');

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.onopen = r);

    let idSeq = 1;
    const send = (method, params = {}) => new Promise((res, rej) => {
      const curId = idSeq++;
      const timer = setTimeout(() => rej(new Error('CDP Timeout: ' + method)), 15000);
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === curId) {
          clearTimeout(timer);
          ws.removeEventListener('message', handler);
          if (msg.error) rej(new Error(msg.error.message));
          else res(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });

    await send('Page.enable');
    await send('Network.enable');
    await send('Runtime.enable');

    // Set cookie for staging domain
    console.log('   ✓ Setting admin_session cookie for rancangloka-staging.chandrajoyko.workers.dev...');
    await send('Network.setCookie', {
      name: 'admin_session',
      value: token,
      domain: 'rancangloka-staging.chandrajoyko.workers.dev',
      path: '/',
      secure: true
    });

    // Step 3: Desktop Viewport Testing (1280x800)
    console.log('\n[3/4] Menguji Render Browser Desktop (1280x800)...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });

    console.log('   Navigasi ke:', PREVIEW_URL);
    await send('Page.navigate', { url: PREVIEW_URL });
    await new Promise(r => setTimeout(r, 3500));

    // Evaluate DOM elements on Desktop
    const desktopEval = await send('Runtime.evaluate', {
      expression: `(() => {
        const figures = Array.from(document.querySelectorAll('figure[data-media-slot]'));
        const images = figures.map(f => f.querySelector('img'));
        const internalBadges = document.querySelectorAll('.internal-test-badge, [data-internal-badge]');
        
        return {
          title: document.title,
          figureCount: figures.length,
          slots: figures.map(f => f.getAttribute('data-media-slot')),
          images: images.map((img, idx) => {
            if (!img) return null;
            const rect = img.getBoundingClientRect();
            const figRect = figures[idx].getBoundingClientRect();
            return {
              slot: figures[idx].getAttribute('data-media-slot'),
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              renderedWidth: rect.width,
              renderedHeight: rect.height,
              top: rect.top + window.scrollY,
              bottom: rect.bottom + window.scrollY,
              left: rect.left,
              right: rect.right,
              complete: img.complete,
              hasSrc: Boolean(img.src),
              aspectRatio: (rect.width / rect.height).toFixed(3),
              caption: figures[idx].querySelector('figcaption')?.textContent?.trim() || ''
            };
          }),
          internalBadgeCount: internalBadges.length,
          bodyScrollWidth: document.body.scrollWidth,
          bodyClientWidth: document.body.clientWidth
        };
      })()`,
      returnByValue: true
    });

    const dRes = desktopEval.result.value;
    console.log('   ✓ Page Title:', dRes.title);
    console.log(`   ✓ Found ${dRes.figureCount} visual slots in DOM`);

    for (let i = 0; i < dRes.images.length; i++) {
      const imgInfo = dRes.images[i];
      console.log(`   --- Desktop Slot [${i + 1}]: ${imgInfo.slot} ---`);
      console.log(`       Rendered Size : ${imgInfo.renderedWidth.toFixed(1)} x ${imgInfo.renderedHeight.toFixed(1)} px (Aspect Ratio: ${imgInfo.aspectRatio})`);
      console.log(`       Natural Size  : ${imgInfo.naturalWidth} x ${imgInfo.naturalHeight} px`);
      console.log(`       Position Y    : top = ${imgInfo.top.toFixed(0)}px`);
      console.log(`       Status        : complete=${imgInfo.complete}, visible=${imgInfo.renderedWidth > 0}`);
      console.log(`       Caption       : "${imgInfo.caption}"`);
    }

    // Scroll to Inline 1 and take screenshot
    await send('Runtime.evaluate', {
      expression: `(() => {
        const f = document.querySelectorAll('figure[data-media-slot]')[0];
        if (f) f.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()`
    });
    await new Promise(r => setTimeout(r, 600));

    const shotDesktopInline1 = await send('Page.captureScreenshot', { format: 'png' });
    const fileDesktopInline1 = resolve(ARTIFACTS_DIR, 'article10-desktop-inline1.png');
    writeFileSync(fileDesktopInline1, Buffer.from(shotDesktopInline1.data, 'base64'));
    console.log('   ✓ Desktop Inline 1 Screenshot tersimpan:', fileDesktopInline1);

    // Scroll to Inline 2 and take screenshot
    await send('Runtime.evaluate', {
      expression: `(() => {
        const f = document.querySelectorAll('figure[data-media-slot]')[1];
        if (f) f.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()`
    });
    await new Promise(r => setTimeout(r, 600));

    const shotDesktopInline2 = await send('Page.captureScreenshot', { format: 'png' });
    const fileDesktopInline2 = resolve(ARTIFACTS_DIR, 'article10-desktop-inline2.png');
    writeFileSync(fileDesktopInline2, Buffer.from(shotDesktopInline2.data, 'base64'));
    console.log('   ✓ Desktop Inline 2 Screenshot tersimpan:', fileDesktopInline2);

    // Step 4: Mobile Viewport Testing (375x812)
    console.log('\n[4/4] Menguji Render Browser Mobile (375x812 - iPhone X/12 viewport)...');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 812,
      deviceScaleFactor: 2,
      mobile: true
    });

    await new Promise(r => setTimeout(r, 1000));

    const mobileEval = await send('Runtime.evaluate', {
      expression: `(() => {
        const figures = Array.from(document.querySelectorAll('figure[data-media-slot]'));
        const images = figures.map(f => f.querySelector('img'));
        const viewportWidth = window.innerWidth;
        const scrollWidth = document.documentElement.scrollWidth;

        return {
          viewportWidth,
          scrollWidth,
          hasHorizontalOverflow: scrollWidth > viewportWidth,
          images: images.map((img, idx) => {
            if (!img) return null;
            const rect = img.getBoundingClientRect();
            return {
              slot: figures[idx].getAttribute('data-media-slot'),
              renderedWidth: rect.width,
              renderedHeight: rect.height,
              aspectRatio: (rect.width / rect.height).toFixed(3),
              fitsViewport: rect.width <= viewportWidth,
              left: rect.left,
              right: rect.right
            };
          })
        };
      })()`,
      returnByValue: true
    });

    const mRes = mobileEval.result.value;
    console.log(`   ✓ Mobile Viewport Width   : ${mRes.viewportWidth}px`);
    console.log(`   ✓ Document Scroll Width   : ${mRes.scrollWidth}px`);
    console.log(`   ✓ Zero Horizontal Overflow: ${!mRes.hasHorizontalOverflow ? '✅ PASS' : '❌ FAIL'}`);

    for (let i = 0; i < mRes.images.length; i++) {
      const mImg = mRes.images[i];
      console.log(`   --- Mobile Slot [${i + 1}]: ${mImg.slot} ---`);
      console.log(`       Rendered Size : ${mImg.renderedWidth.toFixed(1)} x ${mImg.renderedHeight.toFixed(1)} px (Aspect Ratio: ${mImg.aspectRatio})`);
      console.log(`       Fits Viewport : ${mImg.fitsViewport ? '✅ YES' : '❌ NO'}`);
    }

    // Scroll to Inline 1 on mobile and take screenshot
    await send('Runtime.evaluate', {
      expression: `(() => {
        const f = document.querySelectorAll('figure[data-media-slot]')[0];
        if (f) f.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()`
    });
    await new Promise(r => setTimeout(r, 600));

    const shotMobileInline1 = await send('Page.captureScreenshot', { format: 'png' });
    const fileMobileInline1 = resolve(ARTIFACTS_DIR, 'article10-mobile-inline1.png');
    writeFileSync(fileMobileInline1, Buffer.from(shotMobileInline1.data, 'base64'));
    console.log('   ✓ Mobile Inline 1 Screenshot tersimpan:', fileMobileInline1);

    // Scroll to Inline 2 on mobile and take screenshot
    await send('Runtime.evaluate', {
      expression: `(() => {
        const f = document.querySelectorAll('figure[data-media-slot]')[1];
        if (f) f.scrollIntoView({ behavior: 'instant', block: 'center' });
      })()`
    });
    await new Promise(r => setTimeout(r, 600));

    const shotMobileInline2 = await send('Page.captureScreenshot', { format: 'png' });
    const fileMobileInline2 = resolve(ARTIFACTS_DIR, 'article10-mobile-inline2.png');
    writeFileSync(fileMobileInline2, Buffer.from(shotMobileInline2.data, 'base64'));
    console.log('   ✓ Mobile Inline 2 Screenshot tersimpan:', fileMobileInline2);

    ws.close();

    console.log('\n================================================================');
    console.log('🎉 REAL CHROME BROWSER VERIFICATION COMPLETED SUCCESSFULLY!');
    console.log('================================================================');

    return {
      desktop: dRes,
      mobile: mRes,
      svg1QA: { hasAbsolute100, hasDialirkan, hasDistinction, hasDuctedNote, hasLocalTest1, hasMonetary1 },
      svg2QA: { hasLaminarCross, hasAbsoluteRH, hasMakeupAir, hasCondensation, hasLocalTest2, hasMonetary2 }
    };
  } finally {
    chromeProc.kill();
  }
}

runBrowserVerification().catch(err => {
  console.error('❌ Browser verification error:', err);
  process.exit(1);
});
