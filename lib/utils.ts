// --- SINCRONIZACIÓN GLOBAL DE STOCK DE PRODUCTO ---

interface Variante {
  stock: number | string | null;
  // Agrega aquí otras propiedades si las usas (ej: id, color, etc)
}

export async function sincronizarStockProducto(
  producto_id: string | number,
  supabase: any
): Promise<number> {
  // Consulta tipada
  const { data: variantes } = await supabase
    .from("producto_variantes")
    .select("stock")
    .eq("producto_id", producto_id)
    .eq("activo", true);

  // Tipar variantes como Variante[]
  const variantesList: Variante[] = Array.isArray(variantes) ? variantes : [];

  // Reduce tipado correctamente
  const stockTotal = variantesList.reduce<number>(
    (sum, v) => sum + (Number(v.stock) || 0),
    0
  );

  // Actualiza el stock en productos
  await supabase
    .from("productos")
    .update({ stock: stockTotal })
    .eq("user_id", producto_id);

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
