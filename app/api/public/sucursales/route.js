import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const paisSlug = searchParams.get("pais") || "bo";

  const { data: pais, error: paisError } = await supabaseAdmin
    .from("paises")
    .select("id, nombre, slug, codigo_iso, moneda_codigo, moneda_simbolo, whatsapp, direccion")
    .eq("slug", paisSlug)
    .eq("activa", true)
    .maybeSingle();

  if (paisError || !pais) {
    return NextResponse.json({ success: false, error: paisError?.message || "Pais no encontrado" }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from("sucursales")
    .select("id, nombre, slug, direccion, telefono, pais_id")
    .eq("pais_id", pais.id)
    .eq("activa", true)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, pais, sucursales: data || [] });
}
