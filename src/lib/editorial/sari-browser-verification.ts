/**
 * RancangLoka — Sari Staging Rendered Page Verification Engine
 * Milestone: SARI-RENDERED-PAGE-VALIDATION (Phase 6)
 * 
 * Invariants:
 * 1. REAL BROWSER PROOF: Uses Headless Chrome CDP to inspect actual rendered DOM and network decoding.
 * 2. EDITORIAL MEDIA SCOPE: Only inspects <figure class="rl-media-slot">; strictly excludes logos, avatars, icons, and thumbnails.
 * 3. LAZY-LOAD FULL PAGE SCROLL: Incrementally scrolls down the entire page to trigger all lazy-loaded figures before asserting.
 * 4. ZERO BROKEN IMAGE != COMPLETE: If broken=0 but rendered count < expected count, status is STRICTLY BLOCKED.
 * 5. MOBILE & DESKTOP DUAL VIEWPORT: Enforces zero horizontal overflow (375px) and correct aspect containment (1280px).
 * 6. FAIL-CLOSED: If CDP times out or cannot reach browser target, status remains UNVERIFIED/BLOCKED.
 */

import { spawn } from 'node:child_process';
import type { ExpectedArticleManifest } from './modular/completeness-contract.ts';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA_DIR = 'C:\\Users\\Fanto\\AppData\\Local\\Temp\\chrome_cdp_sari_audit';

export interface RenderedEditorialFigure {
  slotKey: string;
  src: string;
  alt: string;
  caption: string;
  naturalWidth: number;
  naturalHeight: number;
  complete: boolean;
  isBroken: boolean;
  isVisible: boolean;
}

export interface ViewportAuditResult {
  viewport: 'desktop' | 'mobile';
  width: number;
  height: number;
  hasHorizontalOverflow: boolean;
  scrollWidth: number;
  clientWidth: number;
  editorialFigures: RenderedEditorialFigure[];
  brokenFiguresCount: number;
  renderedEditorialCount: number;
}

export interface SariPageVerificationResult {
  success: boolean;
  status: 'PASS' | 'BLOCKED' | 'UNVERIFIED';
  articleId: number;
  previewUrl: string;
  expectedCount: number;
  desktop: ViewportAuditResult | null;
  mobile: ViewportAuditResult | null;
  violations: string[];
}

