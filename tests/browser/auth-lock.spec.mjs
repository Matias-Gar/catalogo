import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('Auth lock preserves exclusion across tabs and reports failures only to its caller', async ({ context, page }) => {
  const errors = [];
  let activeOwner = null;
  await context.exposeBinding('auditEnterLock', (_source, owner) => {
    if (activeOwner !== null) throw new Error('Concurrent session operation');
    activeOwner = owner;
  });
  await context.exposeBinding('auditExitLock', (_source, owner) => {
    if (activeOwner !== owner) throw new Error('Lock lost');
    activeOwner = null;
  });
  const other = await context.newPage();
  for (const tab of [page, other]) tab.on('pageerror', error => errors.push(error.message));
  const source = fs.readFileSync('lib/authLock.mjs', 'utf8').replace(/^import .*;\r?\n/, '').replace('export async function', 'async function');
  const dependencies = `class NavigatorLockAcquireTimeoutError extends Error { isAcquireTimeout = true; }\nconst processLock = () => { throw new Error('Native lock expected'); };\n`;
  for (const tab of [page, other]) {
    await tab.route('**/audit-lock-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Lock fixture</title>' }));
    await tab.goto('/audit-lock-fixture');
    await tab.addScriptTag({ content: dependencies + source });
  }
  const run = (tab, owner) => tab.evaluate(async owner => {
    for (let i = 0; i < 5; i++) await window.browserAuthLock('audit-session-lock', 5000, async () => {
      await window.auditEnterLock(owner);
      await new Promise(resolve => setTimeout(resolve, 20));
      await window.auditExitLock(owner);
    });
  }, owner);
  await Promise.all([run(page, 'one'), run(other, 'two')]);
  expect(activeOwner).toBeNull();
  const outcome = await page.evaluate(async () => {
    try { await window.browserAuthLock('audit-session-lock', 0, async () => { throw new Error('Visible failure'); }); }
    catch (error) { return error.message; }
  });
  expect(outcome).toBe('Visible failure');
  expect(errors).toEqual([]);
});
