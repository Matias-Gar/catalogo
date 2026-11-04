import dotenv from 'dotenv';
import fs from 'node:fs/promises';
dotenv.config({ path: '.env', quiet: true });
dotenv.config({ path: '.env.local', override: true, quiet: true });
const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const report = { origin: new URL(base).origin, timestamp: new Date().toISOString(), checks: [] };
for (const path of ['/auth/v1/health', '/auth/v1/settings']) {
  const response = await fetch(base + path, { headers: { apikey: anon }, signal: AbortSignal.timeout(15000) });
  report.checks.push({ path, status: response.status });
  await response.body?.cancel();
}
const specResponse = await fetch(base + '/rest/v1/', { headers: { apikey: anon, Authorization: `Bearer ${anon}`,
  Accept: 'application/openapi+json' }, signal: AbortSignal.timeout(15000) });
if (specResponse.ok) {
  const spec = await specResponse.json();
  report.anonymousRpcPaths = Object.keys(spec.paths || {}).filter(p => p.startsWith('/rpc/'));
} else report.openApiStatus = specResponse.status;
const tables = ['productos', 'categorias', 'producto_variantes', 'producto_imagenes', 'promociones', 'packs', 'paises', 'sucursales',
  'perfiles', 'clientes', 'ventas', 'ventas_detalle', 'ventas_pagos', 'stock_movimientos', 'carritos_pendientes', 'password_resets', 'cash_closures', 'cash_movements'];
for (const table of tables) {
  for (const [role, key] of [['anon', anon], ['service_role', service]]) {
    if (!key) { report.checks.push({ table, role, skipped: 'key unavailable' }); continue; }
    const started = Date.now();
    try {
      // HEAD + limit 0: record row counts, never download customer or sale values.
      const response = await fetch(`${base}/rest/v1/${table}?select=*&limit=0`, { method: 'HEAD',
        headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'count=exact' }, signal: AbortSignal.timeout(15000) });
      report.checks.push({ table, role, status: response.status, contentRange: response.headers.get('content-range'), durationMs: Date.now() - started });
    } catch (e) { report.checks.push({ table, role, error: e.name, durationMs: Date.now() - started }); }
  }
}
await fs.writeFile('docs/audit-2026-11-04/database-readonly.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.checks.filter(c => c.role === 'anon')));
