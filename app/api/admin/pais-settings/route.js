import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { getUserIdFromRequest } from "@/lib/authUserFromRequest";

const ADMIN_ROLES = new Set(["admin", "administracion"]);

function cleanWhatsappNumber(input) {
  return String(input || "").replace(/[^\d]/g, "");
}

async function requireAdmin(request, paisId) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return { error: "Unauthorized", status: 401 };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfiles")
    .select("rol")
    .eq("id", userId)
    .single();

  const role = String(profile?.rol || "").toLowerCase();
  if (profileError || !ADMIN_ROLES.has(role)) {
    return { error: "Sin permisos para configurar el pais", status: 403 };
  }

  if (role === "admin") return { userId, role };

  const { data: access, error: accessError } = await supabaseAdmin
    .from("usuario_paises")
    .select("id")
    .eq("usuario_id", userId)
    .eq("pais_id", paisId)
    .eq("activo", true)
    .in("rol", ["owner", "admin", "administracion"])
    .maybeSingle();

  if (accessError || !access) {
    return { error: "Sin permisos para configurar este pais", status: 403 };
  }

  return { userId, role };
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const paisId = body?.pais_id;
  if (!paisId) {
    return NextResponse.json({ success: false, error: "Pais requerido" }, { status: 400 });
  }

  const auth = await requireAdmin(request, paisId);
  if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const settings = {
    store_name: String(body?.settings?.store_name || "").trim(),
    store_info: String(body?.settings?.store_info || "").trim(),
    store_logo_url: String(body?.settings?.store_logo_url || "").trim(),
  };

  const whatsapp = cleanWhatsappNumber(body?.settings?.whatsapp_number);
  const direccion = String(body?.settings?.store_address || "").trim();

  const [{ data: pais, error: paisError }, { error: settingsError }] = await Promise.all([
    supabaseAdmin
      .from("paises")
      .update({
        whatsapp: whatsapp || null,
        direccion: direccion || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", paisId)
      .select("id, nombre, slug, whatsapp, direccion")
      .single(),
    supabaseAdmin
      .from("pais_settings")
      .upsert(
        {
          pais_id: paisId,
          settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "pais_id" }
      ),
  ]);

  const error = paisError || settingsError;
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    pais,
    settings: {
      ...settings,
      whatsapp_number: whatsapp,
      store_address: direccion,
    },
  });
}
