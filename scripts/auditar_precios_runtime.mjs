import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { getPromotionPrice } from '../lib/saleDiscountPolicy.mjs';
import { money, orderTotal } from '../lib/orderPricing.mjs';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ path: '.env', quiet: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
async function all(table, columns) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await db.from(table).select(columns).range(offset, offset + 999);
    if (result.error) throw new Error(`${table}: ${result.error.message}`);
    rows.push(...result.data);
    if (result.data.length < 1000) return rows;
  }
}
const [sales, details, products, promotions, orders] = await Promise.all([
  all('ventas', 'id,fecha,estado,total,costos_extra'),
  all('ventas_detalle', 'id,venta_id,producto_id,variante_id,cantidad_base,cantidad,precio_unitario'),
  all('productos', 'user_id,nombre,precio,producto_variantes(id,precio)'),
  all('promociones', 'id,producto_id,tipo,valor,activa,fecha_inicio,fecha_fin'),
  all('carritos_pendientes', 'id,estado,productos'),
]);
const candidates = [];
for (const detail of details) {
  const sale = sales.find(s => s.id === detail.venta_id);
  if (!sale || sale.estado === 'anulada') continue;
  const product = products.find(p => p.user_id === detail.producto_id);
  if (!product) continue;
  const variant = product.producto_variantes?.find(v => v.id === detail.variante_id);
  const info = getPromotionPrice({ ...product, precio_original: variant?.precio ?? product.precio }, promotions, new Date(sale.fecha));
  if (!info.tienePromocion || Number(detail.precio_unitario) >= info.precioFinal - 0.005) continue;
  candidates.push({ venta_id: sale.id, detalle_id: detail.id, producto: product.nombre,
    cantidad_base: Number(detail.cantidad_base ?? detail.cantidad), precio_registrado: Number(detail.precio_unitario),
    precio_promocional_referencia: info.precioFinal,
    diferencia_potencial: money((info.precioFinal - detail.precio_unitario) * Number(detail.cantidad_base ?? detail.cantidad)) });
}
const pending = orders.filter(order => (order.estado || 'pendiente') === 'pendiente').map(order => ({
  pedido_id: order.id, total_guardado: orderTotal(order.productos),
  referencias_originales_incorrectas: order.productos.filter(item => {
    if (item.tipo === 'pack') return false;
    const product = products.find(p => p.user_id === item.producto_id);
    if (!product) return false;
    const variant = product.producto_variantes?.find(v => v.id === item.variante_id);
    return item.precio_original != null && Math.abs(Number(item.precio_original) - Number(variant?.precio ?? product.precio)) > 0.005;
  }).map(item => item.producto_id),
}));
const report = { solo_lectura: true, revisados: { ventas: sales.length, detalles: details.length,
  productos: products.length, promociones: promotions.length, pedidos: orders.length },
  limitacion: 'Precios y promociones actuales evaluados a la fecha de cada venta; no sustituyen un historial de cambios ni prueban por sí solos una pérdida.',
  ventas_a_revisar: candidates, pedidos_pendientes: pending };
mkdirSync('tests/reports', { recursive: true });
writeFileSync('tests/reports/pricing-audit.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
