import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// auth-js 2.103.0 starts its initial subscription task without handling its
// promise. A legitimate lock timeout then escapes as an unhandled rejection.
// Keep operation errors and locking unchanged; handle only that background task.
const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve('@supabase/auth-js/package.json'));
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
if (version !== '2.103.0') throw new Error('Review Auth subscription patch against the new SDK before building');
for (const format of ['main', 'module']) {
  const file = path.join(root, 'dist', format, 'GoTrueClient.js');
  const original = fs.readFileSync(file, 'utf8');
  const before = `this.stateChangeEmitters.set(id, subscription);
        (async () => {
            await this.initializePromise;
            await this._acquireLock(this.lockAcquireTimeout, async () => {
                this._emitInitialSession(id);
            });
        })();`;
  const after = `this.stateChangeEmitters.set(id, subscription);
        (async () => {
            await this.initializePromise;
            await this._acquireLock(this.lockAcquireTimeout, async () => {
                await this._emitInitialSession(id);
            });
        })().catch((error) => {
            // catalogo: contain background subscription failures, never credentials.
            console.warn('auth_initial_subscription_failed', {
                operation: 'initial_session',
                lock_busy: error?.isAcquireTimeout === true
            });
        });`;
  if (original.includes(after)) continue;
  if (!original.includes(before)) throw new Error(`Auth subscription patch no longer matches ${format}`);
  fs.writeFileSync(file, original.replace(before, after));
}
