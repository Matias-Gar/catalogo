import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

for (const [file, hook] of [['packs.js', 'usePacks'], ['usePromociones.js', 'usePromociones']]) {
  test(`${hook}: consumers own separate channels, clean them up and ignore late requests`, async () => {
    const effects = [], channels = [], removed = [], states = [];
    let resolveRead;
    const read = new Promise(resolve => { resolveRead = resolve; });
    const query = new Proxy({}, { get: (_target, method) => method === 'then' ? read.then.bind(read) : () => query });
    const client = {
      from: () => query,
      channel(topic) {
        const existing = channels.find(channel => channel.topic === topic);
        if (existing) return existing;
        const value = { topic, on() { return this; }, subscribe() { return this; } }; channels.push(value); return value;
      },
      removeChannel(value) { removed.push(value); return Promise.resolve('ok'); },
    };
    const exports = {};
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(`lib/${file}`, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
    }).outputText, {
      exports, Date, console,
      require(name) {
        if (name === 'react') return { useId: () => String(effects.length), useState: value => [value, next => states.push(next)], useEffect: effect => effects.push(effect) };
        if (name === './supabasePublic') return { publicSupabase: client };
        if (name === './catalogRequest') return { runCatalogQuery: () => read };
        throw Error('Unexpected dependency: ' + name);
      },
    });
    exports[hook]('branch-one'); exports[hook]('branch-two');
    const first = effects[0](), second = effects[1]();
    assert.equal(channels.length, 2);
    first();
    assert.equal(removed.length, 1); assert.equal(removed[0], channels[0]);
    assert.notEqual(channels[0], channels[1]);
    second();
    const count = states.length;
    resolveRead({ data: [], error: null });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(states.length, count, 'late responses after cleanup must not update state');
    assert.equal(removed[1], channels[1]);
  });
}
