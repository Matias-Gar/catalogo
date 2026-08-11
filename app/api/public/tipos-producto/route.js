import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/SupabaseAdminClient";
import { PRODUCT_VIEW_OPTIONS } from "@/lib/productViews";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("tipos_producto")
    .select("slug, nombre, orden")
    .eq("activo", true)
    .order("orden", { ascending: true });
  if (error) return NextResponse.json({ success: true, tipos: PRODUCT_VIEW_OPTIONS });
  return NextResponse.json({
    success: true,
    tipos: (data || []).map((row) => ({ value: row.slug, label: row.nombre })),
  });
}
