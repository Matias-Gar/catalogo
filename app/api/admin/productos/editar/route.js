import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { getUserIdFromRequest } from "@/lib/authUserFromRequest";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseDecimalInput(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const parsed = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function requireAdmin(request) {
  const userId = await getUserIdFromRequest(request);
  if (!userId) return { error: "Unauthorized", status: 401 };

  const { data: profile, error } = await supabaseAdmin
    .from("perfiles")
    .select("rol")
    .eq("id", userId)
    .single();

  if (error || String(profile?.rol || "").toLowerCase() !== "admin") {
    return { error: "Solo el administrador puede editar productos", status: 403 };
  }

  return { userId };
}

function normalizeProductView(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "insumos" ? "insumos" : "articulos";
}

function cleanImageUrl(image) {
  if (!image) return "";
  if (typeof image === "string") return image;
  return String(image.imagen_url || "").trim();
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const productId = body?.productId;
    const activeSucursalId = body?.activeSucursalId || null;
    const cambios = body?.cambios || {};
    const nuevasVariantes = Array.isArray(body?.variantes) ? body.variantes : [];
    const nuevasImagenes = Array.isArray(body?.imagenes) ? body.imagenes : [];

    if (!productId) {
      return NextResponse.json({ success: false, error: "Producto requerido" }, { status: 400 });
    }

    let productQuery = supabaseAdmin.from("productos").select("*");
    if (Number.isFinite(Number(productId))) {
      productQuery = productQuery.eq("user_id", Number(productId));
    } else {
      productQuery = productQuery.eq("id", productId);
    }
    if (activeSucursalId) productQuery = productQuery.eq("sucursal_id", activeSucursalId);

    const { data: productoActual, error: productError } = await productQuery.single();
    if (productError || !productoActual) {
      return NextResponse.json({ success: false, error: productError?.message || "Producto no encontrado" }, { status: 404 });
    }

    const imagenPrincipal =
      String(cambios.primaryImageUrl || "").trim() ||
      cleanImageUrl(nuevasImagenes[0]) ||
      productoActual.imagen_url ||
      "/sin-imagen.png";

    const stockTotal = nuevasVariantes.reduce((acc, variant) => acc + (parseInt(variant?.stock, 10) || 0), 0);
    const updatePayload = {
      nombre: cambios.nombre ?? productoActual.nombre,
      descripcion: cambios.descripcion ?? productoActual.descripcion,
      precio: parseDecimalInput(cambios.precio, parseDecimalInput(productoActual.precio, 0)),
      vista_producto: normalizeProductView(cambios.vista_producto ?? productoActual.vista_producto),
      category_id: cambios.category_id ? parseInt(cambios.category_id, 10) : productoActual.category_id ?? null,
      codigo_barra: cambios.codigo_barra ?? productoActual.codigo_barra,
      stock: stockTotal,
      imagen_url: imagenPrincipal,
    };

    let updateQuery = supabaseAdmin.from("productos").update(updatePayload).eq("user_id", productoActual.user_id);
    if (activeSucursalId) updateQuery = updateQuery.eq("sucursal_id", activeSucursalId);
    const { error: updateError } = await updateQuery;
    if (updateError) throw updateError;

    let variantesQuery = supabaseAdmin
      .from("producto_variantes")
      .select("id")
      .eq("producto_id", productoActual.user_id);
    if (activeSucursalId) variantesQuery = variantesQuery.eq("sucursal_id", activeSucursalId);
    const { data: variantesBD, error: variantesError } = await variantesQuery;
    if (variantesError) throw variantesError;

    for (const variant of variantesBD || []) {
      if (!nuevasVariantes.some((item) => item.id === variant.id)) {
        const { error } = await supabaseAdmin.from("producto_variantes").delete().eq("id", variant.id);
        if (error) throw error;
      }
    }

    for (const variant of nuevasVariantes) {
      const payload = {
        color: variant.color,
        talla: variant.talla,
        stock: Math.max(0, Math.floor(Number(variant.stock) || 0)),
        stock_decimal: Number(variant.stock) || 0,
        sku: variant.sku,
        precio: parseDecimalInput(variant.precio, null),
        imagen_url: variant.imagen_url || null,
        activo: variant.activo !== undefined ? variant.activo : true,
      };

      if (variant.id) {
        const { error } = await supabaseAdmin.from("producto_variantes").update(payload).eq("id", variant.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin.from("producto_variantes").insert({
          ...payload,
          producto_id: productoActual.user_id,
          pais_id: productoActual.pais_id,
          sucursal_id: productoActual.sucursal_id,
          stock_inicial_decimal: Number(variant.stock) || 0,
        });
        if (error) throw error;
      }
    }

    let imagenesQuery = supabaseAdmin
      .from("producto_imagenes")
      .select("id, imagen_url")
      .eq("producto_id", productoActual.user_id);
    if (activeSucursalId) imagenesQuery = imagenesQuery.eq("sucursal_id", activeSucursalId);
    const { data: imagenesBD, error: imagenesError } = await imagenesQuery;
    if (imagenesError) throw imagenesError;

    for (const image of imagenesBD || []) {
      if (!nuevasImagenes.some((item) => item.id === image.id || cleanImageUrl(item) === image.imagen_url)) {
        const { error } = await supabaseAdmin.from("producto_imagenes").delete().eq("id", image.id);
        if (error) throw error;
      }
    }

    for (const image of nuevasImagenes) {
      const imagenUrl = cleanImageUrl(image);
      if (!image?.id && imagenUrl) {
        const { error } = await supabaseAdmin.from("producto_imagenes").insert({
          producto_id: productoActual.user_id,
          pais_id: productoActual.pais_id,
          sucursal_id: productoActual.sucursal_id,
          imagen_url: imagenUrl,
        });
        if (error) throw error;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || "No se pudo guardar el producto" },
      { status: 400 }
    );
  }
}
