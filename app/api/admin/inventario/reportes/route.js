import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/SupabaseAdminClient';
import { requireAdminAccess } from '@/lib/adminAccess';
import { buildReport, dateRange } from '@/lib/inventoryReports.mjs';

export const dynamic = 'force-dynamic';

async function allRows(query) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query().range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const paisId = params.get('paisId');
    const sucursalId = params.get('sucursalId');
    if (!paisId || !sucursalId) return NextResponse.json({ error: 'Selecciona una sucursal.' }, { status: 400 });
    const { start, end } = dateRange(params.get('from'), params.get('to'));
    const auth = await requireAdminAccess(request, { paisId, sucursalId, allowedRoles: ['admin', 'administracion', 'almacen'] });
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const { data: branch, error: branchError } = await supabaseAdmin.from('sucursales').select('id').eq('id', sucursalId).eq('pais_id', paisId).maybeSingle();
    if (branchError || !branch) return NextResponse.json({ error: 'Sucursal inválida para este país.' }, { status: 400 });
    const scoped = (table, select) => supabaseAdmin.from(table).select(select).eq('pais_id', paisId).eq('sucursal_id', sucursalId);
    const results = await Promise.allSettled([
      allRows(() => scoped('productos', 'user_id,nombre,codigo_barra,stock,precio,unidad_base,vista_producto,archivado,imagen_url,categorias(categori),producto_imagenes(imagen_url)').order('user_id')),
      allRows(() => scoped('stock_movimientos', '*').gte('created_at', start).lt('created_at', end).order('created_at').order('id')),
      allRows(() => scoped('producto_variantes', 'id,producto_id,stock,stock_decimal,activo').order('id')),
    ]);
    for (const result of results) if (result.status === 'rejected') throw result.reason;
    const [products, movements, variants] = results.map(result => result.value);
    return NextResponse.json({ ...buildReport(products, movements, variants), generatedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'No se pudo generar el reporte.' }, { status: 400 });
  }
}
