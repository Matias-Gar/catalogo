import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Faltan variables de entorno para Supabase Service Role");
}

export async function POST(request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Payload invalido" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const paisId = body.pais_id ? String(body.pais_id) : null;
    const sucursalId = body.sucursal_id ? String(body.sucursal_id) : null;

    if (!paisId) {
      return NextResponse.json({ success: false, error: "Pais requerido para guardar el pedido" }, { status: 400 });
    }

    let branch = null;
    if (sucursalId) {
      const branchResult = await supabase
        .from("sucursales")
        .select("id, pais_id")
        .eq("id", sucursalId)
        .eq("pais_id", paisId)
        .eq("activa", true)
        .maybeSingle();

      if (branchResult.error) {
        return NextResponse.json({ success: false, error: branchResult.error.message }, { status: 400 });
      }
      branch = branchResult.data;
    }

    if (!branch) {
      const fallback = await supabase
        .from("sucursales")
        .select("id, pais_id")
        .eq("pais_id", paisId)
        .eq("activa", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fallback.error || !fallback.data) {
        return NextResponse.json(
          { success: false, error: fallback.error?.message || "No hay una sucursal activa para este pais" },
          { status: 400 }
        );
      }
      branch = fallback.data;
    }

    const payload = {
      ...body,
      pais_id: branch.pais_id,
      sucursal_id: branch.id,
    };

    const { data, error } = await supabase
      .from("carritos_pendientes")
      .insert([payload])
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
