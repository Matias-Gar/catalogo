import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient, NavigatorLockAcquireTimeoutError } from '@supabase/supabase-js';

test('SDK initial subscribers contain a busy lock while session callers still receive the failure', async () => {
  const warnings = [];
  const warn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    const client = createClient('https://auth-fixture.supabase.co', 'anonymous-fixture', {
      auth: { persistSession: false, autoRefreshToken: false,
        lock: async () => { throw new NavigatorLockAcquireTimeoutError('busy fixture'); } },
    });
    const { data: { subscription } } = client.auth.onAuthStateChange(() => assert.fail('No session was read'));
    await assert.rejects(client.auth.getSession(), error => error.isAcquireTimeout === true);
    // Allow both SDK background subscriptions to settle; node:test also fails
    // this test on any unhandled rejection outside the caller's promise.
    await new Promise(resolve => setTimeout(resolve, 20));
    subscription.unsubscribe();
    assert.equal(warnings.filter(([event]) => event === 'auth_initial_subscription_failed').length, 2);
    assert.ok(warnings.every(args => !JSON.stringify(args).includes('busy fixture')));
  } finally { console.warn = warn; }
});
