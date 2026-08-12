import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { requireAdminAccess } from "@/lib/adminAccess";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const productId = Number(body?.productId);
    const paisId = String(body?.paisId || "");
    const sucursalId = String(body?.sucursalId || "");
    const reason = String(body?.reason || "").trim();
    if (!Number.isSafeInteger(productId) || !paisId || !sucursalId || !reason) {
      return NextResponse.json({ success: false, error: "Producto, sucursal y motivo son obligatorios" }, { status: 400 });
    }
    const auth = await requireAdminAccess(request, { paisId, sucursalId, allowedRoles: ["admin"] });
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const correlationId = String(request.headers.get("x-correlation-id") || randomUUID());
    const { data, error } = await supabaseAdmin.rpc("soft_delete_product", {
      p_producto_id: productId, p_pais_id: paisId, p_sucursal_id: sucursalId,
      p_usuario_id: auth.userId, p_usuario_email: auth.email, p_usuario_rol: auth.role,
      p_motivo: reason, p_correlation_id: correlationId,
    });
    if (error) throw error;
    return NextResponse.json({ success: true, product: data, correlation_id: correlationId });
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || "No se pudo retirar el producto" }, { status: 400 });
  }
}
