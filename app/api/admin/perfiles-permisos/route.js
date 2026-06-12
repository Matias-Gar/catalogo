import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { getUserIdFromRequest } from "@/lib/authUserFromRequest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PANEL_ROLES = new Set(["admin", "administracion", "vendedor", "almacen"]);
const COUNTRY_ROLES = new Set(["admin", "administracion", "vendedor", "almacen"]);

async function requireGlobalAdmin(request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return { error: "Unauthorized", status: 401 };

  const { data: profile, error } = await supabaseAdmin
    .from("perfiles")
    .select("rol")
    .eq("id", userId)
    .single();

  if (error || String(profile?.rol || "").toLowerCase() !== "admin") {
    return { error: "Solo el administrador global puede gestionar permisos por pais", status: 403 };
  }

  return { userId };
}

export async function GET(request) {
  const auth = await requireGlobalAdmin(request);
  if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const [countriesResult, assignmentsResult] = await Promise.all([
    supabaseAdmin
      .from("paises")
      .select("id, nombre, slug, activa")
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("usuario_paises")
      .select("id, usuario_id, pais_id, rol, activo, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const error = countriesResult.error || assignmentsResult.error;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

  return NextResponse.json({
    success: true,
    paises: countriesResult.data || [],
    asignaciones: assignmentsResult.data || [],
  });
}

export async function POST(request) {
  const auth = await requireGlobalAdmin(request);
  if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  const body = await request.json();
  const usuarioId = body?.usuario_id;
  const paisId = body?.pais_id;
  const rol = String(body?.rol || "administracion").toLowerCase();
  const activo = body?.activo !== false;

  if (!usuarioId || !paisId || !COUNTRY_ROLES.has(rol)) {
    return NextResponse.json({ success: false, error: "Usuario, pais y rol son obligatorios" }, { status: 400 });
  }

  const { error: assignmentError } = await supabaseAdmin
    .from("usuario_paises")
    .upsert(
      {
        usuario_id: usuarioId,
        pais_id: paisId,
        rol,
        activo,
      },
      { onConflict: "usuario_id,pais_id" }
    );

  if (assignmentError) {
    return NextResponse.json({ success: false, error: assignmentError.message }, { status: 400 });
  }

  if (activo) {
    const { data: profile } = await supabaseAdmin
      .from("perfiles")
      .select("rol")
      .eq("id", usuarioId)
      .single();

    const currentRole = String(profile?.rol || "").toLowerCase();
    if (!PANEL_ROLES.has(currentRole)) {
      await supabaseAdmin
        .from("perfiles")
        .update({ rol: "administracion" })
        .eq("id", usuarioId);
    }
  }

  return NextResponse.json({ success: true });
}
