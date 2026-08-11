import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { requireAdminAccess } from "@/lib/adminAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function parseDecimalInput(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const parsed = Number(String(value).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getEffectiveVariantStock(variant) {
  const decimal = Number(variant?.stock_decimal);
  const legacy = Number(variant?.stock);
  const hasDecimal = variant?.stock_decimal !== null && variant?.stock_decimal !== undefined && variant?.stock_decimal !== "";
  return Math.max(0, hasDecimal && Number.isFinite(decimal) ? decimal : legacy || 0);
}

function hasUnitConversion(product) {
  return Boolean(
    Array.isArray(product?.unidades_alternativas) &&
      product.unidades_alternativas.length > 0 &&
      Number(product?.factor_conversion || 0) > 0
  );
}

function normalizeProductView(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ? normalized : "articulos";
}

function cleanImageUrl(image) {
  if (!image) return "";
  if (typeof image === "string") return image;
  return String(image.imagen_url || "").trim();
}

export async function POST(request) {
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

    const auth = await requireAdminAccess(request, {
      paisId: productoActual.pais_id,
      sucursalId: productoActual.sucursal_id,
      allowedRoles: ["admin", "administracion"],
    });
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    const imageUrlsAfterSave = nuevasImagenes.map(cleanImageUrl).filter(Boolean);
    const requestedPrimaryImageUrl = String(cambios.primaryImageUrl || "").trim();
    const imagenPrincipal =
      (requestedPrimaryImageUrl && imageUrlsAfterSave.includes(requestedPrimaryImageUrl)
        ? requestedPrimaryImageUrl
        : "") ||
      imageUrlsAfterSave[0] ||
      "/sin-imagen.png";

    let variantesQuery = supabaseAdmin
      .from("producto_variantes")
      .select("id, producto_id, color, stock, stock_decimal, sku, precio, imagen_url, activo")
      .eq("producto_id", productoActual.user_id);
    if (activeSucursalId) variantesQuery = variantesQuery.eq("sucursal_id", activeSucursalId);
    const { data: variantesBD, error: variantesError } = await variantesQuery;
    if (variantesError) throw variantesError;

    const productHasConversion = hasUnitConversion(productoActual);
    const hasVariantsAfterSave = nuevasVariantes.length > 0;
    const stockTotal = hasVariantsAfterSave
      ? nuevasVariantes.reduce((acc, variant) => acc + getEffectiveVariantStock(variant), 0)
      : Math.max(0, Number(productoActual.stock || 0));
    const variantesActualesById = new Map((variantesBD || []).map((variant) => [String(variant.id), variant]));

    for (const variant of variantesBD || []) {
      if (!nuevasVariantes.some((item) => String(item.id || "") === String(variant.id || ""))) {
        const stockActual = getEffectiveVariantStock(variant);
        if (stockActual > 0.0001) {
          return NextResponse.json(
            {
              success: false,
              error: `No se puede eliminar la variante "${variant.color || variant.id}" porque todavia tiene stock (${stockActual}). Primero transfierelo, vendelo o ajustalo desde el modulo de stock.`,
            },
            { status: 400 }
          );
        }
      }
    }

    const updatePayload = {
      nombre: cambios.nombre ?? productoActual.nombre,
      descripcion: cambios.descripcion ?? productoActual.descripcion,
      precio: parseDecimalInput(cambios.precio, parseDecimalInput(productoActual.precio, 0)),
      vista_producto: normalizeProductView(cambios.vista_producto ?? productoActual.vista_producto),
      category_id: cambios.category_id ? parseInt(cambios.category_id, 10) : productoActual.category_id ?? null,
      codigo_barra: cambios.codigo_barra ?? productoActual.codigo_barra,
      stock: hasVariantsAfterSave ? stockTotal : Math.max(0, Number(productoActual.stock || 0)),
      imagen_url: imagenPrincipal,
    };

    const { data: productType, error: productTypeError } = await supabaseAdmin
      .from("tipos_producto")
      .select("slug")
      .eq("slug", updatePayload.vista_producto)
      .eq("activo", true)
      .maybeSingle();
    if (productTypeError || !productType) {
      return NextResponse.json({ success: false, error: "El tipo de producto seleccionado no existe o esta desactivado" }, { status: 400 });
    }

    let updateQuery = supabaseAdmin.from("productos").update(updatePayload).eq("user_id", productoActual.user_id);
    if (activeSucursalId) updateQuery = updateQuery.eq("sucursal_id", activeSucursalId);
    const { error: updateError } = await updateQuery;
    if (updateError) throw updateError;

    for (const variant of variantesBD || []) {
      if (!nuevasVariantes.some((item) => String(item.id || "") === String(variant.id || ""))) {
        const { error } = await supabaseAdmin.from("producto_variantes").delete().eq("id", variant.id);
        if (error) throw error;
      }
    }

    for (const variant of nuevasVariantes) {
      const payload = {
        color: variant.color,
        stock: Math.max(0, Math.floor(Number(variant.stock) || 0)),
        stock_decimal: Number(variant.stock) || 0,
        sku: variant.sku || variant.codigo_barra || null,
        precio: parseDecimalInput(variant.precio, null),
        imagen_url: variant.imagen_url || null,
        activo: variant.activo !== undefined ? variant.activo : true,
      };

      if (variant.id) {
        const stockAntes = getEffectiveVariantStock(variantesActualesById.get(String(variant.id)));
        const stockDespues = getEffectiveVariantStock(payload);
        const { error } = await supabaseAdmin.from("producto_variantes").update(payload).eq("id", variant.id);
        if (error) throw error;
        const delta = stockDespues - stockAntes;
        if (Math.abs(delta) > 0.0001) {
          const { error: movementError } = await supabaseAdmin.from("stock_movimientos").insert([{
            producto_id: productoActual.user_id,
            variante_id: variant.id,
            tipo: delta > 0 ? "ajuste_positivo" : "ajuste_negativo",
            cantidad: Math.abs(delta),
            cantidad_base: Math.abs(delta),
            unidad: productoActual.unidad_base || "unidad",
            pais_id: productoActual.pais_id || null,
            sucursal_id: productoActual.sucursal_id || null,
            usuario_id: auth.userId,
            usuario_email: auth.email,
            stock_antes: stockAntes,
            stock_despues: stockDespues,
            motivo: "edicion_producto",
            observaciones: "Ajuste de stock desde edicion de producto",
          }]);
          if (movementError) throw movementError;
        }
      } else {
        const { data: insertedVariant, error } = await supabaseAdmin.from("producto_variantes").insert({
          ...payload,
          producto_id: productoActual.user_id,
          pais_id: productoActual.pais_id,
          sucursal_id: productoActual.sucursal_id,
          stock_inicial_decimal: Number(variant.stock) || 0,
        }).select("id").single();
        if (error) throw error;
        const stockNuevo = getEffectiveVariantStock(payload);
        if (stockNuevo > 0.0001) {
          const { error: movementError } = await supabaseAdmin.from("stock_movimientos").insert([{
            producto_id: productoActual.user_id,
            variante_id: insertedVariant?.id || null,
            tipo: "ajuste_positivo",
            cantidad: stockNuevo,
            cantidad_base: stockNuevo,
            unidad: productoActual.unidad_base || "unidad",
            pais_id: productoActual.pais_id || null,
            sucursal_id: productoActual.sucursal_id || null,
            usuario_id: auth.userId,
            usuario_email: auth.email,
            stock_antes: 0,
            stock_despues: stockNuevo,
            motivo: "edicion_producto",
            observaciones: `Stock inicial de nueva variante ${variant.color || ""}`.trim(),
          }]);
          if (movementError) throw movementError;
        }
      }
    }

    if (hasVariantsAfterSave) {
      let resyncQuery = supabaseAdmin
        .from("productos")
        .update({ stock: stockTotal })
        .eq("user_id", productoActual.user_id);
      if (activeSucursalId) resyncQuery = resyncQuery.eq("sucursal_id", activeSucursalId);
      const { error: resyncError } = await resyncQuery;
      if (resyncError) throw resyncError;
    }

    let imagenesQuery = supabaseAdmin
      .from("producto_imagenes")
      .select("id, imagen_url")
      .eq("producto_id", productoActual.user_id);
    if (activeSucursalId) imagenesQuery = imagenesQuery.eq("sucursal_id", activeSucursalId);
    const { data: imagenesBD, error: imagenesError } = await imagenesQuery;
    if (imagenesError) throw imagenesError;

    for (const image of imagenesBD || []) {
      if (!nuevasImagenes.some((item) => String(item.id || "") === String(image.id || "") || cleanImageUrl(item) === image.imagen_url)) {
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

    return NextResponse.json({
      success: true,
      totalStock: hasVariantsAfterSave ? stockTotal : updatePayload.stock,
      stockMode: hasVariantsAfterSave
        ? productHasConversion ? "variantes_con_conversion" : "variantes"
        : "producto",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || "No se pudo guardar el producto" },
      { status: 400 }
    );
  }
}
