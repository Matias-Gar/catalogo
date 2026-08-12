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
    const requestKey = String(request.headers.get("idempotency-key") || body.request_key || "").trim();
    const products = Array.isArray(body.productos) ? body.productos : [];

    if (!paisId) {
      return NextResponse.json({ success: false, error: "Pais requerido para guardar el pedido" }, { status: 400 });
    }
    if (!requestKey || requestKey.length > 200 || products.length === 0 || products.length > 200) {
      return NextResponse.json({ success: false, error: "Pedido inválido o sin clave idempotente" }, { status: 400 });
    }
    for (const item of products) {
      const quantity = Number(item?.cantidad);
      if (!item || typeof item !== "object" || !Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json({ success: false, error: "El pedido contiene cantidades inválidas" }, { status: 400 });
      }
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
      cliente_nombre: String(body.cliente_nombre || "").slice(0, 200) || null,
      cliente_telefono: String(body.cliente_telefono || "").slice(0, 100) || null,
      usuario_id: body.usuario_id || null,
      usuario_email: String(body.usuario_email || "").slice(0, 320) || null,
      productos: products,
      carrito_token: String(body.carrito_token || "").slice(0, 500) || null,
      pais_id: branch.pais_id,
      sucursal_id: branch.id,
      request_key: requestKey,
      estado: "pendiente",
    };

    const { data, error } = await supabase
      .from("carritos_pendientes")
      .insert([payload])
      .select("id")
      .single();

    if (error?.code === "23505") {
      const existing = await supabase.from("carritos_pendientes").select("id").eq("request_key", requestKey).single();
      if (!existing.error && existing.data) return NextResponse.json({ success: true, id: existing.data.id, duplicate: true });
    }
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json({ success: true, id: data?.id });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
