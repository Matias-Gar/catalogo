import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";

const DEFAULT_SETTINGS = {
  store_name: "Mi Tienda Online",
  whatsapp_number: "",
  store_info: "",
  store_address: "",
  store_logo_url: "",
};

function cleanWhatsappNumber(input) {
  return String(input || "").replace(/[^\d]/g, "");
}

function mergeSettings(pais, settings) {
  return {
    ...DEFAULT_SETTINGS,
    ...(settings || {}),
    whatsapp_number: cleanWhatsappNumber(pais?.whatsapp || settings?.whatsapp_number || ""),
    store_address: String(pais?.direccion || settings?.store_address || "").trim(),
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const paisId = searchParams.get("pais_id");
  const paisSlug = searchParams.get("pais") || searchParams.get("pais_slug") || "bo";

  let paisQuery = supabaseAdmin
    .from("paises")
    .select("id, nombre, slug, whatsapp, direccion")
    .eq("activa", true);

  paisQuery = paisId ? paisQuery.eq("id", paisId) : paisQuery.eq("slug", paisSlug);

  const { data: pais, error: paisError } = await paisQuery.maybeSingle();
  if (paisError || !pais) {
    return NextResponse.json({ success: false, error: paisError?.message || "Pais no encontrado" }, { status: 404 });
  }

  const { data: settingsRow, error: settingsError } = await supabaseAdmin
    .from("pais_settings")
    .select("settings")
    .eq("pais_id", pais.id)
    .maybeSingle();

  if (settingsError) {
    return NextResponse.json({ success: false, error: settingsError.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    pais,
    settings: mergeSettings(pais, settingsRow?.settings),
  });
}
