import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { requireAdminAccess } from "@/lib/adminAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request) {
  try {
    const body = await request.json();
    const originId = body?.p_sucursal_origen_id;
    const destinationId = body?.p_sucursal_destino_id;
    if (!originId || !destinationId || originId === destinationId) {
      return NextResponse.json({ success: false, error: "Selecciona sucursales distintas" }, { status: 400 });
    }

    const { data: branches, error: branchesError } = await supabaseAdmin
      .from("sucursales")
      .select("id, pais_id")
      .in("id", [originId, destinationId]);
    if (branchesError) throw branchesError;
    const origin = (branches || []).find((row) => row.id === originId);
    const destination = (branches || []).find((row) => row.id === destinationId);
    if (!origin || !destination || origin.pais_id !== destination.pais_id) {
      return NextResponse.json({ success: false, error: "Las sucursales no existen o pertenecen a paises distintos" }, { status: 400 });
    }

    const auth = await requireAdminAccess(request, {
      paisId: origin.pais_id,
      sucursalId: originId,
      allowedRoles: ["admin", "administracion", "almacen"],
    });
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const { data, error } = await supabaseAdmin.rpc("transferir_stock_sucursal", {
      p_producto_origen_id: Number(body.p_producto_origen_id),
      p_variante_origen_id: body.p_variante_origen_id == null ? null : Number(body.p_variante_origen_id),
      p_sucursal_origen_id: originId,
      p_sucursal_destino_id: destinationId,
      p_cantidad: Number(body.p_cantidad),
      p_unidad: String(body.p_unidad || ""),
      p_cantidad_base: Number(body.p_cantidad_base),
      p_usuario_id: auth.userId,
      p_usuario_email: auth.email,
      p_observaciones: body.p_observaciones || null,
    });
    if (error) throw error;
    return NextResponse.json({ success: true, transferencia_id: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || "No se pudo transferir el stock" }, { status: 400 });
  }
}
