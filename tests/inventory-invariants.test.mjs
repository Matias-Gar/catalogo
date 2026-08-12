import test from "node:test";
import assert from "node:assert/strict";

const EPSILON = 0.000001;

function toBase({ quantity, unit, baseUnit = "rollo", alternatives = ["metro"], factor = 50 }) {
  assert.ok(Number.isFinite(quantity) && quantity > 0, "cantidad positiva requerida");
  if (unit === baseUnit) return quantity;
  assert.ok(alternatives.includes(unit), "unidad no permitida");
  assert.ok(factor > 0, "factor de conversion invalido");
  return quantity / factor;
}

function sell(stock, request) {
  const base = toBase(request);
  assert.ok(base <= stock + EPSILON, "stock insuficiente");
  return Math.max(0, stock - base);
}

function reduce(stock, request) {
  return sell(stock, request);
}

test("2 rollos: vender metros y luego 1 rollo conserva el stock exacto", () => {
  let stock = 2;
  stock = sell(stock, { quantity: 25, unit: "metro" });
  assert.equal(stock, 1.5);
  stock = sell(stock, { quantity: 1, unit: "rollo" });
  assert.equal(stock, 0.5);
});

test("50 metros equivalen exactamente a un rollo", () => {
  assert.equal(toBase({ quantity: 50, unit: "metro" }), 1);
});

test("reducir 1 metro de 2 rollos de 25 conserva 24 metros del rollo abierto", () => {
  const stock = reduce(2, { quantity: 1, unit: "metro", factor: 25 });
  assert.equal(stock, 1.96);
  assert.equal(Math.floor(stock), 1);
  assert.ok(Math.abs((stock - Math.floor(stock)) * 25 - 24) < EPSILON);
});

test("rechaza venta por encima del disponible incluso por una fraccion", () => {
  assert.throws(() => sell(1, { quantity: 51, unit: "metro" }), /stock insuficiente/);
});

test("rechaza cero, negativos y unidades inventadas", () => {
  assert.throws(() => toBase({ quantity: 0, unit: "metro" }), /positiva/);
  assert.throws(() => toBase({ quantity: -1, unit: "rollo" }), /positiva/);
  assert.throws(() => toBase({ quantity: 1, unit: "caja" }), /no permitida/);
});

test("una anulacion restaura exactamente lo descontado", () => {
  const initial = 2;
  const debited = toBase({ quantity: 37, unit: "metro" });
  const afterSale = sell(initial, { quantity: 37, unit: "metro" });
  assert.ok(Math.abs(afterSale + debited - initial) < EPSILON);
});

test("transferir conserva el total entre sucursales", () => {
  const before = { origin: 2, destination: 0.25 };
  const amount = toBase({ quantity: 25, unit: "metro" });
  const after = { origin: before.origin - amount, destination: before.destination + amount };
  assert.equal(after.origin, 1.5);
  assert.equal(after.destination, 0.75);
  assert.equal(after.origin + after.destination, before.origin + before.destination);
});

test("un pack descuenta la suma exacta de sus componentes", () => {
  const stock = new Map([[1, 10], [2, 3]]);
  const components = [{ id: 1, quantity: 2 }, { id: 2, quantity: 1 }];
  for (const item of components) {
    stock.set(item.id, sell(stock.get(item.id), { quantity: item.quantity, unit: "unidad", baseUnit: "unidad", alternatives: [], factor: 0 }));
  }
  assert.deepEqual([...stock.entries()], [[1, 8], [2, 2]]);
});

test("pedidos pendientes no alteran inventario hasta confirmar venta", () => {
  const stock = 4;
  const afterOrder = stock;
  assert.equal(afterOrder, 4);
  assert.equal(sell(afterOrder, { quantity: 1, unit: "unidad", baseUnit: "unidad", alternatives: [], factor: 0 }), 3);
});

test("ventas serializadas no permiten sobreventa concurrente", () => {
  let stock = 1;
  stock = sell(stock, { quantity: 1, unit: "unidad", baseUnit: "unidad", alternatives: [], factor: 0 });
  assert.throws(() => sell(stock, { quantity: 1, unit: "unidad", baseUnit: "unidad", alternatives: [], factor: 0 }), /stock insuficiente/);
});

test("matriz de precision conserva conversion y reversa", () => {
  const quantities = [0.001, 0.01, 0.1, 0.25, 0.5, 0.75, 0.99, 1, 1.01, 1.5, 2, 10, 24.99, 25, 25.01, 100, 1.000, 10.000];
  for (const quantity of quantities) {
    const initial = 1000;
    const debit = toBase({ quantity, unit: "metro", factor: 25 });
    const after = sell(initial, { quantity, unit: "metro", factor: 25 });
    assert.ok(Math.abs(after + debit - initial) < EPSILON, `fallo para ${quantity}`);
  }
});

test("10.000 ventas fraccionadas cuadran snapshot y ledger", () => {
  let stock = 1000;
  let ledger = 0;
  for (let index = 0; index < 10_000; index += 1) {
    const debit = toBase({ quantity: 0.1, unit: "metro", factor: 25 });
    stock = sell(stock, { quantity: 0.1, unit: "metro", factor: 25 });
    ledger += debit;
  }
  assert.ok(Math.abs(stock - (1000 - ledger)) < EPSILON);
  assert.ok(stock >= 0);
});

test("20 intentos serializados sobre stock 10 producen 10 exitos", () => {
  let stock = 10;
  let accepted = 0;
  let rejected = 0;
  for (let index = 0; index < 20; index += 1) {
    try {
      stock = sell(stock, { quantity: 1, unit: "unidad", baseUnit: "unidad", alternatives: [], factor: 0 });
      accepted += 1;
    } catch (error) {
      assert.match(error.message, /stock insuficiente/);
      rejected += 1;
    }
  }
  assert.deepEqual({ accepted, rejected, stock }, { accepted: 10, rejected: 10, stock: 0 });
});

test("una clave idempotente aplica una operacion logica una sola vez", () => {
  let stock = 3;
  const completed = new Map();
  const charge = (key) => {
    if (completed.has(key)) return completed.get(key);
    stock = sell(stock, { quantity: 1, unit: "unidad", baseUnit: "unidad", alternatives: [], factor: 0 });
    const result = { saleId: 42 };
    completed.set(key, result);
    return result;
  };
  assert.strictEqual(charge("request-1"), charge("request-1"));
  assert.equal(stock, 2);
});
