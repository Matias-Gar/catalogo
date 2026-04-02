import { supabase } from '../lib/SupabaseClient';

export async function crearVenta(data: any) {
  // remove keys undefined to avoid supabase column errors
  const payload = { ...data };
  Object.keys(payload).forEach(k => {
    if (payload[k] === undefined) delete payload[k];
  });
  return supabase.from('ventas').insert([payload]).select().single();
}

export async function insertarVentaDetalle(item: any) {
  return supabase.from('ventas_detalle').insert([item]);
}

export async function descontarStock(pid: any, cantidad: number) {
  return supabase.rpc('descontar_stock', { pid, cantidad_desc: cantidad });
}

export async function guardarCarritoPendiente(payload: any) {
  return supabase.from('carritos_pendientes').insert([payload]);
}

export async function fetchCarritosPendientes() {
  return supabase
    .from('carritos_pendientes')
    .select('id, cliente_nombre, cliente_telefono, productos, fecha')
    .order('fecha', { ascending: false });
}

export async function eliminarCarritoPendiente(id: any) {
  return supabase.from('carritos_pendientes').delete().eq('id', id);
}
