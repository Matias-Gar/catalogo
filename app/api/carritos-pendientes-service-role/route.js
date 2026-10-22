import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { quotePendingOrder, orderTotal, sameOrderRequest } from '@/lib/orderPricing.mjs';

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

    if (sucursalId && !branch) {
      return NextResponse.json({ success: false, error: 'Sucursal no disponible en el país seleccionado' }, { status: 400 });
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

    const existing = await supabase.from('carritos_pendientes').select('id,productos,pais_id,sucursal_id,carrito_token')
      .eq('request_key', requestKey).maybeSingle();
    if (existing.error) throw existing.error;
    const respondExisting = order => {
      if (String(order.pais_id) !== String(branch.pais_id) || String(order.sucursal_id) !== String(branch.id)
          || String(order.carrito_token || '') !== String(body.carrito_token || ''))
        return NextResponse.json({ success: false, error: 'La clave del pedido pertenece a otra sesión o sucursal' }, { status: 409 });
      if (!sameOrderRequest(order.productos, products))
        return NextResponse.json({ success: false, error: 'La clave del pedido ya se usó con otros productos o cantidades' }, { status: 409 });
      if (body.total_esperado != null && (!Number.isFinite(Number(body.total_esperado))
          || Math.abs(Number(body.total_esperado) - orderTotal(order.productos)) > 0.005))
        return NextResponse.json({ success: false, error: 'El total confirmado no coincide con el pedido ya guardado. Revisa el pedido antes de reenviarlo.' }, { status: 409 });
      return NextResponse.json({ success: true, id: order.id, productos: order.productos,
        total: orderTotal(order.productos), duplicate: true });
    };
    if (existing.data) return respondExisting(existing.data);

    const ids = [...new Set(products.filter(p => p.tipo !== 'pack').map(p => p.producto_id))];
    const scoped = (table, columns) => supabase.from(table).select(columns)
      .eq('pais_id', branch.pais_id).eq('sucursal_id', branch.id);
    const results = await Promise.all([
      ids.length ? scoped('productos', 'user_id,nombre,precio,unidad_base,unidades_alternativas,factor_conversion,producto_variantes(id,color,precio,activo)')
        .in('user_id', ids).eq('archivado', false) : { data: [] },
      ids.length ? scoped('promociones', '*').in('producto_id', ids).eq('activa', true) : { data: [] },
      products.some(p => p.tipo === 'pack') ? scoped('packs', 'id,nombre,precio_pack,activo,fecha_inicio,fecha_fin,pack_productos(producto_id,variante_id,cantidad)')
        .in('id', products.filter(p => p.tipo === 'pack').map(p => p.pack_id)).eq('activo', true) : { data: [] },
    ]);
    for (const result of results) if (result.error) throw result.error;
    const quoted = quotePendingOrder(products, results[0].data || [], results[1].data || [], results[2].data || []);
    if (body.total_esperado != null && (!Number.isFinite(Number(body.total_esperado))
        || Math.abs(Number(body.total_esperado) - orderTotal(quoted)) > 0.005)) {
      return NextResponse.json({ success: false, error: 'Los precios o promociones cambiaron. Recarga la página y revisa el total antes de enviar el pedido.' }, { status: 409 });
    }
    const payload = {
      cliente_nombre: String(body.cliente_nombre || "").slice(0, 200) || null,
      cliente_telefono: String(body.cliente_telefono || "").slice(0, 100) || null,
      usuario_id: body.usuario_id || null,
      usuario_email: String(body.usuario_email || "").slice(0, 320) || null,
      productos: quoted,
      carrito_token: String(body.carrito_token || "").slice(0, 500) || null,
      pais_id: branch.pais_id,
      sucursal_id: branch.id,
      request_key: requestKey,
      estado: "pendiente",
    };

    const { data, error } = await supabase
      .from("carritos_pendientes")
      .insert([payload])
      .select("id,productos")
      .single();

    if (error?.code === "23505") {
      const retry = await supabase.from('carritos_pendientes').select('id,productos,pais_id,sucursal_id,carrito_token').eq('request_key', requestKey).single();
      if (!retry.error && retry.data) return respondExisting(retry.data);
    }
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }

    return NextResponse.json({ success: true, id: data?.id, productos: data?.productos || quoted, total: orderTotal(data?.productos || quoted) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
