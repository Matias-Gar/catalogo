import { firefox } from '@playwright/test';
import fs from 'node:fs/promises';
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const report = { console: [], errors: [], responses: [], failures: [], requests: [] };
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') report.console.push(m.text()); });
page.on('pageerror', e => report.errors.push(e.message));
page.on('request', r => report.requests.push(r.url()));
page.on('requestfailed', r => report.failures.push({ url: r.url(), error: r.failure()?.errorText }));
page.on('response', r => { if (r.status() >= 400) report.responses.push({ url: r.url(), status: r.status() }); });
try {
  await page.goto('http://127.0.0.1:3000/bo', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(15000);
  report.text = (await page.locator('body').innerText()).slice(0, 4000);
  await page.screenshot({ path: 'docs/audit-2026-11-04/firefox-diagnostic.png', fullPage: true });
} finally {
  await fs.writeFile('docs/audit-2026-11-04/firefox-diagnostic.json', JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ errors: report.errors, console: report.console, failures: report.failures, responses: report.responses, text: report.text?.slice(0, 300) }));
