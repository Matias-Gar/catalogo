import { processLock, NavigatorLockAcquireTimeoutError } from '@supabase/supabase-js';

// Return an outcome from the native callback, then deliver errors to Auth's
// caller outside it. Firefox otherwise also reports callback rejections as
// page errors, even when Auth handles the expected "lock busy" result.
// Exclusive cross-tab locking and real operation failures are preserved.
export async function browserAuthLock(name, acquireTimeout, task, manager = globalThis.navigator?.locks) {
  if (!manager) return processLock(name, acquireTimeout, task);
  const controller = new AbortController();
  let timer;
  if (acquireTimeout > 0) timer = setTimeout(() => controller.abort(), acquireTimeout);
  try {
    const outcome = await manager.request(name, acquireTimeout === 0
      ? { mode: 'exclusive', ifAvailable: true }
      : { mode: 'exclusive', signal: controller.signal }, async lock => {
      clearTimeout(timer);
      if (!lock) return { acquired: false };
      try { return { acquired: true, value: await task() }; }
      catch (error) { return { acquired: true, failed: true, error }; }
    });
    if (!outcome.acquired) throw new NavigatorLockAcquireTimeoutError(`Auth lock "${name}" is busy`);
    if (outcome.failed) throw outcome.error;
    return outcome.value;
  } catch (error) {
    if (controller.signal.aborted) throw new NavigatorLockAcquireTimeoutError(`Auth lock "${name}" acquisition timed out`);
    throw error;
  } finally { clearTimeout(timer); }
}
