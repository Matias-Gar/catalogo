// --- SINCRONIZACIÓN GLOBAL DE STOCK DE PRODUCTO ---
export async function sincronizarStockProducto(producto_id, supabase) {
  // Suma el stock de todas las variantes activas y actualiza productos.stock
  const { data: variantes } = await supabase
    .from("producto_variantes")
    .select("stock")
    .eq("producto_id", producto_id)
    .eq("activo", true);
  const stockTotal = (variantes || []).reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  await supabase.from("productos").update({ stock: stockTotal }).eq("user_id", producto_id);
  return stockTotal;
}

// --- VALIDACIÓN GLOBAL DE PRODUCTO Y VARIANTES ---
export function validarProducto({ nombre, descripcion, variantes, imagenes }) {
  const errores = [];
  if (!nombre || nombre.trim().length < 2) errores.push("El nombre es obligatorio.");
  if (!descripcion || descripcion.trim().length < 5) errores.push("La descripción es obligatoria.");
  if (!imagenes || imagenes.length === 0) errores.push("Debes subir al menos una imagen.");
  if (!variantes || variantes.length === 0) errores.push("Debes definir al menos una variante.");
  const colores = new Set();
  for (const v of variantes) {
    if (!v.color || v.color.trim().length === 0) errores.push("Todas las variantes deben tener color.");
    if (colores.has(v.color.trim().toLowerCase())) errores.push("No puede haber variantes con el mismo color.");
    colores.add(v.color.trim().toLowerCase());
    if (v.stock === undefined || v.stock === null || isNaN(Number(v.stock)) || Number(v.stock) < 0) errores.push("Todas las variantes deben tener stock válido.");
  }
  return errores;
}
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
