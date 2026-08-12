import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { requireAdminAccess } from "@/lib/adminAccess";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json();
    const operation = body?.operation === "reduce" ? "reduce" : "increase";
    const productId = Number(body?.productId);
    const variantId = body?.mode === "variant" ? Number(body?.variantId) : null;
    const paisId = String(body?.paisId || "");
    const sucursalId = String(body?.sucursalId || "");
    const quantity = Number(body?.displayIncrease);
    const unit = String(body?.selectedUnit || "").trim();
    const reason = String(body?.reason || (operation === "increase" ? "Ingreso de mercadería desde panel" : "")).trim();
    if (!Number.isSafeInteger(productId) || (variantId !== null && !Number.isSafeInteger(variantId)) ||
        !paisId || !sucursalId || !Number.isFinite(quantity) || quantity <= 0 || !unit || !reason) {
      return NextResponse.json({ success: false, error: "Datos inválidos para ajustar stock" }, { status: 400 });
    }

    const auth = await requireAdminAccess(request, {
      paisId,
      sucursalId,
      allowedRoles: operation === "reduce" ? ["admin", "administracion"] : ["admin", "administracion", "almacen"],
    });
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const correlationId = String(request.headers.get("x-correlation-id") || randomUUID());

    if (operation === "increase") {
      const { data, error } = await supabaseAdmin.rpc("increase_inventory_stock", {
        p_producto_id: productId, p_variante_id: variantId, p_pais_id: paisId,
        p_sucursal_id: sucursalId, p_cantidad: quantity, p_unidad: unit,
        p_usuario_id: auth.userId, p_usuario_email: auth.email, p_usuario_rol: auth.role,
        p_motivo: reason, p_correlation_id: correlationId,
      });
      if (error) throw error;
      return NextResponse.json({ success: true, ...data, correlation_id: correlationId });
    }

    const { data, error } = await supabaseAdmin.rpc("reduce_inventory_stock", {
      p_producto_id: productId, p_variante_id: variantId, p_pais_id: paisId,
      p_sucursal_id: sucursalId, p_cantidad: quantity, p_unidad: unit,
      p_usuario_id: auth.userId, p_usuario_email: auth.email, p_usuario_rol: auth.role,
      p_motivo: reason, p_correlation_id: correlationId,
    });
    if (error) throw error;
    return NextResponse.json({ success: true, ...data, correlation_id: correlationId });
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || "No se pudo ajustar stock" }, { status: 400 });
  }
}
