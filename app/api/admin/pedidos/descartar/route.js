import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { requireAdminAccess } from "@/lib/adminAccess";

export async function POST(request) {
  try {
    const body = await request.json();
    const orderId = Number(body?.orderId);
    const paisId = String(body?.paisId || "");
    const sucursalId = String(body?.sucursalId || "");
    const reason = String(body?.reason || "").trim();
    if (!Number.isSafeInteger(orderId) || !paisId || !sucursalId || !reason) {
      return NextResponse.json({ success: false, error: "Pedido, sucursal y motivo son obligatorios" }, { status: 400 });
    }
    const auth = await requireAdminAccess(request, {
      paisId, sucursalId, allowedRoles: ["admin", "administracion", "vendedor"],
    });
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const correlationId = String(request.headers.get("x-correlation-id") || randomUUID());
    const { data, error } = await supabaseAdmin.rpc("discard_pending_order", {
      p_pedido_id: orderId, p_pais_id: paisId, p_sucursal_id: sucursalId,
      p_usuario_id: auth.userId, p_usuario_email: auth.email, p_usuario_rol: auth.role,
      p_motivo: reason, p_correlation_id: correlationId,
    });
    if (error) throw error;
    return NextResponse.json({ success: true, order: data, correlation_id: correlationId });
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || "No se pudo descartar el pedido" }, { status: 400 });
  }
}
