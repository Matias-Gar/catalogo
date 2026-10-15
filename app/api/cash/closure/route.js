import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { createCashClosure } from "@/services/cash.service";
import { requireAdminAccess } from "@/lib/adminAccess";

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body?.pais_id || !body?.sucursal_id) {
      return NextResponse.json({ success: false, error: 'Selecciona un pais y una sucursal antes de cerrar caja.' }, { status: 400 });
    }
    const auth = await requireAdminAccess(request, { paisId: body.pais_id, sucursalId: body.sucursal_id,
      allowedRoles: ['admin', 'administracion', 'vendedor'] });
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const { data: branch, error } = await supabaseAdmin.from('sucursales').select('id')
      .eq('id', body.sucursal_id).eq('pais_id', body.pais_id).eq('activa', true).maybeSingle();
    if (error) throw error;
    if (!branch) return NextResponse.json({ success: false, error: 'La sucursal seleccionada no pertenece al pais o esta inactiva.' }, { status: 400 });
    // Los triggers del cierre deben poder consultar la sucursal. La autorizacion se comprueba arriba.
    const result = await createCashClosure(supabaseAdmin, {
      ...body,
      user_id: auth.userId,
      opening_balance: undefined,
      opening_qr: undefined,
    });
    const status = result?.updated ? 200 : 201;
    return NextResponse.json({ success: true, data: result }, { status });
  } catch (error) {
    const status = Number(error?.statusCode || 400);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to create cash closure",
      },
      { status }
    );
  }
}
