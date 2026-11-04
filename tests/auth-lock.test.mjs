import test from 'node:test';
import assert from 'node:assert/strict';
import { browserAuthLock } from '../lib/authLock.mjs';

test('busy lock is delivered to Auth without rejecting the native callback', async () => {
  let outcome;
  const manager = { async request(name, options, callback) {
    assert.equal(options.mode, 'exclusive');
    assert.equal(options.ifAvailable, true);
    outcome = await callback(null);
    return outcome;
  } };
  await assert.rejects(browserAuthLock('session', 0, () => assert.fail('must not run without a lock'), manager), e => e.isAcquireTimeout === true);
  assert.deepEqual(outcome, { acquired: false });
});

test('operation failure stays observable after the native lock releases', async () => {
  const error = new Error('real operation failure');
  let callbackResolved = false;
  const manager = { async request(name, options, callback) {
    const outcome = await callback({ name });
    callbackResolved = true;
    return outcome;
  } };
  await assert.rejects(browserAuthLock('session', 100, async () => { throw error; }, manager), e => e === error);
  assert.equal(callbackResolved, true);
  assert.equal(await browserAuthLock('session', 100, async () => 42, manager), 42);
});

test('acquisition deadline aborts waiting instead of stealing an active session lock', async () => {
  const manager = { request(name, options) {
    assert.equal(options.steal, undefined);
    return new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  } };
  await assert.rejects(browserAuthLock('session', 10, () => assert.fail('must not enter'), manager), e => e.isAcquireTimeout === true);
});
