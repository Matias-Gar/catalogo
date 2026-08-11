import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltan credenciales de Supabase para auditoria de solo lectura");

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const EPSILON = 0.0001;

async function readAll(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < 1000) return rows;
  }
}

const [products, variants, movements, details, transfers] = await Promise.all([
  readAll("productos", "user_id,nombre,pais_id,sucursal_id,stock,archivado"),
  readAll("producto_variantes", "id,producto_id,color,stock,stock_decimal,activo,sucursal_id"),
  readAll("stock_movimientos", "id,producto_id,variante_id,tipo,cantidad_base,stock_antes,stock_despues,venta_id,detalle_id,metadata,created_at"),
  readAll("ventas_detalle", "id,venta_id,producto_id,variante_id,cantidad,cantidad_base"),
  readAll("transferencias_sucursal", "id,cantidad_base"),
]);

const issues = [];
const movementByDetail = new Map();
for (const movement of movements) {
  if (movement.detalle_id != null && ["venta", "venta_anulada"].includes(movement.tipo)) {
    const keyDetail = String(movement.detalle_id);
    movementByDetail.set(keyDetail, (movementByDetail.get(keyDetail) || 0) + 1);
  }
  const before = Number(movement.stock_antes);
  const after = Number(movement.stock_despues);
  const qty = Number(movement.cantidad_base);
  if ([before, after, qty].every(Number.isFinite)) {
    const outgoing = ["venta", "venta_anulada", "transferencia_salida", "ajuste_negativo", "salida"].includes(movement.tipo);
    const incoming = ["anulacion_venta", "transferencia_entrada", "aumento", "ajuste_positivo", "entrada", "ingreso"].includes(movement.tipo);
    if ((outgoing || incoming) && Math.abs(after - (outgoing ? before - qty : before + qty)) > EPSILON) {
      issues.push({ tipo: "ecuacion_movimiento", id: movement.id, producto_id: movement.producto_id, movimiento: movement.tipo, cantidad_base: qty, stock_antes: before, stock_despues: after, esperado: outgoing ? before - qty : before + qty });
    }
  }
}

for (const detail of details) {
  const count = movementByDetail.get(String(detail.id)) || 0;
  if (count !== 1) issues.push({ tipo: "detalle_sin_movimiento_unico", id: detail.id, venta_id: detail.venta_id, movimientos: count });
}

const variantsByProduct = new Map();
for (const variant of variants) {
  const effective = Number(variant.stock_decimal ?? variant.stock ?? 0);
  if (effective < -EPSILON) issues.push({ tipo: "stock_variante_negativo", id: variant.id, stock: effective });
  if (variant.stock_decimal != null && Number(variant.stock) !== Math.floor(Number(variant.stock_decimal))) {
    issues.push({ tipo: "entero_decimal_desincronizado", id: variant.id, stock: variant.stock, stock_decimal: variant.stock_decimal });
  }
  if (variant.activo !== false) variantsByProduct.set(String(variant.producto_id), (variantsByProduct.get(String(variant.producto_id)) || 0) + effective);
}

for (const product of products) {
  const stock = Number(product.stock || 0);
  if (stock < -EPSILON) issues.push({ tipo: "stock_producto_negativo", id: product.user_id, nombre: product.nombre, stock });
  if (variantsByProduct.has(String(product.user_id))) {
    const sum = variantsByProduct.get(String(product.user_id));
    if (Math.abs(stock - sum) > EPSILON) issues.push({ tipo: "producto_variantes_desincronizado", id: product.user_id, nombre: product.nombre, stock, suma_variantes: sum });
  }
}

const transferMovements = new Map();
for (const movement of movements) {
  const transferId = movement.metadata?.transferencia_id;
  if (!transferId) continue;
  const row = transferMovements.get(String(transferId)) || { entrada: 0, salida: 0, cantidadEntrada: 0, cantidadSalida: 0 };
  if (movement.tipo === "transferencia_entrada") { row.entrada += 1; row.cantidadEntrada += Number(movement.cantidad_base || 0); }
  if (movement.tipo === "transferencia_salida") { row.salida += 1; row.cantidadSalida += Number(movement.cantidad_base || 0); }
  transferMovements.set(String(transferId), row);
}
for (const transfer of transfers) {
  const row = transferMovements.get(String(transfer.id)) || { entrada: 0, salida: 0, cantidadEntrada: 0, cantidadSalida: 0 };
  if (row.entrada !== 1 || row.salida !== 1 || Math.abs(row.cantidadEntrada - Number(transfer.cantidad_base)) > EPSILON || Math.abs(row.cantidadSalida - Number(transfer.cantidad_base)) > EPSILON) {
    issues.push({ tipo: "transferencia_sin_partida_doble", id: transfer.id, ...row, esperado: transfer.cantidad_base });
  }
}

const counts = issues.reduce((acc, issue) => ({ ...acc, [issue.tipo]: (acc[issue.tipo] || 0) + 1 }), {});
console.log(JSON.stringify({ solo_lectura: true, revisados: { productos: products.length, variantes: variants.length, movimientos: movements.length, detalles: details.length, transferencias: transfers.length }, problemas: counts, muestras: issues.slice(0, 30) }, null, 2));
if (issues.length) process.exitCode = 2;
