import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { requireAdminAccess } from "@/lib/adminAccess";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getEffectiveStock(row) {
  const decimal = Number(row?.stock_decimal);
  const legacy = Number(row?.stock);
  const hasDecimal = row?.stock_decimal !== null && row?.stock_decimal !== undefined && row?.stock_decimal !== "";
  return Math.max(0, hasDecimal && Number.isFinite(decimal) ? decimal : legacy || 0);
}

function hasUnitConversion(product) {
  return Boolean(
    Array.isArray(product?.unidades_alternativas) &&
      product.unidades_alternativas.length > 0 &&
      Number(product?.factor_conversion || 0) > 0
  );
}

async function setProductStock(productId, paisId, sucursalId, stock) {
  let updateQuery = supabaseAdmin
    .from("productos")
    .update({ stock })
    .eq("user_id", productId);
  if (paisId) updateQuery = updateQuery.eq("pais_id", paisId);
  if (sucursalId) updateQuery = updateQuery.eq("sucursal_id", sucursalId);
  const { error } = await updateQuery;
  if (error) throw error;
  return stock;
}

async function syncProductStock(product, paisId, sucursalId) {
  const productId = product.user_id;
  let variantsQuery = supabaseAdmin
    .from("producto_variantes")
    .select("stock, stock_decimal")
    .eq("producto_id", productId)
    .eq("activo", true);
  if (paisId) variantsQuery = variantsQuery.eq("pais_id", paisId);
  if (sucursalId) variantsQuery = variantsQuery.eq("sucursal_id", sucursalId);

  const { data: variants, error: variantsError } = await variantsQuery;
  if (variantsError) throw variantsError;

  if (!Array.isArray(variants) || variants.length === 0) {
    return Math.max(0, Number(product?.stock || 0));
  }

  const totalStock = variants.reduce((sum, variant) => sum + getEffectiveStock(variant), 0);
  return setProductStock(productId, paisId, sucursalId, totalStock);
}

async function registerAudit({
  product,
  productId,
  variantId = null,
  displayIncrease,
  baseIncrease,
  selectedUnit,
  userId,
  userEmail,
  totalStock,
  stockBefore = null,
  stockAfter = null,
  note,
}) {
  const movement = await supabaseAdmin.from("stock_movimientos").insert([
    {
      producto_id: Number(productId),
      variante_id: variantId == null ? null : Number(variantId),
      tipo: "aumento",
      cantidad: Number(displayIncrease),
      cantidad_base: Number(baseIncrease),
      unidad: selectedUnit || null,
      pais_id: product.pais_id || null,
      sucursal_id: product.sucursal_id || null,
      usuario_id: userId,
      usuario_email: userEmail,
      stock_antes: stockBefore,
      stock_despues: stockAfter,
      observaciones: note,
    },
  ]);
  if (movement.error) throw movement.error;

  const history = await supabaseAdmin.from("productos_historial").insert([
    {
      producto_id: Number(productId),
      accion: "UPDATE",
      datos_anteriores: product,
      datos_nuevos: { ...product, stock: totalStock },
      pais_id: product.pais_id || null,
      sucursal_id: product.sucursal_id || null,
      usuario_email: userEmail || null,
    },
  ]);
  if (history.error) throw history.error;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const productId = Number(body?.productId);
    const variantId = body?.variantId == null ? null : Number(body.variantId);
    const paisId = body?.paisId || null;
    const sucursalId = body?.sucursalId || null;
    const baseIncrease = Number(body?.baseIncrease || 0);
    const displayIncrease = Number(body?.displayIncrease || 0);
    const selectedUnit = String(body?.selectedUnit || "").trim() || null;
    const mode = body?.mode === "variant" ? "variant" : "product";

    const auth = await requireAdminAccess(request, {
      paisId,
      sucursalId,
      allowedRoles: ["admin", "administracion", "almacen"],
    });
    if (auth.error) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });

    if (!productId || !paisId || !sucursalId || !Number.isFinite(baseIncrease) || baseIncrease <= 0) {
      return NextResponse.json({ success: false, error: "Datos incompletos para aumentar stock" }, { status: 400 });
    }

    const { data: product, error: productError } = await supabaseAdmin
      .from("productos")
      .select("*")
      .eq("user_id", productId)
      .eq("pais_id", paisId)
      .eq("sucursal_id", sucursalId)
      .single();

    if (productError || !product) {
      return NextResponse.json({ success: false, error: productError?.message || "Producto no encontrado" }, { status: 404 });
    }

    let nextVariantStock = null;
    let stockBefore = null;
    let stockAfter = null;
    let productStockAfter = Math.max(0, Number(product.stock || 0));
    if (mode === "variant") {
      if (!variantId) {
        return NextResponse.json({ success: false, error: "Variante requerida" }, { status: 400 });
      }

      const { data: variant, error: variantError } = await supabaseAdmin
        .from("producto_variantes")
        .select("*")
        .eq("id", variantId)
        .eq("producto_id", productId)
        .eq("pais_id", paisId)
        .eq("sucursal_id", sucursalId)
        .single();
      if (variantError || !variant) {
        return NextResponse.json({ success: false, error: variantError?.message || "Variante no encontrada" }, { status: 404 });
      }

      stockBefore = getEffectiveStock(variant);
      nextVariantStock = stockBefore + baseIncrease;
      stockAfter = nextVariantStock;
      const { error: updateVariantError } = await supabaseAdmin
        .from("producto_variantes")
        .update({
          stock_decimal: nextVariantStock,
          stock: Math.floor(nextVariantStock),
        })
        .eq("id", variantId);
      if (updateVariantError) throw updateVariantError;
    } else {
      stockBefore = Math.max(0, Number(product.stock || 0));
      const nextProductStock = stockBefore + baseIncrease;
      stockAfter = nextProductStock;
      productStockAfter = await setProductStock(productId, paisId, sucursalId, nextProductStock);
    }

    const productForSync = { ...product, stock: productStockAfter };
    const totalStock = await syncProductStock(productForSync, paisId, sucursalId);
    await registerAudit({
      product,
      productId,
      variantId: mode === "variant" ? variantId : null,
      displayIncrease,
      baseIncrease,
      selectedUnit,
      userId: auth.userId,
      userEmail: auth.email,
      totalStock,
      stockBefore,
      stockAfter,
      note:
        mode === "variant"
          ? `Aumento de stock en variante desde panel (${displayIncrease} ${selectedUnit || ""})`
          : `Aumento de stock desde panel (${displayIncrease} ${selectedUnit || ""})`,
    });

    return NextResponse.json({ success: true, totalStock, nextVariantStock });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || "No se pudo aumentar stock" },
      { status: 400 }
    );
  }
}
