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

export async function DELETE(request) {
  try {
    const body = await request.json();
    const categoryId = Number(body?.categoryId);
    const paisId = body?.paisId || null;
    const sucursalId = body?.sucursalId || null;

    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return NextResponse.json({ success: false, error: "Categoria invalida" }, { status: 400 });
    }
    if (!(await validateScope(paisId, sucursalId))) {
      return NextResponse.json({ success: false, error: "La sucursal seleccionada no existe o no pertenece al pais activo" }, { status: 400 });
    }

    const auth = await requireAdminAccess(request, { paisId, sucursalId, allowedRoles: WRITE_ROLES });
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const { data: category, error: categoryError } = await supabaseAdmin
      .from("categorias")
      .select("id, categori")
      .eq("id", categoryId)
      .eq("pais_id", paisId)
      .eq("sucursal_id", sucursalId)
      .maybeSingle();
    if (categoryError) throw categoryError;
    if (!category) {
      return NextResponse.json({ success: false, error: "La categoria no existe en la sucursal seleccionada" }, { status: 404 });
    }

    const { data: linkedProducts, error: productsError } = await supabaseAdmin
      .from("productos")
      .select("user_id, archivado")
      .eq("category_id", categoryId)
      .eq("pais_id", paisId)
      .eq("sucursal_id", sucursalId);
    if (productsError) throw productsError;

    const activeProducts = (linkedProducts || []).filter((product) => product.archivado !== true);
    if (activeProducts.length > 0) {
      return NextResponse.json({
        success: false,
        error: `No se puede eliminar: la categoria tiene ${activeProducts.length} producto${activeProducts.length === 1 ? " activo" : "s activos"}`,
      }, { status: 409 });
    }

    // Los productos retirados conservan el nombre historico en `categoria`, pero
    // deben soltar la clave foranea para permitir eliminar una categoria sin uso.
    if ((linkedProducts || []).length > 0) {
      const { error: unlinkError } = await supabaseAdmin
        .from("productos")
        .update({ category_id: null })
        .eq("category_id", categoryId)
        .eq("archivado", true)
        .eq("pais_id", paisId)
        .eq("sucursal_id", sucursalId);
      if (unlinkError) throw unlinkError;
    }

    const { data: deleted, error: deleteError } = await supabaseAdmin
      .from("categorias")
      .delete()
      .eq("id", categoryId)
      .eq("pais_id", paisId)
      .eq("sucursal_id", sucursalId)
      .select("id")
      .maybeSingle();
    if (deleteError) throw deleteError;
    if (!deleted) {
      return NextResponse.json({ success: false, error: "No se pudo eliminar la categoria" }, { status: 409 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error?.message || "No se pudo eliminar la categoria" }, { status: 400 });
  }
}
