import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { normalizeProductView } from "@/lib/productViews";

export async function GET(request) {
  const sucursalId = new URL(request.url).searchParams.get("sucursalId");
  if (!sucursalId) return NextResponse.json({ success: true, previews: {} });

  const { data: products, error } = await supabaseAdmin
    .from("productos")
    .select("user_id, category_id, vista_producto, imagen_url, categorias (categori)")
    .eq("sucursal_id", sucursalId)
    .or("archivado.eq.false,archivado.is.null");

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  const productIds = (products || []).map((product) => product.user_id).filter(Boolean);
  let galleryByProduct = {};
  if (productIds.length) {
    const { data: images } = await supabaseAdmin.from("producto_imagenes")
      .select("producto_id, imagen_url").eq("sucursal_id", sucursalId).in("producto_id", productIds);
    galleryByProduct = (images || []).reduce((result, image) => {
      if (image.imagen_url && !result[String(image.producto_id)]) result[String(image.producto_id)] = image.imagen_url;
      return result;
    }, {});
  }

  const previews = {};
  for (const product of products || []) {
    const view = normalizeProductView(product.vista_producto);
    previews[view] ||= { count: 0, categories: [] };
    previews[view].count += 1;
    if (!product.category_id) continue;
    let category = previews[view].categories.find((item) => String(item.id) === String(product.category_id));
    if (!category) {
      category = { id: product.category_id, name: product.categorias?.categori || "Sin categoría", imageUrl: null, productCount: 0 };
      previews[view].categories.push(category);
    }
    category.productCount += 1;
    category.imageUrl ||= product.imagen_url || galleryByProduct[String(product.user_id)] || null;
  }
  Object.values(previews).forEach((preview) => preview.categories.sort((a, b) => a.name.localeCompare(b.name, "es")));
  return NextResponse.json({ success: true, previews });
}
