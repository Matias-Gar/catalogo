import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { requireAdminAccess } from "@/lib/adminAccess";
import { randomUUID } from "node:crypto";
import { validateSaleDiscounts } from '@/lib/validateSaleDiscounts.mjs';

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request) {
  try {
    const body = await request.json();
    const venta = body?.venta || {};
    const items = Array.isArray(body?.items) ? body.items : [];
    const pagos = Array.isArray(body?.pagos) ? body.pagos : [];
    const idempotencyKey = String(request.headers.get("idempotency-key") || body?.idempotency_key || "").trim();
    const correlationId = String(request.headers.get("x-correlation-id") || body?.correlation_id || randomUUID()).trim();

    if (!venta?.pais_id || !venta?.sucursal_id) {
      return NextResponse.json({ success: false, error: "Selecciona pais y sucursal antes de vender" }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ success: false, error: "La venta no tiene items" }, { status: 400 });
    }
    if (!idempotencyKey || idempotencyKey.length > 200) {
      return NextResponse.json({ success: false, error: "Idempotency-Key requerida" }, { status: 400 });
    }
    const auth = await requireAdminAccess(request, {
      paisId: venta.pais_id,
      sucursalId: venta.sucursal_id,
      allowedRoles: ["admin", "administracion", "vendedor"],
    });
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const ids = [...new Set(items.map(i => i.producto_id))];
    const results = await Promise.all([
      supabaseAdmin.from('productos').select('user_id,nombre,precio,precio_compra,producto_variantes(id,precio)')
        .in('user_id', ids).eq('pais_id', venta.pais_id).eq('sucursal_id', venta.sucursal_id).eq('archivado', false),
      supabaseAdmin.from('promociones').select('*').in('producto_id', ids)
        .eq('pais_id', venta.pais_id).eq('sucursal_id', venta.sucursal_id).eq('activa', true),
      supabaseAdmin.from('packs').select('id,precio_pack,fecha_inicio,fecha_fin,pack_productos(producto_id,variante_id,cantidad)')
        .eq('pais_id', venta.pais_id).eq('sucursal_id', venta.sucursal_id).eq('activo', true),
    ]);
    for (const result of results) if (result.error) throw result.error;
    const now = new Date();
    validateSaleDiscounts({ venta, items, products: results[0].data || [], promotions: results[1].data || [],
      packs: (results[2].data || []).filter(p => (!p.fecha_inicio || new Date(p.fecha_inicio) <= now)
        && (!p.fecha_fin || new Date(p.fecha_fin) >= now)) });

    const { data, error } = await supabaseAdmin.rpc("crear_venta_completa_segura", {
      p_venta: venta,
      p_items: items,
      p_pagos: pagos,
      p_usuario_id: auth.userId,
      p_usuario_email: auth.email,
      p_usuario_rol: auth.role,
      p_cashbox_id: body?.cashbox_id || "main",
      p_pending_order_id: body?.pending_order_id == null ? null : Number(body.pending_order_id),
      p_idempotency_key: idempotencyKey,
      p_correlation_id: correlationId,
    });

    if (error) throw error;

    const saleId = data?.id;

    return NextResponse.json({
      success: true,
      correlation_id: correlationId,
      venta: {
        id: saleId,
        estado: data?.estado || "efectivizada",
        fecha: new Date().toISOString(),
        ...venta,
        usuario_id: auth.userId,
        usuario_email: auth.email,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "No se pudo efectivizar la venta",
        details: error?.details || null,
        hint: error?.hint || null,
      },
      { status: 400 }
    );
  }
}
