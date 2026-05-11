import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { getUserIdFromRequest } from "@/lib/authUserFromRequest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ALLOWED_ROLES = new Set(["admin", "administracion", "vendedor"]);

async function requireClientAccess(request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return { error: "Unauthorized", status: 401 };

  const { data: profile, error } = await supabaseAdmin
    .from("perfiles")
    .select("rol")
    .eq("id", userId)
    .single();

  const role = String(profile?.rol || "").toLowerCase();
  if (error || !ALLOWED_ROLES.has(role)) {
    return { error: "Sin acceso para guardar clientes", status: 403 };
  }

  return { userId };
}

async function resolveBranchScope({ paisId, sucursalId }) {
  const requestedPaisId = String(paisId || "").trim();
  const requestedSucursalId = String(sucursalId || "").trim();

  if (requestedSucursalId) {
    const { data: branch, error } = await supabaseAdmin
      .from("sucursales")
      .select("id, pais_id")
      .eq("id", requestedSucursalId)
      .maybeSingle();

    if (error) throw error;
    if (branch?.id && (!requestedPaisId || branch.pais_id === requestedPaisId)) {
      return { paisId: branch.pais_id, sucursalId: branch.id };
    }
  }

  const fallbackPaisId = requestedPaisId || requestedSucursalId;
  if (!fallbackPaisId) {
    return { paisId: null, sucursalId: null };
  }

  const { data: fallbackBranch, error: fallbackError } = await supabaseAdmin
    .from("sucursales")
    .select("id, pais_id")
    .eq("pais_id", fallbackPaisId)
    .eq("activa", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fallbackError) throw fallbackError;
  if (!fallbackBranch?.id) {
    throw new Error("No se encontro una sucursal activa para el pais seleccionado");
  }

  return { paisId: fallbackBranch.pais_id, sucursalId: fallbackBranch.id };
}

export async function POST(request) {
  const auth = await requireClientAccess(request);
  if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const nombre = String(body?.nombre || "").trim();
    const carnet = String(body?.carnet || "").trim();
    const telefono = String(body?.telefono || "").trim();
    const email = String(body?.email || "").trim();

    if (!nombre || !telefono) {
      return NextResponse.json({ success: false, error: "Completa al menos nombre y telefono para guardar" }, { status: 400 });
    }

    const scope = await resolveBranchScope({
      paisId: body?.pais_id || null,
      sucursalId: body?.sucursal_id || null,
    });

    if (carnet) {
      let existingQuery = supabaseAdmin
        .from("clientes")
        .select("id")
        .eq("carnet", carnet);

      if (scope.paisId) existingQuery = existingQuery.eq("pais_id", scope.paisId);
      if (scope.sucursalId) existingQuery = existingQuery.eq("sucursal_id", scope.sucursalId);

      const { data: existingClient, error: existingError } = await existingQuery.maybeSingle();
      if (existingError) throw existingError;

      if (existingClient?.id) {
        return NextResponse.json({ success: false, error: "El cliente ya existe. Usa \"Actualizar cliente\"." }, { status: 409 });
      }
    }

    const { data: client, error: insertError } = await supabaseAdmin
      .from("clientes")
      .insert([{
        nombre,
        carnet: carnet || null,
        telefono: telefono || null,
        email: email || null,
        pais_id: scope.paisId,
        sucursal_id: scope.sucursalId,
      }])
      .select("id, nombre, carnet, telefono, email, pais_id, sucursal_id")
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ success: true, cliente: client });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || "No se pudo guardar el cliente" },
      { status: 400 }
    );
  }
}
