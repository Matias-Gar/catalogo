import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltan credenciales de Supabase");

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const tables = [
  "productos", "producto_variantes", "producto_imagenes", "categorias",
  "ventas", "ventas_detalle", "ventas_pagos", "carritos_pendientes",
  "cash_movements", "cash_closures", "stock_movimientos",
  "transferencias_sucursal", "productos_historial", "clientes",
  "packs", "pack_productos", "promociones", "business_audit_events",
];

const counts = {};
for (const table of tables) {
  const { count, error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  counts[table] = count || 0;
}

const remaining = Object.fromEntries(Object.entries(counts).filter(([, count]) => count !== 0));
console.log(JSON.stringify({ result: Object.keys(remaining).length === 0 ? "PASS" : "FAIL", counts, remaining }, null, 2));
if (Object.keys(remaining).length > 0) process.exitCode = 1;
