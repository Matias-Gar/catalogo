import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { getUserIdFromRequest } from "@/lib/authUserFromRequest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ROLES = new Set(["admin", "administracion", "vendedor"]);

async function requireSalesAccess(request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return { error: "Unauthorized", status: 401 };

  const { data: profile, error } = await supabaseAdmin
    .from("perfiles")
    .select("email, rol")
    .eq("id", userId)
    .single();

  const role = String(profile?.rol || "").toLowerCase();
  if (error || !ALLOWED_ROLES.has(role)) {
    return { error: "Sin acceso para efectivizar ventas", status: 403 };
  }

  return { userId, email: profile?.email || "" };
}

export async function POST(request) {
  const auth = await requireSalesAccess(request);
  if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

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
