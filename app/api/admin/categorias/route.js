import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { requireAdminAccess } from "@/lib/adminAccess";

const WRITE_ROLES = ["admin", "administracion", "almacen"];

async function validateScope(paisId, sucursalId) {
  if (!paisId || !sucursalId) return null;
  const { data } = await supabaseAdmin
    .from("sucursales")
    .select("id, pais_id")
    .eq("id", sucursalId)
    .eq("pais_id", paisId)
    .eq("activa", true)
    .maybeSingle();
  return data || null;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const paisId = body?.paisId || null;
    const sucursalId = body?.sucursalId || null;
    const nombre = String(body?.nombre || "").trim();
    if (!nombre) return NextResponse.json({ success: false, error: "Nombre de categoria requerido" }, { status: 400 });
    if (!(await validateScope(paisId, sucursalId))) {
      return NextResponse.json({ success: false, error: "La sucursal seleccionada no existe o no pertenece al pais activo" }, { status: 400 });
    }
    const auth = await requireAdminAccess(request, { paisId, sucursalId, allowedRoles: WRITE_ROLES });
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const { data, error } = await supabaseAdmin
      .from("categorias")
      .insert({ categori: nombre, pais_id: paisId, sucursal_id: sucursalId })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ success: true, categoria: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || "No se pudo crear la categoria" }, { status: 400 });
  }
}
