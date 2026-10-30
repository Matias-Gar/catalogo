import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

for (const route of ['forgot-password', 'validate-reset-code']) {
  test(`${route} rejects legacy password changes without accessing credentials or Auth`, async () => {
    const source = fs.readFileSync(new URL(`../app/api/auth/${route}/route.ts`, import.meta.url), 'utf8');
    const exports = {};
    const code = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(code, {
      exports,
      require(name) {
        assert.equal(name, 'next/server', 'Retired routes must not access a privileged client');
        return { NextResponse: { json: (body, options) => ({ body, ...options }) } };
      },
    });
    for (const payload of [
      { email: 'victim@example.invalid', newPassword: 'attacker-password' },
      { email: 'victim@example.invalid', ci: '123456', newPassword: 'attacker-password' },
      { email: 'victim@example.invalid', code: '123456', nueva_contrasena: 'attacker-password' },
    ]) {
      const response = await exports.POST({ json: async () => payload });
      assert.equal(response.status, 410);
      assert.equal(response.body.success, undefined);
    }
  });
}
