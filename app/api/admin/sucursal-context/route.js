import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { getUserIdFromRequest } from "@/lib/authUserFromRequest";

const ADMIN_ROLES = new Set(["admin", "administracion", "vendedor", "almacen"]);
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfiles")
    .select("id, email, nombre, rol")
    .eq("id", userId)
    .single();

  const role = String(profile?.rol || "").toLowerCase();
  if (profileError || !ADMIN_ROLES.has(role)) {
    return NextResponse.json({ success: false, error: "Sin acceso al panel" }, { status: 403 });
  }

  if (role === "admin") {
    const [{ data: paises, error: paisesError }, { data, error }] = await Promise.all([
      supabaseAdmin
        .from("paises")
        .select("id, nombre, slug, codigo_iso, moneda_codigo, moneda_simbolo, whatsapp, direccion, activa")
        .eq("activa", true)
        .order("created_at", { ascending: true }),
      supabaseAdmin
      .from("sucursales")
        .select("id, nombre, slug, direccion, telefono, activa, pais_id")
        .eq("activa", true)
        .order("created_at", { ascending: true }),
    ]);

    const adminError = paisesError || error;
    if (adminError) return NextResponse.json({ success: false, error: adminError.message }, { status: 400 });

    return NextResponse.json({
      success: true,
      perfil: profile,
      paises: paises || [],
      sucursales: data || [],
    });
  }

  const [{ data: paisRows, error: paisError }, { data, error }] = await Promise.all([
    supabaseAdmin
      .from("usuario_paises")
      .select(
        `
          rol,
          activo,
          pais:paises (
            id,
            nombre,
            slug,
            codigo_iso,
            moneda_codigo,
            moneda_simbolo,
            whatsapp,
            direccion,
            activa
          )
        `
      )
      .eq("usuario_id", userId)
      .eq("activo", true),
    supabaseAdmin
    .from("usuario_sucursales")
    .select(
      `
        rol,
        activo,
        sucursal:sucursales (
          id,
          nombre,
          slug,
          direccion,
          telefono,
          activa,
          pais_id
        )
      `
    )
    .eq("usuario_id", userId)
      .eq("activo", true),
  ]);

  const accessError = paisError || error;
  if (accessError) return NextResponse.json({ success: false, error: accessError.message }, { status: 400 });

  const paisesFromAssignments = (paisRows || [])
    .map((row) => ({ ...row.pais, rol_pais: row.rol }))
    .filter((country) => country?.id && country.activa !== false);

  const sucursales = (data || [])
    .map((row) => ({ ...row.sucursal, rol_sucursal: row.rol }))
    .filter((branch) => branch?.id && branch.activa !== false);

  const assignedPaisIds = new Set(paisesFromAssignments.map((country) => country.id));
  const missingPaisIds = Array.from(new Set(sucursales.map((branch) => branch.pais_id).filter(Boolean)))
    .filter((paisId) => !assignedPaisIds.has(paisId));

  let paisesFromBranches = [];
  if (missingPaisIds.length > 0) {
    const { data: branchCountries, error: branchCountriesError } = await supabaseAdmin
      .from("paises")
      .select("id, nombre, slug, codigo_iso, moneda_codigo, moneda_simbolo, whatsapp, direccion, activa")
      .in("id", missingPaisIds)
      .eq("activa", true);

    if (branchCountriesError) {
      return NextResponse.json({ success: false, error: branchCountriesError.message }, { status: 400 });
    }

    paisesFromBranches = branchCountries || [];
  }

  const paises = [...paisesFromAssignments, ...paisesFromBranches];

  return NextResponse.json({
    success: true,
    perfil: profile,
    paises,
    sucursales,
  });
}
