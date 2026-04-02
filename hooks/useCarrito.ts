import { useState, useEffect, useCallback, useMemo } from 'react';
import { calcularPrecioConPromocion } from '../lib/promociones';
import { usePacks, calcularDescuentoPack } from '../lib/packs';

// Este hook centraliza todo lo relacionado al carrito: estado, operaciones y totales.
export function useCarrito(promociones: any) {
  const { packs, loading: loadingPacks } = usePacks() as any;
  const [carrito, setCarrito] = useState<any[]>([]);

  // cargar/guardar localstorage
  useEffect(() => {
    const stored = typeof window !== 'undefined' && localStorage.getItem('carrito_temporal');
    if (stored) {
      try { setCarrito(JSON.parse(stored)); } catch (e) { console.error('load carrito', e); }
    }
  }, []);
  useEffect(() => {
    if (carrito.length) {
      localStorage.setItem('carrito_temporal', JSON.stringify(carrito));
    } else {
      localStorage.removeItem('carrito_temporal');
    }
  }, [carrito]);

  const agregar = useCallback((prod: any) => {
    const precioInfo = calcularPrecioConPromocion(prod, promociones);
    const precioFinal = precioInfo.precioFinal;
    setCarrito(prev => {
      const existe = prev.find(p => p.user_id === prod.user_id);
      if (existe) {
        return prev.map(p => p.user_id === prod.user_id ? { ...p, cantidad: p.cantidad + 1 } : p);
      }
      return [...prev, { ...prod, cantidad: 1, precio: precioFinal }];
    });
  }, [promociones]);

  const agregarPack = useCallback((pack: any) => {
    const { precioIndividual, descuentoAbsoluto } = calcularDescuentoPack(pack);
    const itemPack: any = {
      user_id: `pack-${pack.id}`,
      nombre: `📦 ${pack.nombre}`,
      precio: pack.precio_pack,
      stock: 999,
      categoria: 'Pack Especial',
      cantidad: 1,
      tipo: 'pack',
      pack_id: pack.id,
      pack_data: pack,
      descuento_pack: descuentoAbsoluto
    };
    setCarrito(prev => {
      const existe = prev.find(p => p.user_id === itemPack.user_id);
      if (existe) {
        return prev.map(p => p.user_id === itemPack.user_id ? { ...p, cantidad: p.cantidad + 1 } : p);
      }
      return [...prev, itemPack];
    });
  }, []);

  const quitar = useCallback((user_id: any) => {
    setCarrito(prev => prev.filter(i => i.user_id !== user_id));
  }, []);

  const cambiarCantidad = useCallback((user_id: any, cantidad: number) => {
    setCarrito(prev => prev.map(i => i.user_id === user_id ? { ...i, cantidad: Math.max(1, cantidad) } : i));
  }, []);

  const subtotal = useMemo(() => {
    return carrito.reduce((acc, item) => {
      if (item.tipo === 'pack') {
        const pack = (packs as any[]).find((p: any) => p.id === item.pack_id);
        return acc + (pack ? pack.precio_pack * item.cantidad : 0);
      }
      const precioInfo = calcularPrecioConPromocion(item, promociones);
      return acc + precioInfo.precioFinal * item.cantidad;
    }, 0);
  }, [carrito, packs, promociones]);

  const totalDescuento = useMemo(() => {
    return carrito.reduce((acc, item) => {
      if (item.tipo === 'pack') {
        const pack = (packs as any[]).find((p: any) => p.id === item.pack_id);
        return acc + (pack ? (pack.precio_individual - pack.precio_pack) * item.cantidad : 0);
      }
      // simple descuento simulado
      const descuento = item.precio ? Number(item.precio) * (item.nombre?.toLowerCase().includes('promo') ? 0.1 : 0) * item.cantidad : 0;
      return acc + descuento;
    }, 0);
  }, [carrito, packs]);

  const total = subtotal;

  return {
    carrito,
    setCarrito,
    agregar,
    agregarPack,
    quitar,
    cambiarCantidad,
    subtotal,
    totalDescuento,
    total,
    loadingPacks
  };
}
