import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');

// Execute the actual browser modules with denied storage and no randomUUID.
function browser(storage, server = false) {
  const context = vm.createContext({
    ...(server ? {} : { window: Object.defineProperty({}, 'localStorage', { get: () => storage() }) }),
    crypto: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) },
  });
  const cache = new Map();
  function load(relative) {
    let filename = path.resolve(root, relative);
    if (!path.extname(filename)) filename += '.js';
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const require = (specifier) => specifier === 'uuid'
      ? { v4: load('node_modules/uuid/dist/v4.js').default }
      : load(path.resolve(path.dirname(filename), specifier));
    vm.runInContext(`(function(require, module, exports) { ${source}\n})`, context)(require, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('persists preferences and removes them when storage works', () => {
  const storage = memoryStorage();
  const api = browser(() => storage)('lib/browserStorage.js');
  api.setBrowserItem('country', 'cl');
  assert.equal(storage.getItem('country'), 'cl');
  assert.equal(api.getBrowserItem('country'), 'cl');
  api.removeBrowserItem('country');
  assert.equal(api.getBrowserItem('country'), null);
});

test('blocked localStorage getter does not crash country, branch or cart preferences', () => {
  const load = browser(() => { throw new DOMException('Blocked', 'SecurityError'); });
  const country = load('lib/countryRoutes.js');
  assert.equal(country.getSavedPublicCountrySlug(), '');
  country.savePublicCountrySlug('cl');
  assert.equal(country.getSavedPublicCountrySlug(), 'cl');
  const storage = load('lib/browserStorage.js');
  storage.setBrowserItem('streetwear.public_sucursal_id_cl', 'branch-1');
  assert.equal(storage.getBrowserItem('streetwear.public_sucursal_id_cl'), 'branch-1');
  storage.setBrowserItem('cart', '[{"user_id":1}]');
  assert.equal(storage.getBrowserItem('cart'), '[{"user_id":1}]');
  storage.removeBrowserItem('cart');
  assert.equal(storage.getBrowserItem('cart'), null);
});

test('full storage uses the new value, and failed removal does not resurrect old cart data', () => {
  const storage = memoryStorage();
  storage.setItem('cart', 'old');
  storage.setItem = () => { throw new DOMException('Full', 'QuotaExceededError'); };
  storage.removeItem = () => { throw new DOMException('Blocked', 'SecurityError'); };
  const api = browser(() => storage)('lib/browserStorage.js');
  api.setBrowserItem('cart', 'new');
  assert.equal(api.getBrowserItem('cart'), 'new');
  api.removeBrowserItem('cart');
  assert.equal(api.getBrowserItem('cart'), null);
});

test('cart token works without randomUUID or persistent storage and remains stable', () => {
  const load = browser(() => { throw new DOMException('Blocked', 'SecurityError'); });
  const token = load('lib/carritoToken.ts');
  const id = token.getCarritoToken();
  assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(token.getCarritoToken(), id);
  assert.equal(load('lib/browserStorage.js').getBrowserItem('carrito_token'), id);
});

test('retains the existing anonymous cart token', () => {
  const storage = memoryStorage();
  storage.setItem('carrito_token', 'existing-token');
  const token = browser(() => storage)('lib/carritoToken.ts');
  assert.equal(token.getCarritoToken(), 'existing-token');
});

test('server rendering does not access storage or retain browser data', () => {
  const load = browser(() => { throw new Error('Must not access storage'); }, true);
  const api = load('lib/browserStorage.js');
  api.setBrowserItem('country', 'cl');
  assert.equal(api.getBrowserItem('country'), null);
  assert.equal(load('lib/carritoToken.ts').getCarritoToken(), null);
});
