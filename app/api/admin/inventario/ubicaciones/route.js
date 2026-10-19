import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/SupabaseAdminClient';
import { requireAdminAccess } from '@/lib/adminAccess';

export const dynamic = 'force-dynamic';
const readers = ['admin', 'administracion', 'almacen', 'vendedor'];

async function access(request, paisId, sucursalId, write = false) {
  if (!paisId || !sucursalId) return { error: 'Selecciona un pais y una sucursal.', status: 400 };
  const auth = await requireAdminAccess(request, { paisId, sucursalId,
    allowedRoles: write ? readers.filter(r => r !== 'vendedor') : readers });
  if (auth.error) return auth;
  const { data, error } = await supabaseAdmin.from('sucursales').select('id')
    .eq('id', sucursalId).eq('pais_id', paisId).maybeSingle();
  if (error || !data) return { error: 'La sucursal no corresponde al pais seleccionado.', status: 403 };
  return auth;
}

function failure(error) {
  const missing = ['42P01', 'PGRST200', 'PGRST205'].includes(error?.code);
  return NextResponse.json({ error: missing
    ? 'Falta instalar las ubicaciones. Ejecuta scripts/create_product_locations.sql en Supabase.'
    : error?.message || 'No se pudo completar la operacion.' }, { status: 400 });
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const paisId = params.get('paisId'), sucursalId = params.get('sucursalId');
    const auth = await access(request, paisId, sucursalId);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabaseAdmin.from('productos')
        .select('user_id,nombre,codigo_barra,imagen_url,vista_producto,categorias(categori),producto_imagenes(id,imagen_url),producto_variantes(sku),producto_ubicaciones(caja,updated_at)')
        .eq('pais_id', paisId).eq('sucursal_id', sucursalId).eq('archivado', false)
        .order('user_id').range(offset, offset + 499);
      if (error) throw error;
      rows.push(...data);
      if (data.length < 500) break;
    }
    return NextResponse.json({ rows, canEdit: auth.role !== 'vendedor' });
  } catch (error) { return failure(error); }
}

export async function PUT(request) {
  try {
    const { paisId, sucursalId, productoId, caja } = await request.json();
    const auth = await access(request, paisId, sucursalId, true);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (!/^\d+$/.test(String(productoId)) || typeof caja !== 'string' || caja.trim().length > 80)
      return NextResponse.json({ error: 'Producto o caja invalida (maximo 80 caracteres).' }, { status: 400 });
    const { data: product, error: lookupError } = await supabaseAdmin.from('productos').select('user_id')
      .eq('user_id', productoId).eq('pais_id', paisId).eq('sucursal_id', sucursalId).eq('archivado', false).maybeSingle();
    if (lookupError) throw lookupError;
    if (!product) return NextResponse.json({ error: 'Producto no encontrado en esta sucursal.' }, { status: 404 });
    const value = caja.trim();
    const result = value
      ? await supabaseAdmin.from('producto_ubicaciones').upsert({ producto_id: productoId, caja: value,
        updated_at: new Date().toISOString(), updated_by: auth.userId }, { onConflict: 'producto_id' })
      : await supabaseAdmin.from('producto_ubicaciones').delete().eq('producto_id', productoId);
    if (result.error) throw result.error;
    return NextResponse.json({ caja: value });
  } catch (error) { return failure(error); }
}
