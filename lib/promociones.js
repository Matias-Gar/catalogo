// Utilidades para manejar promociones
export const calcularPrecioConPromocion = (producto, promociones) => {
  // Buscar promoción activa para este producto
  const promocionActiva = promociones.find(
    promo => 
      promo.producto_id === producto.user_id && 
      promo.activa === true &&
      (!promo.fecha_fin || new Date(promo.fecha_fin) >= new Date())
  );

  if (!promocionActiva) {
    return {
      precioOriginal: producto.precio,
      precioFinal: producto.precio,
      tienePromocion: false,
      promocion: null
    };
  }

  let precioFinal = producto.precio;

  // Calcular precio según tipo de promoción
  switch (promocionActiva.tipo) {
    case 'descuento':
      // Descuento en porcentaje
      precioFinal = producto.precio * (1 - promocionActiva.valor / 100);
      break;
    case 'precio_fijo':
      // Precio fijo
      precioFinal = promocionActiva.valor;
      break;
    case 'descuento_absoluto':
      // Descuento en cantidad fija
      precioFinal = Math.max(0, producto.precio - promocionActiva.valor);
      break;
    default:
      precioFinal = producto.precio;
  }

  return {
    precioOriginal: producto.precio,
    precioFinal: Math.max(0, precioFinal),
    tienePromocion: true,
    promocion: promocionActiva,
    descuento: producto.precio - precioFinal,
    porcentajeDescuento: ((producto.precio - precioFinal) / producto.precio * 100).toFixed(0)
  };
};

// Componente mejorado para mostrar precio con promoción
export const PrecioConPromocion = ({ producto, promociones, className = "", compact = false, showBadge = true, showPacks = false }) => {
  const precio = calcularPrecioConPromocion(producto, promociones);

  if (!precio.tienePromocion) {
    return (
      <div className={className}>
        <span className="font-bold text-blue-700">
          Bs {precio.precioFinal.toFixed(2)}
        </span>
        {showPacks && <PacksDisponibles productoId={producto.user_id} />}
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`${className}`}>
        <div className="flex items-center flex-wrap gap-1">
          <span className="text-red-500 line-through text-sm">
            Bs {precio.precioOriginal.toFixed(2)}
          </span>
          <span className="font-bold text-green-600">
            Bs {precio.precioFinal.toFixed(2)}
          </span>
          {showBadge && (
            <span className="bg-red-500 text-white px-1 py-0.5 rounded text-xs font-bold">
              -{precio.porcentajeDescuento}%
            </span>
          )}
        </div>
        {precio.promocion?.descripcion && (
          <div className="text-xs text-green-600 font-medium mt-1">
            {precio.promocion.descripcion}
          </div>
        )}
        {showPacks && <PacksDisponibles productoId={producto.user_id} />}
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="flex flex-col items-start">
        <span className="text-red-500 line-through text-sm">
          Bs {precio.precioOriginal.toFixed(2)}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-green-600 text-lg">
            Bs {precio.precioFinal.toFixed(2)}
          </span>
          {showBadge && (
            <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs font-bold">
              -{precio.porcentajeDescuento}%
            </span>
          )}
        </div>
        {precio.promocion?.descripcion && (
          <div className="text-xs text-green-600 font-medium mt-1">
            🎯 {precio.promocion.descripcion}
          </div>
        )}
      </div>
      {showPacks && <PacksDisponibles productoId={producto.user_id} />}
    </div>
  );
};

// Componente de Packs Disponibles (importado desde packs.js cuando esté disponible)
const PacksDisponibles = ({ productoId: _ }) => {
  // Este componente será reemplazado por el import real cuando se integre
  return null;
};