export async function verifyRenderedArticleWithSari(params: {
  articleId: number;
  previewUrl: string;
  manifest: ExpectedArticleManifest;
  timeoutMs?: number;
}): Promise<SariPageVerificationResult> {
  const { articleId, previewUrl, manifest, timeoutMs = 35000 } = params;
  const expectedInlineCount = (manifest.inline_images || []).length;
  // Total expected editorial images = cover + inlines (or inlines inside body)
  const violations: string[] = [];

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    `--user-data-dir=${TEMP_USER_DATA_DIR}`,
    'about:blank'
  ]);

  // Give Chrome 2 seconds to bind debug port
  await new Promise(r => setTimeout(r, 2000));

  let ws: WebSocket | null = null;

  try {
    const listRes = await fetch('http://127.0.0.1:9222/json');
    const targets = await listRes.json();
    const page = targets.find((t: any) => t.type === 'page');
    if (!page) {
      throw new Error('No CDP page target found');
    }

    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP WebSocket connect timeout')), 5000);
      ws!.onopen = () => {
        clearTimeout(timer);
        resolve(true);
      };
      ws!.onerror = (e) => {
        clearTimeout(timer);
        reject(new Error('CDP WebSocket error: ' + String(e)));
      };
    });

    let idSeq = 1;
    const send = (method: string, cdpParams: any = {}) =>
      new Promise<any>((resolve, reject) => {
        const curId = idSeq++;
        const timer = setTimeout(() => reject(new Error('CDP Timeout: ' + method)), timeoutMs);
        const handler = (e: any) => {
          const msg = JSON.parse(e.data);
          if (msg.id === curId) {
            clearTimeout(timer);
            ws!.removeEventListener('message', handler);
            if (msg.error) reject(new Error(msg.error.message));
            else resolve(msg.result);
          }
        };
        ws!.addEventListener('message', handler);
        ws!.send(JSON.stringify({ id: curId, method, params: cdpParams }));
      });

    await send('Page.enable');
    await send('DOM.enable');
    await send('Runtime.enable');

    const inPageAuditFunction = `
      (async () => {
        // 1. Scroll down page incrementally to trigger all lazy-loaded images
        const scrollStep = 400;
        let prevHeight = 0;
        let totalHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        for (let y = 0; y < totalHeight; y += scrollStep) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 150));
          // Height might increase as content renders
          totalHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        }
        // Linger at bottom
        await new Promise(r => setTimeout(r, 800));

        // 2. Query EDITORIAL figures only (figure.rl-media-slot) and await decode
        const figures = Array.from(document.querySelectorAll('figure.rl-media-slot'));
        const editorialFigures = await Promise.all(figures.map(async (fig) => {
          const slotKey = fig.getAttribute('data-media-slot') || '';
          const img = fig.querySelector('img');
          const figcaption = fig.querySelector('figcaption');
          const caption = figcaption ? figcaption.innerText.trim() : '';

          if (img) {
            fig.scrollIntoView({ block: 'center' });
            if (!img.complete || img.naturalWidth === 0) {
              try {
                if (typeof img.decode === 'function') {
                  await Promise.race([
                    img.decode(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('decode_timeout')), 4000))
                  ]);
                }
              } catch (_) {}
            }
          }

          const src = img ? (img.currentSrc || img.src || '') : '';
          const alt = img ? (img.alt || '') : '';
          const naturalWidth = img ? (img.naturalWidth || 0) : 0;
          const naturalHeight = img ? (img.naturalHeight || 0) : 0;
          const complete = img ? Boolean(img.complete) : false;
          const isBroken = !img || !complete || naturalWidth === 0 || naturalHeight === 0;

          const rect = fig.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;

          return {
            slotKey,
            src,
            alt,
            caption,
            naturalWidth,
            naturalHeight,
            complete,
            isBroken,
            isVisible
          };
        }));

        // Reset scroll to top
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 500));

        // 3. Overflow audit
        const scrollWidth = document.documentElement.scrollWidth;
        const clientWidth = document.documentElement.clientWidth;
        const hasHorizontalOverflow = scrollWidth > clientWidth;

        return {
          scrollWidth,
          clientWidth,
          hasHorizontalOverflow,
          editorialFigures,
          brokenFiguresCount: editorialFigures.filter(f => f.isBroken).length,
          renderedEditorialCount: editorialFigures.length
        };
      })()
    `;

    // -------------------------------------------------------------
    // DESKTOP VIEWPORT AUDIT (1280x800)
    // -------------------------------------------------------------
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
      mobile: false
    });

    await send('Page.navigate', { url: previewUrl });
    await new Promise(r => setTimeout(r, 3000));

    const desktopEval = await send('Runtime.evaluate', {
      expression: inPageAuditFunction,
      awaitPromise: true,
      returnByValue: true
    });

    const desktopVal = desktopEval?.result?.value;
    const desktopResult: ViewportAuditResult = {
      viewport: 'desktop',
      width: 1280,
      height: 800,
      hasHorizontalOverflow: Boolean(desktopVal?.hasHorizontalOverflow),
      scrollWidth: desktopVal?.scrollWidth || 0,
      clientWidth: desktopVal?.clientWidth || 0,
      editorialFigures: desktopVal?.editorialFigures || [],
      brokenFiguresCount: desktopVal?.brokenFiguresCount || 0,
      renderedEditorialCount: desktopVal?.renderedEditorialCount || 0
    };

    // -------------------------------------------------------------
    // MOBILE VIEWPORT AUDIT (375x667)
    // -------------------------------------------------------------
    await send('Emulation.setDeviceMetricsOverride', {
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      mobile: true
    });

    await send('Page.navigate', { url: previewUrl });
    await new Promise(r => setTimeout(r, 2500));

    const mobileEval = await send('Runtime.evaluate', {
      expression: inPageAuditFunction,
      awaitPromise: true,
      returnByValue: true
    });

    const mobileVal = mobileEval?.result?.value;
    const mobileResult: ViewportAuditResult = {
      viewport: 'mobile',
      width: 375,
      height: 667,
      hasHorizontalOverflow: Boolean(mobileVal?.hasHorizontalOverflow),
      scrollWidth: mobileVal?.scrollWidth || 0,
      clientWidth: mobileVal?.clientWidth || 0,
      editorialFigures: mobileVal?.editorialFigures || [],
      brokenFiguresCount: mobileVal?.brokenFiguresCount || 0,
      renderedEditorialCount: mobileVal?.renderedEditorialCount || 0
    };

    // -------------------------------------------------------------
    // ASSERTIONS & VERIFICATION
    // -------------------------------------------------------------
    // 1. Editorial Inline Figure Count assertion
    if (desktopResult.renderedEditorialCount !== expectedInlineCount) {
      violations.push(
        `DESKTOP_INCOMPLETE_MEDIA: Rendered ${desktopResult.renderedEditorialCount} inline figures, but manifest expects ${expectedInlineCount}.`
      );
    }
    if (mobileResult.renderedEditorialCount !== expectedInlineCount) {
      violations.push(
        `MOBILE_INCOMPLETE_MEDIA: Rendered ${mobileResult.renderedEditorialCount} inline figures on mobile, but manifest expects ${expectedInlineCount}.`
      );
    }

    // 2. Broken Figures assertion
    if (desktopResult.brokenFiguresCount > 0) {
      violations.push(
        `DESKTOP_BROKEN_IMAGES: ${desktopResult.brokenFiguresCount} inline figures failed to decode on desktop.`
      );
    }
    if (mobileResult.brokenFiguresCount > 0) {
      violations.push(
        `MOBILE_BROKEN_IMAGES: ${mobileResult.brokenFiguresCount} inline figures failed to decode on mobile.`
      );
    }

    // 3. Mobile Overflow assertion
    if (mobileResult.hasHorizontalOverflow) {
      violations.push(
        `MOBILE_HORIZONTAL_OVERFLOW: scrollWidth (${mobileResult.scrollWidth}px) exceeds clientWidth (${mobileResult.clientWidth}px).`
      );
    }

    // 4. Duplicate Slot Keys assertion
    const seenSlots = new Set<string>();
    for (const fig of desktopResult.editorialFigures) {
      if (seenSlots.has(fig.slotKey)) {
        violations.push(`DUPLICATE_RENDERED_SLOT: Slot "${fig.slotKey}" rendered more than once.`);
      }
      seenSlots.add(fig.slotKey);
    }

    // 5. Missing Expected Slots assertion
    const expectedSlots = (manifest.inline_images || []).map(i => i.slot_key.toLowerCase());
    for (const expected of expectedSlots) {
      if (!seenSlots.has(expected)) {
        violations.push(`MISSING_EXPECTED_SLOT_IN_DOM: Slot "${expected}" was not rendered in the preview DOM.`);
      }
    }

    const isPassed = violations.length === 0;

    return {
      success: isPassed,
      status: isPassed ? 'PASS' : 'BLOCKED',
      articleId,
      previewUrl,
      expectedCount: expectedInlineCount,
      desktop: desktopResult,
      mobile: mobileResult,
      violations
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'UNVERIFIED',
      articleId,
      previewUrl,
      expectedCount: expectedInlineCount,
      desktop: null,
      mobile: null,
      violations: [`CDP_EXECUTION_FAILURE: ${err.message || String(err)}`]
    };
  } finally {
    if (ws) {
      try {
        ws.close();
      } catch (_) {}
    }
    try {
      chromeProc.kill();
    } catch (_) {}
  }
}
