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

function normalizeProductView(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ? normalized : "articulos";
}

async function resolveBranch({ paisId, sucursalId }) {
  let branch = null;

  if (sucursalId) {
    const { data } = await supabaseAdmin
      .from("sucursales")
      .select("id, pais_id, nombre")
      .eq("id", sucursalId)
      .maybeSingle();
    branch = data || null;
    if (branch && paisId && branch.pais_id !== paisId) {
      throw new Error("La sucursal seleccionada no pertenece al pais activo. Vuelve a seleccionar pais y sucursal.");
    }
  }

  if (!branch && paisId) {
    const { data } = await supabaseAdmin
      .from("sucursales")
      .select("id, pais_id, nombre")
      .eq("pais_id", paisId)
      .eq("activa", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    branch = data || null;
  }

  if (!branch) {
    const { data } = await supabaseAdmin
      .from("sucursales")
      .select("id, pais_id, nombre")
      .eq("activa", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    branch = data || null;
  }

  if (!branch?.id || !branch?.pais_id) {
    throw new Error("No hay una sucursal activa valida para crear productos.");
  }

  return { paisId: branch.pais_id, sucursalId: branch.id, branchName: branch.nombre || "" };
}

async function syncProductStock(productId, paisId, sucursalId) {
  const { data: variants } = await supabaseAdmin
    .from("producto_variantes")
    .select("stock, stock_decimal")
    .eq("producto_id", productId)
    .eq("pais_id", paisId)
    .eq("sucursal_id", sucursalId)
    .eq("activo", true);

  if (!Array.isArray(variants) || variants.length === 0) return 0;

  const total = variants.reduce((sum, variant) => {
    const decimal = Number(variant?.stock_decimal);
    const legacy = Number(variant?.stock);
    const hasDecimal = variant?.stock_decimal !== null && variant?.stock_decimal !== undefined && variant?.stock_decimal !== "";
    return sum + Math.max(0, hasDecimal && Number.isFinite(decimal) ? decimal : legacy || 0);
  }, 0);

  await supabaseAdmin
    .from("productos")
    .update({ stock: total })
    .eq("user_id", productId)
    .eq("pais_id", paisId)
    .eq("sucursal_id", sucursalId);

  return total;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const product = body?.product || {};
    const variants = Array.isArray(body?.variants) ? body.variants : [];
    const imageUrls = Array.isArray(body?.imageUrls) ? body.imageUrls : [];
    const { paisId, sucursalId, branchName } = await resolveBranch({
      paisId: body?.paisId || null,
      sucursalId: body?.sucursalId || null,
    });
    const auth = await requireAdminAccess(request, {
      paisId,
      sucursalId,
      allowedRoles: ["admin", "administracion", "almacen"],
    });
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    if (!String(product.nombre || "").trim()) {
      return NextResponse.json({ success: false, error: "Nombre de producto requerido" }, { status: 400 });
    }
    if (variants.length === 0) {
      return NextResponse.json({ success: false, error: "Debes agregar al menos un color" }, { status: 400 });
    }

    const duplicateQuery = await supabaseAdmin
      .from("productos")
      .select("user_id")
      .ilike("nombre", String(product.nombre).trim())
      .eq("pais_id", paisId)
      .eq("sucursal_id", sucursalId)
      .eq("archivado", false)
      .limit(1);

    if (duplicateQuery.error) throw duplicateQuery.error;
    if ((duplicateQuery.data || []).length > 0) {
      return NextResponse.json({ success: false, duplicateName: true, error: "Ya existe un producto con ese nombre en esta sucursal" }, { status: 409 });
    }

    const stockTotal = variants.reduce((sum, variant) => sum + Math.max(0, Number(variant.stock || 0)), 0);
    const baseInsertPayload = {
      nombre: String(product.nombre || "").trim(),
      descripcion: product.descripcion || "",
      precio: parseDecimalInput(product.precio, 0),
      precio_compra: parseDecimalInput(product.precio_compra, 0),
      stock: stockTotal,
      category_id: product.category_id ? parseInt(product.category_id, 10) : null,
      codigo_barra: String(product.codigo_barra || "").trim() || null,
      imagen_url: null,
      pais_id: paisId,
      sucursal_id: sucursalId,
      created_at: new Date().toISOString(),
    };

    const extendedInsertPayload = {
      ...baseInsertPayload,
      vista_producto: normalizeProductView(product.vista_producto),
      unidad_base: String(product.unidad_base || "unidad").trim() || "unidad",
      unidades_alternativas: Array.isArray(product.unidades_alternativas)
        ? product.unidades_alternativas.map((unit) => String(unit || "").trim()).filter(Boolean)
        : [],
      factor_conversion: Number(product.factor_conversion) > 0 ? Number(product.factor_conversion) : null,
    };

    const { data: productType, error: productTypeError } = await supabaseAdmin
      .from("tipos_producto")
      .select("slug")
      .eq("slug", extendedInsertPayload.vista_producto)
      .eq("activo", true)
      .maybeSingle();
    if (productTypeError || !productType) {
      return NextResponse.json({ success: false, error: "El tipo de producto seleccionado no existe o esta desactivado" }, { status: 400 });
    }

    let { data: insertedProducts, error: insertError } = await supabaseAdmin
      .from("productos")
      .insert([extendedInsertPayload])
      .select();

    if (insertError) {
      const rawMessage = String(insertError.message || "");
      if (rawMessage.includes("factor_conversion") || rawMessage.includes("unidad_base") || rawMessage.includes("unidades_alternativas")) {
        ({ data: insertedProducts, error: insertError } = await supabaseAdmin
          .from("productos")
          .insert([baseInsertPayload])
          .select());
      }
    }

    if (insertError) throw insertError;

    const insertedProduct = insertedProducts?.[0];
    const productId = insertedProduct?.id ?? insertedProduct?.user_id;
    if (!productId) throw new Error("Producto creado sin ID valido");

    if (imageUrls.length > 0) {
      const imagesToInsert = imageUrls
        .map((url) => String(url || "").trim())
        .filter(Boolean)
        .map((imagen_url) => ({ producto_id: productId, imagen_url, pais_id: paisId, sucursal_id: sucursalId }));
      if (imagesToInsert.length > 0) {
        const { error: imageError } = await supabaseAdmin.from("producto_imagenes").insert(imagesToInsert);
        if (imageError) throw imageError;
      }
    }

    const finalVariants = variants.map((variant) => {
      const stock = Math.max(0, Math.floor(Number(variant.stock || 0)));
      return {
        producto_id: productId,
        color: String(variant.color || "").trim() || "Unico",
        stock,
        stock_decimal: Number(variant.stock) || 0,
        stock_inicial: stock,
        stock_inicial_decimal: Number(variant.stock) || 0,
        precio: parseDecimalInput(variant.precio, null),
        sku: String(variant.sku || "").trim() || null,
        imagen_url: null,
        pais_id: paisId,
        sucursal_id: sucursalId,
        activo: variant.activo !== false,
      };
    });

    const { error: variantsError } = await supabaseAdmin.from("producto_variantes").insert(finalVariants);
    if (variantsError) throw variantsError;

    const syncedStock = await syncProductStock(productId, paisId, sucursalId);

    for (const variant of finalVariants) {
      const { data: variantRow } = await supabaseAdmin
        .from("producto_variantes")
        .select("id")
        .eq("producto_id", productId)
        .eq("color", variant.color)
        .eq("sku", variant.sku)
        .eq("pais_id", paisId)
        .eq("sucursal_id", sucursalId)
        .maybeSingle();

      await supabaseAdmin.from("stock_movimientos").insert([{
        producto_id: productId,
        variante_id: variantRow?.id || null,
        tipo: "stock_inicial",
        cantidad: variant.stock,
        unidad: extendedInsertPayload.unidad_base,
        cantidad_base: variant.stock,
        usuario_id: auth.userId,
        usuario_email: auth.email,
        pais_id: paisId,
        sucursal_id: sucursalId,
        observaciones: `Stock inicial para variante ${variant.color}`,
      }]);
    }

    await supabaseAdmin.from("stock_movimientos").insert([{
      producto_id: productId,
      tipo: "creacion",
      cantidad: syncedStock || stockTotal,
      unidad: extendedInsertPayload.unidad_base,
      cantidad_base: syncedStock || stockTotal,
      usuario_id: auth.userId,
      usuario_email: auth.email,
      pais_id: paisId,
      sucursal_id: sucursalId,
      observaciones: "Alta de producto desde panel",
    }]);

    await supabaseAdmin.from("productos_historial").insert([{
      producto_id: productId,
      accion: "CREATE",
      datos_anteriores: null,
      datos_nuevos: {
        ...baseInsertPayload,
        stock: syncedStock || stockTotal,
      },
      usuario_email: auth.email,
      pais_id: paisId,
      sucursal_id: sucursalId,
    }]);

    return NextResponse.json({
      success: true,
      productId,
      paisId,
      sucursalId,
      branchName,
      stock: syncedStock || stockTotal,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || "No se pudo crear el producto" },
      { status: 400 }
    );
  }
}
