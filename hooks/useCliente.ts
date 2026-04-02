import { useState, useCallback } from 'react';
import { supabase } from '../lib/SupabaseClient';

export function useCliente() {
  const [cliente, setCliente] = useState<any>({
    nombre: '',
    carnet: '',
    telefono: '',
    email: '',
    nit: '',
    guardado: false,
    source: '',
    requiereFactura: false
  });

  const cambiarCampo = useCallback((campo: string, valor: any) => {
    setCliente((c: any) => ({ ...c, [campo]: valor }));
  }, []);

  const buscarPorCarnet = useCallback(async () => {
    const q = cliente.carnet.trim();
    if (!q) return alert('Ingresa número de carnet');

    // 1) perfiles
    try {
      const { data: perfil, error: perfilErr } = await supabase
        .from('perfiles')
        .select('id, nombre, nit_ci, ci_nit, telefono, email')
        .or(`nit_ci.ilike.%${q}%,ci_nit.ilike.%${q}%`)
        .limit(1)
        .maybeSingle();
      if (!perfilErr && perfil) {
        cambiarCampo('nombre', perfil.nombre || '');
        const nitval = perfil.nit_ci || perfil.ci_nit || q;
        cambiarCampo('carnet', nitval);
        cambiarCampo('telefono', perfil.telefono || '');
        if (perfil.email) {
          cambiarCampo('email', perfil.email);
          cambiarCampo('source', 'perfiles');
        } else {
          const { data: ventasHist } = await supabase
            .from('ventas')
            .select('cliente_email')
            .eq('cliente_nit', nitval)
            .order('fecha', { ascending: false })
            .limit(1);
          if (ventasHist && ventasHist[0]?.cliente_email) {
            cambiarCampo('email', ventasHist[0].cliente_email);
            cambiarCampo('source', 'ventas (histórico)');
          } else {
            cambiarCampo('source', 'perfiles');
          }
        }
        cambiarCampo('nit', nitval);
        cambiarCampo('guardado', false);
        return;
      }
    } catch (e: any) {
      console.warn('Error perfiles', e.message || e);
    }

    // 2) clientes legacy
    try {
      const { data: cli, error: cliErr } = await supabase
        .from('clientes')
        .select('id, nombre, carnet, telefono, email')
        .eq('carnet', q)
        .maybeSingle();
      if (!cliErr && cli) {
        setCliente({
          nombre: cli.nombre || '',
          carnet: cli.carnet || q,
          telefono: cli.telefono || '',
          email: cli.email || '',
          nit: cli.carnet || '',
          guardado: true,
          source: 'clientes'
        });
        return;
      }
    } catch (e: any) {
      console.warn('Error clientes', e.message || e);
    }

    // 3) ventas
    try {
      const { data: ventasByNit } = await supabase
        .from('ventas')
        .select('cliente_nombre, cliente_telefono, cliente_email')
        .eq('cliente_nit', q)
        .order('fecha', { ascending: false })
        .limit(1);
      if (ventasByNit && ventasByNit.length) {
        const v = ventasByNit[0];
        setCliente((c: any) => ({
          ...c,
          nombre: v.cliente_nombre || c.nombre,
          telefono: v.cliente_telefono || c.telefono,
          email: v.cliente_email || c.email,
          source: v.cliente_email ? 'ventas' : c.source,
          guardado: false
        }));
        return;
      }
    } catch (e: any) {
      console.warn('Error ventas', e.message || e);
    }

    setCliente((c: any) => ({ ...c, guardado: false, source: '' }));
    alert('Cliente no encontrado. Puedes añadirlo para búsquedas futuras.');
  }, [cliente.carnet, cambiarCampo]);

  const guardar = useCallback(async () => {
    if (!cliente.carnet.trim() || !cliente.nombre.trim() || !cliente.email.trim())
      return alert('Completa: carnet, nombre y correo para guardar');

    try {
      const { data: perfilExistente, error: perfilErr } = await supabase
        .from('perfiles')
        .select('id, nit_ci, ci_nit')
        .or(`nit_ci.ilike.%${cliente.carnet}%,ci_nit.ilike.%${cliente.carnet}%`)
        .limit(1)
        .maybeSingle();
      if (!perfilErr && perfilExistente) {
        const { error: upErr } = await supabase
          .from('perfiles')
          .update({
            nombre: cliente.nombre,
            telefono: cliente.telefono || null,
            email: cliente.email || null,
            nit_ci: cliente.carnet
          })
          .eq('id', perfilExistente.id);
        if (upErr) return alert('Error al actualizar perfil: ' + upErr.message);
        setCliente((c: any) => ({ ...c, guardado: true, source: 'perfiles' }));
        return alert('Perfil actualizado con datos del cliente');
      }
    } catch (e) {
      console.warn('guardarCliente perfil', e);
    }

    try {
      const { data, error } = await supabase.from('clientes').insert([{
        nombre: cliente.nombre,
        carnet: cliente.carnet,
        telefono: cliente.telefono || null,
        email: cliente.email || null
      }]).select().maybeSingle();
      if (error) {
        if (error.message?.toLowerCase().includes('duplicate') || error.code === '23505') {
          const { error: upErr } = await supabase.from('clientes').update({
            nombre: cliente.nombre,
            telefono: cliente.telefono || null,
            email: cliente.email || null
          }).eq('carnet', cliente.carnet);
          if (upErr) return alert('Error al actualizar cliente: ' + upErr.message);
          setCliente((c: any) => ({ ...c, guardado: true, source: 'clientes' }));
          return alert('Cliente actualizado y guardado');
        }
        return alert('Error al guardar cliente: ' + (error.message || ''));
      }
      setCliente((c: any) => ({ ...c, guardado: true, source: 'clientes' }));
      alert('Cliente guardado para futuras compras');
    } catch (e) {
      console.error(e);
      alert('Error inesperado al guardar cliente');
    }
  }, [cliente]);

  const buscarEmailHistorico = useCallback(async () => {
    try {
      const q = cliente.carnet.trim() || cliente.nit.trim();
      if (!q) return alert('Introduce carnet o NIT para buscar email histórico');
      const { data } = await supabase.from('ventas').select('cliente_email').or(`cliente_nit.ilike.%${q}%,cliente_telefono.ilike.%${q}%`).order('fecha', { ascending: false }).limit(1);
      if (data && data[0]?.cliente_email) {
        setCliente((c: any) => ({ ...c, email: data[0].cliente_email, source: 'ventas (histórico)' }));
        alert('Email recuperado desde ventas históricas');
      } else {
        alert('No se encontró email histórico');
      }
    } catch (e) { console.warn(e); alert('Error buscando email histórico'); }
  }, [cliente.carnet, cliente.nit]);

  return { cliente, cambiarCampo, buscarPorCarnet, guardar, buscarEmailHistorico };
}
