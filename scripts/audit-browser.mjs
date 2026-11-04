import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const base = process.env.AUDIT_URL || 'https://catalogo-sigma-one.vercel.app';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const report = { base, timestamp: new Date().toISOString(), errors: [], failures: [], responses: [], pages: [] };
page.on('pageerror', e => report.errors.push(e.message));
page.on('requestfailed', r => report.failures.push({ url: r.url(), error: r.failure()?.errorText }));
page.on('response', async r => {
  if (r.status() >= 400) report.responses.push({ url: r.url(), status: r.status(), requestHeaders: r.request().headers(), headers: r.headers(), timing: r.request().timing(), body: (await r.text().catch(() => '')).slice(0, 500) });
});
await page.addInitScript(() => {
  window.auditVitals = { lcp: null, cls: 0 };
  new PerformanceObserver(list => { for (const e of list.getEntries()) window.auditVitals.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver(list => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.auditVitals.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
});
try {
  for (const path of (process.env.AUDIT_PATHS || '/bo').split(',')) {
    const start = Date.now();
    await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(12000);
    for (let i = 0; i < 30; i++) {
      await page.evaluate(() => window.scrollBy(0, 700));
      await page.waitForTimeout(300);
    }
    await page.waitForTimeout(6000);
    report.pages.push({ path, elapsedMs: Date.now() - start, ...await page.evaluate(() => ({
      title: document.title, vitals: window.auditVitals,
      overflow: document.documentElement.scrollWidth > innerWidth,
      images: [...document.images].map(i => ({ src: i.currentSrc, width: i.naturalWidth, complete: i.complete, loading: i.loading })),
      resources: performance.getEntriesByType('resource').filter(r => /image|catalog|storage/.test(r.name)).map(r => ({ url: r.name, duration: r.duration, transferSize: r.transferSize, encodedBodySize: r.encodedBodySize })),
    })) });
  }
  await page.screenshot({ path: `docs/audit-2026-11-04/${process.env.AUDIT_LABEL || 'production-before'}.png`, fullPage: true });
} finally {
  await fs.writeFile(`docs/audit-2026-11-04/${process.env.AUDIT_LABEL || 'production-before'}.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ pages: report.pages.map(p => ({ path: p.path, images: p.images.length, broken: p.images.filter(i => i.src && i.complete && !i.width).length, deferred: p.images.filter(i => !i.src).length, vitals: p.vitals })), errors: report.errors.length, responses: report.responses.length, failures: report.failures.length }));
