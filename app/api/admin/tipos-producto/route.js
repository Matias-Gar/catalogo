import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { requireAdminAccess } from "@/lib/adminAccess";
import { slugifyProductView } from "@/lib/productViews";

async function requireGlobalAdmin(request) {
  return requireAdminAccess(request, { allowedRoles: ["admin"] });
}

export async function GET(request) {
  const auth = await requireGlobalAdmin(request);
  if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  const { data, error } = await supabaseAdmin.from("tipos_producto").select("*").order("orden");
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, tipos: data || [] });
}

export async function POST(request) {
  const auth = await requireGlobalAdmin(request);
  if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  const body = await request.json();
  const nombre = String(body?.nombre || "").trim();
  const slug = slugifyProductView(body?.slug || nombre);
  if (!nombre || !slug) return NextResponse.json({ success: false, error: "Nombre requerido" }, { status: 400 });
  const { data: last } = await supabaseAdmin.from("tipos_producto").select("orden").order("orden", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabaseAdmin.from("tipos_producto").insert({ nombre, slug, orden: Number(last?.orden || 20) + 10 }).select("*").single();
  if (error) return NextResponse.json({ success: false, error: error.code === "23505" ? "Ya existe un tipo con ese nombre" : error.message }, { status: 400 });
  return NextResponse.json({ success: true, tipo: data });
}

export async function PATCH(request) {
  const auth = await requireGlobalAdmin(request);
  if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  const body = await request.json();
  const slug = slugifyProductView(body?.slug || body?.id);
  const { data: current } = await supabaseAdmin.from("tipos_producto").select("*").eq("slug", slug).maybeSingle();
  if (!current) return NextResponse.json({ success: false, error: "Tipo no encontrado" }, { status: 404 });
  if (current.protegido && body?.activo === false) {
    return NextResponse.json({ success: false, error: "Artículos e Insumos no se pueden desactivar" }, { status: 400 });
  }
  const updates = {};
  if (body?.nombre !== undefined) {
    const nombre = String(body.nombre).trim();
    if (!nombre) return NextResponse.json({ success: false, error: "El nombre no puede estar vacío" }, { status: 400 });
    updates.nombre = nombre;
  }
  if (body?.activo !== undefined) updates.activo = Boolean(body.activo);
  const { data, error } = await supabaseAdmin.from("tipos_producto").update(updates).eq("slug", slug).select("*").single();
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  return NextResponse.json({ success: true, tipo: data });
}
