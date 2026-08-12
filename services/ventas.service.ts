export async function insertarVentaPago(pago: GenericPayload) {
  // Limpiar claves undefined o null
  const cleanPago: GenericPayload = { ...pago };
  Object.keys(cleanPago).forEach(k => {
    if (cleanPago[k] === undefined || cleanPago[k] === null) delete cleanPago[k];
  });
  return supabase.from('ventas_pagos').insert([cleanPago]);
}
import { supabase } from '../lib/SupabaseClient';

type GenericPayload = Record<string, unknown>;
type ProductoId = string | number;

export async function crearVentaCompleta(payload: {
  venta: GenericPayload;
  items: GenericPayload[];
  pagos?: GenericPayload[];
  usuario_id?: string | null;
  usuario_email?: string | null;
  cashbox_id?: string;
}) {
  return supabase.rpc('crear_venta_completa', {
    p_venta: payload.venta,
    p_items: payload.items,
    p_pagos: payload.pagos || [],
    p_usuario_id: payload.usuario_id || null,
    p_usuario_email: payload.usuario_email || null,
    p_cashbox_id: payload.cashbox_id || 'main',
  });
}

export async function eliminarVentaConRestock(payload: {
  venta_id: ProductoId;
  admin_id?: string | null;
  admin_email?: string | null;
  motivo?: string | null;
}) {
  return supabase.rpc('eliminar_venta_con_restock', {
    p_venta_id: payload.venta_id,
    p_admin_id: payload.admin_id || null,
    p_admin_email: payload.admin_email || null,
    p_motivo: payload.motivo || null,
  });
}

// Inventory mutations intentionally live in transactional database RPCs. Do not
// add read/calculate/update fallbacks here: they lose updates under concurrency,
// bypass the ledger and turn insufficient-stock errors into silent truncation.

export async function guardarCarritoPendiente(payload: GenericPayload) {
  const response = await fetch('/api/carritos-pendientes-service-role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const result = await response.json();
  return {
    data: result?.id ? [{ id: result.id }] : null,
    error: response.ok && result?.success ? null : { message: result?.error || 'No se pudo guardar el pedido' },
  };
}

export async function fetchCarritosPendientes() {
  return supabase
    .from('carritos_pendientes')
    .select('id, cliente_nombre, cliente_telefono, productos, fecha')
    .order('fecha', { ascending: false });
}

export async function eliminarCarritoPendiente(id: ProductoId) {
  return supabase.from('carritos_pendientes').delete().eq('id', id);
}
