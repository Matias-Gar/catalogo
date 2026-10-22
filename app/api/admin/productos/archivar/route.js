import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { requireAdminAccess } from "@/lib/adminAccess";

export async function POST(request) {
  try {
    const { productId, paisId, sucursalId, archivado } = await request.json();
    if (!Number.isSafeInteger(productId) || productId <= 0 || !paisId || !sucursalId || typeof archivado !== "boolean") {
      return NextResponse.json({ success: false, error: "Producto, país, sucursal y estado son obligatorios" }, { status: 400 });
    }
    const auth = await requireAdminAccess(request, { paisId, sucursalId, allowedRoles: ["admin"] });
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const { data: branch, error: branchError } = await supabaseAdmin.from("sucursales")
      .select("id").eq("id", sucursalId).eq("pais_id", paisId).eq("activa", true).maybeSingle();
    if (branchError) throw branchError;
    if (!branch) return NextResponse.json({ success: false, error: "La sucursal no pertenece al país seleccionado o está desactivada" }, { status: 400 });

    const { data: previous, error: readError } = await supabaseAdmin.from("productos")
      .select("*").eq("user_id", productId).eq("pais_id", paisId).eq("sucursal_id", sucursalId).maybeSingle();
    if (readError) throw readError;
    if (!previous) return NextResponse.json({ success: false, error: "Producto no encontrado en el país y sucursal seleccionados" }, { status: 404 });
    if (previous.archivado === archivado) return NextResponse.json({ success: true, product: previous });

    const { data: product, error: updateError } = await supabaseAdmin.from("productos")
      .update({ archivado }).eq("user_id", productId).eq("pais_id", paisId).eq("sucursal_id", sucursalId).select("*").single();
    if (updateError) throw updateError;
    const { error: historyError } = await supabaseAdmin.from("productos_historial").insert({
      producto_id: productId, accion: archivado ? "ARCHIVE" : "UNARCHIVE",
      datos_anteriores: previous, datos_nuevos: product, usuario_email: auth.email || null,
      pais_id: paisId, sucursal_id: sucursalId,
    });
    if (historyError) console.error("Error registrando historial de archivo:", historyError);
    return NextResponse.json({ success: true, product, warning: historyError ? "El estado se guardó, pero no se pudo registrar el historial" : null });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || "No se pudo cambiar el estado del producto" }, { status: 400 });
  }
}
