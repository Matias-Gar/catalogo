import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { getUserIdFromRequest } from "@/lib/authUserFromRequest";

const ROLE_PRIORITY = { cliente: 0, vendedor: 1, almacen: 2, administracion: 3, admin: 4 };

function normalizeRole(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "owner" ? "admin" : normalized;
}

function bestRole(roles) {
  return roles.map(normalizeRole).reduce(
    (best, role) => (ROLE_PRIORITY[role] || 0) > (ROLE_PRIORITY[best] || 0) ? role : best,
    "cliente"
  );
}

export async function requireAdminAccess(request, { paisId = null, sucursalId = null, allowedRoles = [] } = {}) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return { error: "Unauthorized", status: 401 };

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("perfiles")
    .select("email, rol")
    .eq("id", userId)
    .single();
  if (profileError || !profile) return { error: "Perfil de usuario no encontrado", status: 403 };

  const globalRole = normalizeRole(profile.rol);
  if (globalRole === "admin") return { userId, email: profile.email || "", role: globalRole };

  const roles = [globalRole];
  let hasCountryAssignment = false;
  let hasBranchAssignment = false;
  if (paisId) {
    const { data } = await supabaseAdmin
      .from("usuario_paises")
      .select("rol")
      .eq("usuario_id", userId)
      .eq("pais_id", paisId)
      .eq("activo", true);
    hasCountryAssignment = (data || []).length > 0;
    roles.push(...(data || []).map((row) => row.rol));
  }
  if (sucursalId) {
    const { data } = await supabaseAdmin
      .from("usuario_sucursales")
      .select("rol")
      .eq("usuario_id", userId)
      .eq("sucursal_id", sucursalId)
      .eq("activo", true);
    hasBranchAssignment = (data || []).length > 0;
    roles.push(...(data || []).map((row) => row.rol));
  }

  if ((paisId || sucursalId) && !hasCountryAssignment && !hasBranchAssignment) {
    return { error: "No tienes acceso al pais o sucursal seleccionados", status: 403 };
  }

  const role = bestRole(roles);
  if (!allowedRoles.map(normalizeRole).includes(role)) {
    return { error: "No tienes permisos para esta operacion en el pais o sucursal seleccionados", status: 403 };
  }
  return { userId, email: profile.email || "", role };
}
