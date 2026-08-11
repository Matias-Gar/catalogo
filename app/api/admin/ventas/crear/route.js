import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { requireAdminAccess } from "@/lib/adminAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request) {
  try {
    const body = await request.json();
    const venta = body?.venta || {};
    const items = Array.isArray(body?.items) ? body.items : [];
    const pagos = Array.isArray(body?.pagos) ? body.pagos : [];

    if (!venta?.pais_id || !venta?.sucursal_id) {
      return NextResponse.json({ success: false, error: "Selecciona pais y sucursal antes de vender" }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ success: false, error: "La venta no tiene items" }, { status: 400 });
    }
    const auth = await requireAdminAccess(request, {
      paisId: venta.pais_id,
      sucursalId: venta.sucursal_id,
      allowedRoles: ["admin", "administracion", "vendedor"],
    });
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const { data, error } = await supabaseAdmin.rpc("crear_venta_completa", {
      p_venta: venta,
      p_items: items,
      p_pagos: pagos,
      p_usuario_id: auth.userId,
      p_usuario_email: auth.email,
      p_cashbox_id: body?.cashbox_id || "main",
    });

    if (error) throw error;

    const saleId = data?.id;
    const pendingOrderId = body?.pending_order_id || null;
    if (pendingOrderId) {
      let pendingQuery = supabaseAdmin
        .from("carritos_pendientes")
        .update({ confirmado_pago: true })
        .eq("id", pendingOrderId)
        .eq("pais_id", venta.pais_id)
        .eq("sucursal_id", venta.sucursal_id);

      const { error: pendingError } = await pendingQuery;
      if (pendingError) {
        await supabaseAdmin
          .from("carritos_pendientes")
          .delete()
          .eq("id", pendingOrderId)
          .eq("pais_id", venta.pais_id)
          .eq("sucursal_id", venta.sucursal_id);
      }
    }

    return NextResponse.json({
      success: true,
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
