import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { requireAdminAccess } from "@/lib/adminAccess";

async function authorize(request, paisId, sucursalId) {
  if (!paisId || !sucursalId) return { error: "Selecciona un país y una sucursal", status: 400 };
  const auth = await requireAdminAccess(request, { paisId, sucursalId, allowedRoles: ["admin"] });
  if (auth.error) return auth;
  const { data, error } = await supabaseAdmin.from("sucursales").select("id")
    .eq("id", sucursalId).eq("pais_id", paisId).eq("activa", true).maybeSingle();
  if (error || !data) return { error: "La sucursal no pertenece al país activo o está desactivada", status: 400 };
  return auth;
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const paisId = params.get("paisId");
    const sucursalId = params.get("sucursalId");
    const auth = await authorize(request, paisId, sucursalId);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const productos = [];
    // Paginate so selection by category includes every article in large catalogs.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabaseAdmin.from("productos")
        .select("user_id, nombre, category_id, categoria, vista_producto, categorias(categori)")
        .eq("pais_id", paisId).eq("sucursal_id", sucursalId)
        .or("archivado.is.null,archivado.eq.false")
        .order("user_id").range(offset, offset + 499);
      if (error) throw error;
      productos.push(...data);
      if (data.length < 500) break;
    }
    const categorias = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabaseAdmin.from("categorias")
        .select("id, categori").eq("pais_id", paisId).eq("sucursal_id", sucursalId)
        .order("id").range(offset, offset + 499);
      if (error) throw error;
      categorias.push(...data);
      if (data.length < 500) break;
    }
    return NextResponse.json({ success: true, productos, categorias });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || "No se pudieron cargar los artículos" }, { status: 400 });
  }
}

export async function POST(request) {
  try {
    const { paisId, sucursalId, productIds, destino } = await request.json();
    const auth = await authorize(request, paisId, sucursalId);
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    if (!Array.isArray(productIds) || !productIds.length || productIds.length > 500 ||
        productIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
      return NextResponse.json({ success: false, error: "Selecciona entre 1 y 500 artículos" }, { status: 400 });
    }
    if (!Number.isSafeInteger(destino) || destino <= 0) {
      return NextResponse.json({ success: false, error: "Selecciona una categoría de destino" }, { status: 400 });
    }
    const { data: categoria, error: categoryError } = await supabaseAdmin.from("categorias")
      .select("id, categori").eq("id", destino)
      .eq("pais_id", paisId).eq("sucursal_id", sucursalId).maybeSingle();
    if (categoryError) throw categoryError;
    if (!categoria) return NextResponse.json({ success: false, error: "La categoría de destino no existe en esta sucursal" }, { status: 400 });

    // Update both category fields without touching section, identity or inventory.
    const { data, error } = await supabaseAdmin.from("productos")
      .update({ category_id: categoria.id, categoria: categoria.categori })
      .eq("pais_id", paisId).eq("sucursal_id", sucursalId)
      .or("archivado.is.null,archivado.eq.false")
      .in("user_id", [...new Set(productIds)]).select("user_id");
    if (error) throw error;
    if (!data.length) return NextResponse.json({ success: false, error: "Los artículos ya no están disponibles en esta sucursal. Actualiza la lista." }, { status: 409 });
    return NextResponse.json({ success: true, movedIds: data.map((row) => row.user_id) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message || "No se pudo cambiar la categoría" }, { status: 400 });
  }
}
