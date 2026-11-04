import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual module-scope stock formatters. They previously called a
// function scoped inside the React component and crashed every populated list.
const text = fs.readFileSync(new URL('../app/admin/inventario/stock/page.js', import.meta.url), 'utf8');
const ast = ts.createSourceFile('stock.js', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JSX);
const source = ast.statements.filter(n => ts.isFunctionDeclaration(n) && !n.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword))
  .map(n => n.getText(ast)).join('\n');
const context = vm.createContext({});
vm.runInContext(source, context);

test('stock rows and printable descriptions format ordinary and fractional quantities', () => {
  assert.equal(context.getReadableStockText({ stock: 5, unidad_base: 'unidad' }), '5 unidad');
  const product = { stock: 1.5, unidad_base: 'rollo', unidades_alternativas: ['metro'], factor_conversion: 10 };
  assert.match(context.getReadableStockText(product), /1 rollo.*5 metro/);
  assert.equal(context.formatQuantity(NaN), '0');
});
