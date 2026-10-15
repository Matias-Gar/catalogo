import { calcularPrecioConPromocion } from './promociones';
import type { CartItem } from '../hooks/useCarrito';
import { discountLimit } from './saleDiscountPolicy.mjs';
import type { Pack } from '../hooks/useCarrito';

// El descuento manual es un importe en Bs para toda la linea.
export function calcularLineaVenta(item: CartItem, promociones: unknown[], packs: Pack[] = []) {
  const info = calcularPrecioConPromocion(item, promociones);
  const cantidad = Math.max(0, Number(item.cantidad_base ?? item.cantidad) || 0);
  const bruto = info.precioOriginal * cantidad;
  const promocional = info.precioFinal * cantidad;
  const solicitado = Number(item.descuento_manual) || 0;
  const enPack = packs.some(pack => pack.pack_productos?.some(p => String(p.productos.user_id) === String(item.user_id)));
  const limite = discountLimit({ price: info.precioOriginal, cost: item.precio_compra, quantity: cantidad,
    promotion: info.tienePromocion, pack: item.tipo === 'pack' || enPack });
  const manual = Math.min(limite.max, Math.max(0, Number.isFinite(solicitado) ? solicitado : 0));
  const total = Math.round((promocional - manual) * 100) / 100;
  const precio = cantidad > 0 ? total / cantidad : 0;
  return { bruto, total, manual, maxManual: limite.max, motivoLimite: limite.reason, precioOriginal: info.precioOriginal,
    precio, descuento: bruto - total, descuentoUnitario: info.precioOriginal - precio };
}
