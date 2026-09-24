import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (await readFile(new URL("../app/api/admin/productos/cambiar-categoria/route.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "").replace(/export async function /g, "async function ");

function setup({ denied = false, inactive = false } = {}) {
  const rows = [
    { user_id: 1, pais_id: "bo", sucursal_id: "a", vista_producto: "articulos", category_id: 7, categoria: "Parejas", stock: 2.5, precio: 30, imagen_url: "photo", archivado: false },
    { user_id: 2, pais_id: "bo", sucursal_id: "b", vista_producto: "articulos", category_id: 7, categoria: "Parejas", stock: 8 },
    { user_id: 3, pais_id: "bo", sucursal_id: "a", vista_producto: "articulos", archivado: true },
  ];
  const mutations = [];
  const db = { from(table) {
    const filters = [];
    let payload;
    const query = {
      select() { return this; },
      eq(key, value) { filters.push((row) => row[key] === value); return this; },
      or() { filters.push((row) => row.archivado !== true); return this; },
      in(key, values) { filters.push((row) => values.includes(row[key])); return this; },
      update(value) { payload = value; mutations.push(value); return this; },
      maybeSingle() {
        const candidates = table === "sucursales"
          ? [{ id: "a", pais_id: "bo", activa: true }]
          : inactive ? [] : [{ id: 8, categori: "Placas", pais_id: "bo", sucursal_id: "a" }, { id: 9, categori: "Otra", pais_id: "bo", sucursal_id: "b" }];
        return Promise.resolve({ data: candidates.find((row) => filters.every((filter) => filter(row))) || null });
      },
      then(resolve, reject) {
        const matched = rows.filter((row) => filters.every((filter) => filter(row)));
        if (payload) matched.forEach((row) => Object.assign(row, payload));
        return Promise.resolve({ data: matched }).then(resolve, reject);
      },
    };
    return query;
  } };
  const api = new Function("NextResponse", "supabaseAdmin", "requireAdminAccess", `${source}\nreturn { POST };`)(
    { json: (body, options) => ({ body, status: options?.status || 200 }) }, db,
    async () => denied ? { error: "No autorizado", status: 403 } : { role: "admin" },
  );
  const post = (overrides = {}) => api.POST({ json: async () => ({ paisId: "bo", sucursalId: "a", productIds: [1], destino: 8, ...overrides }) });
  return { rows, mutations, post };
}

test("cambia categoría conservando sección, identidad, stock, precio e imagen y limita la sucursal", async () => {
  const { rows, mutations, post } = setup();
  const before = structuredClone(rows);
  const result = await post({ productIds: [1, 2, 3] });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.movedIds, [1]);
  assert.deepEqual(rows, [{ ...before[0], category_id: 8, categoria: "Placas" }, before[1], before[2]]);
  assert.deepEqual(mutations, [{ category_id: 8, categoria: "Placas" }]);
});

test("rechaza usuarios sin permiso sin modificar artículos", async () => {
  const { post, mutations } = setup({ denied: true });
  assert.equal((await post()).status, 403);
  assert.equal(mutations.length, 0);
});

test("rechaza categorías inexistentes y selecciones inválidas", async () => {
  const inactive = setup({ inactive: true });
  assert.equal((await inactive.post()).status, 400);
  assert.equal(inactive.mutations.length, 0);
  for (const productIds of [[], [-1], ["1"], Array(501).fill(1)]) {
    const { post, mutations } = setup();
    assert.equal((await post({ productIds })).status, 400);
    assert.equal(mutations.length, 0);
  }
});

test("no comunica éxito si ningún artículo está disponible", async () => {
  assert.equal((await setup().post({ productIds: [2, 3] })).status, 409);
});

 test("rejects categories from another branch and invalid destinations", async () => {
  for (const destino of [9, 999, null, "8", -1, 1.5]) {
    const { post, mutations } = setup();
    assert.equal((await post({ destino })).status, 400);
    assert.equal(mutations.length, 0);
  }
});
