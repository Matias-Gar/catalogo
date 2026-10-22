// Solo importes, productos y cantidades del pedido 8; sin datos de cliente.
export const products = [
  { user_id: 203, nombre: 'Guardián de la Cripta', precio: 140, precio_compra: 21.6, producto_variantes: [{ id: 247, precio: null }] },
  { user_id: 227, nombre: 'Pacto Eterno', precio: 140, precio_compra: 13, producto_variantes: [{ id: 271, precio: null }] },
  { user_id: 223, nombre: 'Cráneo Encantado', precio: 150, precio_compra: 17.28, producto_variantes: [{ id: 267, precio: null }] },
  { user_id: 198, nombre: 'Capibara Banana', precio: 40, precio_compra: 9.6, producto_variantes: [{ id: 242, precio: null }] },
];
export const promotions = [203, 227, 223].map(producto_id => ({ producto_id, activa: true, tipo: 'descuento', valor: 25 }));
export const orderItems = products.map(product => {
  const cantidad = product.user_id === 223 ? 6 : 1;
  const price = product.precio * (product.user_id === 198 ? 1 : 0.75);
  return { tipo: 'producto', producto_id: product.user_id, variante_id: product.producto_variantes[0].id,
    nombre: product.nombre, cantidad, cantidad_base: cantidad, unidad: 'unidad',
    precio_unitario: price, precio_original: price, promocion_aplicada: null };
});
