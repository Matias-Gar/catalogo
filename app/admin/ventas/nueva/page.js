
"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from '@supabase/supabase-js';
// Función para efectivizar venta y descontar stock
// Debe ir dentro del componente
import { supabase } from "../../../../lib/SupabaseClient";
import { PrecioConPromocion, calcularPrecioConPromocion } from "../../../../lib/promociones";
import { usePromociones } from "../../../../lib/usePromociones";
import { usePacks, calcularDescuentoPack } from "../../../../lib/packs";

// Utilidad para agrupar imágenes por producto
function agruparImagenes(imgs) {
  const agrupadas = {};
  imgs.forEach(img => {
    if (!agrupadas[img.producto_id]) agrupadas[img.producto_id] = [];
    agrupadas[img.producto_id].push(img.imagen_url);
  });
  return agrupadas;
}

export default function NuevaVenta() {
  const [productos, setProductos] = useState([]);
  const [imagenesProductos, setImagenesProductos] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [carrito, setCarrito] = useState([]);
  const [clienteNombre, setClienteNombre] = useState("");
  const [clienteTelefono, setClienteTelefono] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [clienteNIT, setClienteNIT] = useState("");
  const [requiereFactura, setRequiereFactura] = useState(false);
  const [modoPago, setModoPago] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [codigoBarra, setCodigoBarra] = useState("");
  const inputBarraRef = useRef(null);
  const [carritosPendientes, setCarritosPendientes] = useState([]);
  const [efectivizando, setEfectivizando] = useState(false);
  const [usuario, setUsuario] = useState(null);
  
  // Hook para promociones
  const { promociones, loading: loadingPromociones } = usePromociones();
  
  // Hook para packs
  const { packs, loading: loadingPacks } = usePacks();

  // Cargar carrito desde localStorage al iniciar
  useEffect(() => {
    const carritoGuardado = localStorage.getItem('carrito_temporal');
    if (carritoGuardado) {
      try {
        const carritoParseado = JSON.parse(carritoGuardado);
        setCarrito(carritoParseado);
      } catch (error) {
        console.error('Error al cargar carrito:', error);
      }
    }
  }, []);

  // Guardar carrito en localStorage cuando cambie
  useEffect(() => {
    if (carrito.length > 0) {
      localStorage.setItem('carrito_temporal', JSON.stringify(carrito));
    } else {
      localStorage.removeItem('carrito_temporal');
    }
  }, [carrito]);

  // Detectar usuario logueado y autocompletar nombre/email
  useEffect(() => {
    async function getUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user) {
        console.log('Usuario logueado:', session.user.email, 'ID:', session.user.id);
        
        // Ver todos los perfiles para debug
        const { data: todosPerfiles } = await supabase
          .from('perfiles')
          .select('*');
        console.log('Todos los perfiles:', todosPerfiles);
        
        // Buscar nombre y nit_ci en perfiles
        let nombre = "";
        let nitci = "";
        const { data: perfil, error } = await supabase
          .from('perfiles')
          .select('nombre, nit_ci')
          .eq('id', session.user.id)
          .single();
        
        // Si no encuentra por ID, intentar buscar por email
        if (!perfil || error) {
          console.log('No encontrado por ID, buscando por email...');
          const { data: perfilPorEmail, error: errorEmail } = await supabase
            .from('perfiles')
            .select('nombre, nit_ci')
            .ilike('nombre', `%${session.user.email.split('@')[0]}%`)
            .limit(1)
            .single();
          
          console.log('Búsqueda por email:', { perfilPorEmail, errorEmail });
          
          if (perfilPorEmail) {
            if (perfilPorEmail.nombre) nombre = perfilPorEmail.nombre;
            if (perfilPorEmail.nit_ci) nitci = perfilPorEmail.nit_ci;
          }
        } else {
          if (perfil.nombre) nombre = perfil.nombre;
          if (perfil.nit_ci) nitci = perfil.nit_ci;
        }
        
        console.log('Consulta perfiles:', { perfil, error });
        
        if (perfil) {
          if (perfil.nombre) nombre = perfil.nombre;
          if (perfil.nit_ci) nitci = perfil.nit_ci;
        }
        setUsuario({ id: session.user.id, email: session.user.email, nombre });
        if (nombre) setClienteNombre(nombre);
        if (nitci) setClienteNIT(nitci);
        setClienteEmail(session.user.email); // Auto-llenar email del usuario
        
        console.log('Datos establecidos:', { nombre, nitci, email: session.user.email });
      }
    }
    getUser();
  }, []);

  async function efectivizarVenta(carritoPendiente) {
    setEfectivizando(true);
    
    // 1. Calcular total considerando packs
    const total = Array.isArray(carritoPendiente.productos)
      ? carritoPendiente.productos.reduce((acc, p) => {
          // Si es un pack, usar el precio del pack
          if (p.tipo === 'pack') {
            return acc + Number(p.precio_unitario) * p.cantidad;
          }
          // Si es producto normal, usar precio unitario
          return acc + Number(p.precio_unitario) * p.cantidad;
        }, 0)
      : 0;
      
    const { data: venta, error: ventaError } = await supabase.from("ventas").insert([
      {
        cliente_nombre: carritoPendiente.cliente_nombre,
        cliente_telefono: carritoPendiente.cliente_telefono,
        total,
        usuario_id: usuario ? usuario.id : null,
        usuario_email: usuario ? usuario.email : null,
      },
    ]).select().single();
    
    if (ventaError || !venta) {
      alert("Error al crear venta: " + (ventaError?.message || ""));
      setEfectivizando(false);
      return;
    }
    
    // 2. Insertar detalles y manejar stock
    for (const p of carritoPendiente.productos) {
      if (p.tipo === 'pack') {
        // Para packs, insertar como detalle especial
        await supabase.from("ventas_detalle").insert([
          {
            venta_id: venta.id,
            producto_id: null, // Los packs no tienen producto_id específico
            cantidad: p.cantidad,
            precio_unitario: p.precio_unitario,
            descripcion: `📦 Pack: ${p.nombre}`, // Descripción especial para packs
            tipo: 'pack',
            pack_id: p.pack_id
          },
        ]);
        
        // Para packs, descontar stock de cada producto incluido
        if (p.pack_data && p.pack_data.pack_productos) {
          for (const item of p.pack_data.pack_productos) {
            const cantidadTotal = item.cantidad * p.cantidad;
            await supabase.rpc('descontar_stock', { 
              pid: item.productos.user_id, 
              cantidad_desc: cantidadTotal 
            });
          }
        }
      } else {
        // Producto normal
        await supabase.from("ventas_detalle").insert([
          {
            venta_id: venta.id,
            producto_id: p.producto_id,
            cantidad: p.cantidad,
            precio_unitario: p.precio_unitario,
          },
        ]);
        
        // Descontar stock normal
        await supabase.rpc('descontar_stock', { pid: p.producto_id, cantidad_desc: p.cantidad });
      }
    }
    
    // 3. Eliminar carrito pendiente
    await eliminarCarritoPendiente(carritoPendiente.id);
    setEfectivizando(false);
    alert("Venta efectivizada y stock actualizado");
    fetchCarritosPendientes();
  }

  useEffect(() => {
    fetchProductos();
    fetchCarritosPendientes();
    // Si viene de pedidos, poblar carrito y datos
    const pedidoStr = typeof window !== 'undefined' ? sessionStorage.getItem('pedido_a_efectivizar') : null;
    if (pedidoStr) {
      try {
        const pedido = JSON.parse(pedidoStr);
        if (pedido && Array.isArray(pedido.productos)) {
          // Mapear productos a formato del carrito local
          setCarrito(pedido.productos.map(p => ({
            user_id: p.producto_id,
            cantidad: p.cantidad,
            precio: p.precio_unitario,
            nombre: p.nombre || '', // nombre se puede poblar luego si hace falta
          })));
        }
        if (pedido.cliente_nombre) setClienteNombre(pedido.cliente_nombre);
        if (pedido.cliente_telefono) setClienteTelefono(pedido.cliente_telefono);
        if (pedido.usuario_email) setClienteEmail(pedido.usuario_email);
      } catch (e) { /* ignorar */ }
      sessionStorage.removeItem('pedido_a_efectivizar');
    }
  }, []);

  async function fetchCarritosPendientes() {
    const { data, error } = await supabase
      .from("carritos_pendientes")
      .select("id, cliente_nombre, cliente_telefono, productos, fecha")
      .order("fecha", { ascending: false });
    if (!error && data) setCarritosPendientes(data);
  }
  // Eliminar carrito pendiente tras efectivizar o cancelar (opcional)
  async function eliminarCarritoPendiente(id) {
    await supabase.from("carritos_pendientes").delete().eq("id", id);
    fetchCarritosPendientes();
  }

  async function fetchProductos() {
    const { data, error } = await supabase
      .from("productos")
      .select("user_id, nombre, precio, stock, codigo_barra, categorias (categori)");
    if (!error && data) {
      setProductos(data);
      // Obtener imágenes de todos los productos
      const ids = data.map(p => p.user_id);
      if (ids.length > 0) {
        const { data: imgs, error: imgsError } = await supabase
          .from('producto_imagenes')
          .select('producto_id, imagen_url')
          .in('producto_id', ids);
        if (!imgsError && imgs) {
          setImagenesProductos(agruparImagenes(imgs));
        }
      }
    }
  }

  // Agregar producto al carrito por código de barras
  function handleScanBarra(e) {
    e.preventDefault();
    if (!codigoBarra.trim()) return;
    const prod = productos.find(p => p.codigo_barra === codigoBarra.trim());
    if (prod) {
      agregarAlCarrito(prod);
      setCodigoBarra("");
    } else {
      alert("Producto no encontrado");
    }
  }

  // Agregar producto al carrito manualmente
  function agregarAlCarrito(prod) {
    // Calcular precio con promoción
    const precioConPromocion = calcularPrecioConPromocion(prod, promociones);
    const precioFinal = precioConPromocion.precioFinal;
    
    setCarrito(prev => {
      const existe = prev.find(p => p.user_id === prod.user_id);
      if (existe) {
        return prev.map(p =>
          p.user_id === prod.user_id ? { ...p, cantidad: p.cantidad + 1 } : p
        );
      } else {
        return [...prev, { ...prod, cantidad: 1, precio: precioFinal }];
      }
    });
  }

  // Agregar pack completo al carrito
  function agregarPackAlCarrito(pack) {
    const { precioIndividual, descuentoAbsoluto } = calcularDescuentoPack(pack);
    
    // Crear un item especial para el pack
    const itemPack = {
      user_id: `pack-${pack.id}`, // Usar formato consistente con las funciones
      nombre: `📦 ${pack.nombre}`,
      precio: pack.precio_pack,
      stock: 999, // Los packs no tienen stock limitado
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
        return prev.map(p =>
          p.user_id === itemPack.user_id ? { ...p, cantidad: p.cantidad + 1 } : p
        );
      } else {
        return [...prev, itemPack];
      }
    });
  }

  function quitarDelCarrito(user_id) {
    setCarrito(prev => prev.filter(item => item.user_id !== user_id));
  }

  function cambiarCantidad(user_id, cant) {
    setCarrito(prev =>
      prev.map(item =>
        item.user_id === user_id ? { ...item, cantidad: Math.max(1, cant) } : item
      )
    );
  }


  async function pedirPorWhatsapp() {
    if (carrito.length === 0) return alert("El carrito está vacío");
    if (!clienteTelefono.trim()) return alert("Completa el teléfono del cliente");
    let nombreFinal = clienteNombre;
    if (usuario && usuario.nombre) nombreFinal = usuario.nombre;
    if (!nombreFinal || !nombreFinal.trim()) nombreFinal = "Cliente";
    setEnviando(true);
    // Guardar carrito en carritos_pendientes
    const productosParaGuardar = carrito.map(p => {
      if (p.tipo === 'pack') {
        // Para packs, guardar información completa
        return {
          producto_id: p.user_id, // Usará el ID especial pack_xxx
          cantidad: p.cantidad,
          precio_unitario: p.precio,
          tipo: 'pack',
          pack_id: p.pack_id,
          pack_data: p.pack_data,
          nombre: p.nombre
        };
      } else {
        // Para productos normales
        return {
          producto_id: p.user_id,
          cantidad: p.cantidad,
          precio_unitario: p.precio,
          tipo: 'producto',
          nombre: p.nombre
        };
      }
    });

    const { error } = await supabase.from("carritos_pendientes").insert([
      {
        cliente_nombre: nombreFinal,
        cliente_telefono: clienteTelefono,
        productos: productosParaGuardar,
        usuario_id: usuario ? usuario.id : null,
        usuario_email: usuario ? usuario.email : null,
      },
    ]);
    setEnviando(false);
    if (error) {
      alert("Error al enviar el pedido: " + error.message);
      return;
    }
    // Limpiar carrito y datos
    setCarrito([]);
    setClienteNombre("");
    setClienteTelefono("");
    
    // Redirigir a WhatsApp (opcional)
    const itemsTexto = carrito.map(p => {
      if (p.tipo === 'pack') {
        const productosIncluidos = p.pack_data.pack_productos.map(item => 
          `${item.cantidad}x ${item.productos.nombre}`
        ).join(', ');
        return `- 📦 ${p.nombre} x${p.cantidad} (Bs ${Number(p.precio).toFixed(2)})\n  Incluye: ${productosIncluidos}`;
      } else {
        return `- ${p.nombre} x${p.cantidad} (Bs ${Number(p.precio).toFixed(2)})`;
      }
    }).join("\n");
    
    const mensaje = encodeURIComponent(
      `Hola, soy ${nombreFinal} y quiero hacer un pedido.\n\n` +
      itemsTexto +
      `\n\nTotal: Bs ${total.toFixed(2)}`
    );
    window.open(`https://wa.me/${clienteTelefono}?text=${mensaje}`, "_blank");
  }

  // Filtrar productos por búsqueda manual
  const productosFiltrados = productos.filter(
    p =>
      p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.categorias?.categori || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  // Simulación de promociones: si el producto tiene descuento aplica
  function getDescuento(prod) {
    // Aquí puedes consultar una tabla de promociones real
    // Ejemplo: descuento del 10% si el nombre contiene 'promo'
    if (prod.nombre && prod.nombre.toLowerCase().includes('promo')) return 0.1;
    return 0;
  }
  
  // Calcular totales con precios promocionales y packs
  const subtotal = carrito.reduce((acc, item) => {
    if (item.tipo === 'pack') {
      const pack = packs.find(p => p.id === item.pack_id);
      return acc + (pack ? pack.precio_pack * item.cantidad : 0);
    } else {
      const precioInfo = calcularPrecioConPromocion(item, promociones);
      return acc + precioInfo.precioFinal * item.cantidad;
    }
  }, 0);
  
  const totalDescuento = carrito.reduce((acc, item) => {
    if (item.tipo === 'pack') {
      const pack = packs.find(p => p.id === item.pack_id);
      return acc + (pack ? (pack.precio_individual - pack.precio_pack) * item.cantidad : 0);
    } else {
      return acc + (Number(item.precio) * getDescuento(item) * item.cantidad);
    }
  }, 0);
  
  const total = subtotal;
  const [pago, setPago] = useState(0);
  const cambio = pago > 0 ? pago - total : 0;

  // Fecha para impresión (evita error de hidratación SSR)
  const [fechaImpresion, setFechaImpresion] = useState('');
  useEffect(() => {
    setFechaImpresion(new Date().toLocaleString());
  }, []);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start py-8 px-2 bg-gray-100">
      <h1 className="text-3xl font-extrabold mb-8 text-gray-900 w-full text-center">Nueva Venta</h1>
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-6 bg-white rounded-xl shadow-xl p-0 mb-8 border border-gray-900">
        {/* Resumen y lista de productos lado a lado */}
        <div className="col-span-1 lg:col-span-1 bg-gray-50 border-b lg:border-b-0 lg:border-r border-gray-200 p-6 sticky top-0 z-20 print:hidden flex flex-col h-full">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="font-bold text-gray-900 text-lg">Resumen de la venta</span>
              <span className="text-gray-900">Subtotal: <span className="font-bold">Bs {subtotal.toFixed(2)}</span></span>
              {totalDescuento > 0 && <span className="text-green-700">Descuentos: -Bs {totalDescuento.toFixed(2)}</span>}
              <span className="text-2xl font-extrabold text-gray-900">Total: Bs {total.toFixed(2)}</span>
            </div>
            {modoPago === 'efectivo' && (
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-gray-900 font-bold">Pago recibido:</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="border border-gray-900 bg-white text-gray-900 rounded px-3 py-2 placeholder-gray-700 focus:border-gray-900 focus:ring focus:ring-gray-900/30"
                  placeholder="Monto recibido"
                  value={pago}
                  onChange={e => setPago(Number(e.target.value))}
                />
                <span className="text-gray-900 font-bold">Cambio: <span className={cambio < 0 ? 'text-red-700' : 'text-green-700'}>Bs {cambio.toFixed(2)}</span></span>
              </div>
            )}
            {modoPago && (
              <button
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 rounded-lg text-lg print:hidden mt-2"
                onClick={() => window.print()}
              >
                {requiereFactura ? 'Imprimir factura' : 'Imprimir comprobante'}
              </button>
            )}
          </div>
        </div>
        {/* Print layout, only visible when printing */}
        <div className="hidden print:block col-span-3 p-8 bg-white">
          <div className="flex flex-col items-center mb-4">
            <span className="text-gray-700 mb-1">{fechaImpresion}</span>
            <img src="/globe.svg" alt="Logo" className="h-16 mb-2" />
            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">{requiereFactura ? 'Factura' : 'Comprobante de Venta'}</h2>
          </div>
          <div className="mb-2">
            <span className="font-bold">Cliente:</span> {clienteNombre || '-'}<br />
            <span className="font-bold">Teléfono:</span> {clienteTelefono || '-'}<br />
            {clienteEmail && (<><span className="font-bold">Email:</span> {clienteEmail}<br /></>)}
            {clienteNIT && (<><span className="font-bold">NIT/CI:</span> {clienteNIT}<br /></>)}
            <span className="font-bold">Pago:</span> {modoPago || '-'}
          </div>
          <table className="w-full text-sm border-t border-b border-gray-400 my-4">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-1 text-left">Producto</th>
                <th className="p-1 text-center">Cant.</th>
                <th className="p-1 text-right">Precio</th>
                <th className="p-1 text-right">Desc.</th>
                <th className="p-1 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {carrito.map(prod => {
                const precioInfo = calcularPrecioConPromocion(prod, promociones);
                const descuento = getDescuento(prod);
                const precioFinal = Number(prod.precio) * (1 - descuento);
                return (
                  <tr key={prod.user_id}>
                    <td className="p-1 text-left">{prod.nombre}</td>
                    <td className="p-1 text-center">{prod.cantidad}</td>
                    <td className="p-1 text-right">
                      <PrecioConPromocion 
                        producto={prod} 
                        promociones={promociones}
                        compact={true}
                        className="text-right"
                      />
                    </td>
                    <td className="p-1 text-right">
                      {precioInfo.tienePromocion ? (
                        <div className="text-right">
                          <div className="text-red-600 font-bold">-Bs {precioInfo.descuento.toFixed(2)}</div>
                          <div className="text-red-600 text-xs">-{precioInfo.porcentajeDescuento}%</div>
                        </div>
                      ) : (
                        descuento > 0 ? `-${(descuento * 100).toFixed(0)}%` : '-'
                      )}
                    </td>
                    <td className="p-1 text-right">
                      Bs {(calcularPrecioConPromocion(prod, promociones).precioFinal * prod.cantidad).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="text-right text-lg font-bold">
            Subtotal: Bs {subtotal.toFixed(2)}<br />
            {totalDescuento > 0 && <span className="text-green-700">Descuentos: -Bs {totalDescuento.toFixed(2)}<br /></span>}
            Total: Bs {total.toFixed(2)}<br />
            Pago recibido: Bs {pago.toFixed(2)}<br />
            Cambio: Bs {cambio.toFixed(2)}
          </div>
          <div className="mt-6 text-center text-xs text-gray-500">
            ¡Gracias por su compra!
          </div>
        </div>
        {/* Main content: datos cliente, modo pago, carrito y productos */}
        <div className="col-span-2 p-6">
          <h2 className="text-xl font-bold mb-2 text-gray-900">Datos del Cliente</h2>
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
            <input
              className="border border-gray-900 bg-white text-gray-900 rounded px-3 py-2 placeholder-gray-700 focus:border-gray-900 focus:ring focus:ring-gray-900/30"
              placeholder="Nombre del cliente"
              value={clienteNombre}
              onChange={e => setClienteNombre(e.target.value)}
            />
            <input
              className="border border-gray-900 bg-white text-gray-900 rounded px-3 py-2 placeholder-gray-700 focus:border-gray-900 focus:ring focus:ring-gray-900/30"
              placeholder="Teléfono"
              value={clienteTelefono}
              onChange={e => setClienteTelefono(e.target.value)}
              type="tel"
            />
            <input
              className="border border-gray-900 bg-white text-gray-900 rounded px-3 py-2 placeholder-gray-700 focus:border-gray-900 focus:ring focus:ring-gray-900/30"
              placeholder="Email"
              value={clienteEmail}
              onChange={e => setClienteEmail(e.target.value)}
              type="email"
            />
            <input
              className="border border-gray-900 bg-white text-gray-900 rounded px-3 py-2 placeholder-gray-700 focus:border-gray-900 focus:ring focus:ring-gray-900/30"
              placeholder="NIT/CI"
              value={clienteNIT}
              onChange={e => setClienteNIT(e.target.value)}
            />
            <label className="flex items-center gap-2 col-span-1 sm:col-span-2">
              <input type="checkbox" checked={requiereFactura} onChange={e => setRequiereFactura(e.target.checked)} />
              ¿Requiere factura?
            </label>
          </div>
          <div className="mb-4 flex flex-col sm:flex-row gap-2 items-center">
            <label className="font-bold text-gray-900">Modo de pago:</label>
            <select
              className="border border-gray-900 bg-white text-gray-900 rounded px-3 py-2 focus:border-gray-900 focus:ring focus:ring-gray-900/30"
              value={modoPago}
              onChange={e => setModoPago(e.target.value)}
            >
              <option value="">Selecciona...</option>
              <option value="efectivo">Efectivo</option>
              <option value="qr">QR</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>
          {/* Carrito y tabla de productos seleccionados */}
          {carrito.length === 0 ? (
            <div className="text-gray-900">No hay productos en el carrito.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm md:text-base bg-white rounded-xl shadow-xl border border-gray-900 text-center">
                <thead>
                  <tr className="bg-gray-200 text-gray-900">
                    <th className="p-2">Imagen</th>
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Cantidad</th>
                    <th className="p-2">Precio</th>
                    <th className="p-2">Descuento</th>
                    <th className="p-2">Subtotal</th>
                    <th className="p-2">Quitar</th>
                  </tr>
                </thead>
                <tbody>
                  {carrito.map(item => {
                    // Si es un pack
                    if (item.tipo === 'pack') {
                      const pack = packs.find(p => p.id === item.pack_id);
                      if (!pack) return null;
                      
                      return (
                        <tr key={`pack-${item.pack_id}`} className="bg-purple-50">
                          <td className="p-2 text-center align-middle">
                            <div className="h-14 w-14 bg-purple-100 rounded-lg border mx-auto shadow-sm flex items-center justify-center">
                              <span className="text-purple-600 font-bold text-xs">PACK</span>
                            </div>
                          </td>
                          <td className="p-2 text-left font-bold text-gray-900">
                            <div className="text-purple-600">{pack.nombre}</div>
                            <div className="text-xs text-gray-600">{pack.descripcion}</div>
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={1}
                              value={item.cantidad}
                              onChange={e => cambiarCantidad(item.user_id, Number(e.target.value))}
                              className="w-16 border border-gray-900 rounded px-2 py-1 text-gray-900"
                            />
                          </td>
                          <td className="p-2">
                            <div className="text-gray-900 font-bold">
                              <span className="line-through text-gray-500">Bs {pack.precio_individual?.toFixed(2)}</span>
                              <div className="text-purple-600">Bs {pack.precio_pack?.toFixed(2)}</div>
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="text-center">
                              <div className="text-purple-600 font-bold">-Bs {(pack.precio_individual - pack.precio_pack).toFixed(2)}</div>
                              <div className="text-purple-600 text-sm">PACK</div>
                            </div>
                          </td>
                          <td className="p-2 text-gray-900 font-bold">
                            Bs {(pack.precio_pack * item.cantidad).toFixed(2)}
                          </td>
                          <td className="p-2">
                            <button onClick={() => quitarDelCarrito(item.user_id)} className="bg-red-700 hover:bg-red-800 text-white px-3 py-1 rounded font-bold">Quitar</button>
                          </td>
                        </tr>
                      );
                    }
                    
                    // Si es un producto normal
                    const descuento = getDescuento(item);
                    const precioFinal = Number(item.precio) * (1 - descuento);
                    return (
                      <tr key={item.user_id}>
                        <td className="p-2 text-center align-middle">
                          {imagenesProductos[item.user_id]?.[0] ? (
                            <img src={imagenesProductos[item.user_id][0]} alt="img" className="h-14 w-14 object-cover rounded-lg border mx-auto shadow-sm" style={{maxWidth:'56px',maxHeight:'56px'}} />
                          ) : (
                            <span className="text-gray-400">Sin imagen</span>
                          )}
                        </td>
                        <td className="p-2 text-left font-bold text-gray-900">{item.nombre}</td>
                        <td className="p-2">
                          <input
                            type="number"
                            min={1}
                            value={item.cantidad}
                            onChange={e => cambiarCantidad(item.user_id, Number(e.target.value))}
                            className="w-16 border border-gray-900 rounded px-2 py-1 text-gray-900"
                          />
                        </td>
                        <td className="p-2">
                          <PrecioConPromocion 
                            producto={item} 
                            promociones={promociones}
                            compact={true}
                            className="text-gray-900 font-bold"
                          />
                        </td>
                        <td className="p-2">
                          {calcularPrecioConPromocion(item, promociones).tienePromocion ? (
                            <div className="text-center">
                              <div className="text-red-600 font-bold">-Bs {calcularPrecioConPromocion(item, promociones).descuento.toFixed(2)}</div>
                              <div className="text-red-600 text-sm">-{calcularPrecioConPromocion(item, promociones).porcentajeDescuento}%</div>
                            </div>
                          ) : (
                            <span className="text-green-700 font-bold">{descuento > 0 ? `-${(descuento * 100).toFixed(0)}%` : '-'}</span>
                          )}
                        </td>
                        <td className="p-2 text-gray-900 font-bold">
                          Bs {(calcularPrecioConPromocion(item, promociones).precioFinal * item.cantidad).toFixed(2)}
                        </td>
                        <td className="p-2">
                          <button onClick={() => quitarDelCarrito(item.user_id)} className="bg-red-700 hover:bg-red-800 text-white px-3 py-1 rounded font-bold">Quitar</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="text-right mt-4 text-xl font-bold text-gray-900">
                Subtotal: Bs {subtotal.toFixed(2)}<br />
                {totalDescuento > 0 && <span className="text-green-700">Descuentos: -Bs {totalDescuento.toFixed(2)}</span>}<br />
                <span className="text-2xl">Total: Bs {total.toFixed(2)}</span>
              </div>
              <button
                onClick={async () => {
                  if (carrito.length === 0) return alert("El carrito está vacío");
                  if (!clienteNombre.trim() || !clienteTelefono.trim() || !modoPago) return alert("Completa todos los datos obligatorios");
                  if (pago < total) return alert("El pago recibido es insuficiente");
                  setEfectivizando(true);
                  // Registrar venta
                  const { data: venta, error: ventaError } = await supabase.from("ventas").insert([
                    {
                      cliente_nombre: clienteNombre,
                      cliente_telefono: clienteTelefono,
                      cliente_email: clienteEmail,
                      cliente_nit: clienteNIT,
                      requiere_factura: requiereFactura,
                      modo_pago: modoPago,
                      total,
                      pago,
                      cambio,
                    },
                  ]).select().single();
                  if (ventaError || !venta) {
                    alert("Error al crear venta: " + (ventaError?.message || ""));
                    setEfectivizando(false);
                    return;
                  }
                  // Insertar detalles y descontar stock
                  for (const p of carrito) {
                    const descuento = getDescuento(p);
                    const precioFinal = Number(p.precio) * (1 - descuento);
                    await supabase.from("ventas_detalle").insert([
                      {
                        venta_id: venta.id,
                        producto_id: p.user_id,
                        cantidad: p.cantidad,
                        precio_unitario: precioFinal,
                      },
                    ]);
                    await supabase.rpc('descontar_stock', { pid: p.user_id, cantidad_desc: p.cantidad });
                  }
                  setCarrito([]);
                  setPago(0);
                  setEfectivizando(false);
                  alert("Venta efectivizada y stock actualizado");
                }}
                className="mt-4 w-full bg-green-700 hover:bg-green-800 text-white font-bold py-3 rounded-lg text-lg disabled:opacity-60"
                disabled={efectivizando}
              >
                {efectivizando ? "Procesando..." : "Efectivizar venta"}
              </button>
            </div>
          )}
          {/* Catálogo de productos abajo */}
          <form onSubmit={handleScanBarra} className="flex flex-col sm:flex-row gap-2 mb-4 mt-8">
            <input
              ref={inputBarraRef}
              className="flex-1 border border-gray-900 bg-white text-gray-900 rounded px-3 py-2 placeholder-gray-700 focus:border-gray-900 focus:ring focus:ring-gray-900/30"
              placeholder="Escanea o ingresa código de barra"
              value={codigoBarra}
              onChange={e => setCodigoBarra(e.target.value)}
              autoFocus
            />
            <button type="submit" className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded font-bold shadow">Agregar</button>
          </form>
          <div className="mb-4 flex flex-col sm:flex-row gap-2 items-center">
            <input
              className="flex-1 border border-gray-900 bg-white text-gray-900 rounded px-3 py-2 placeholder-gray-700 focus:border-gray-900 focus:ring focus:ring-gray-900/30"
              placeholder="Buscar producto por nombre o categoría"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </div>

          {/* Sección de Packs Especiales */}
          {!loadingPacks && packs.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-purple-800 mb-3">
                📦 Packs Especiales Disponibles
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                {packs.map((pack) => {
                  const { precioIndividual, descuentoAbsoluto, descuentoPorcentaje } = calcularDescuentoPack(pack);
                  
                  return (
                    <div key={pack.id} className="bg-purple-50 border-2 border-purple-200 rounded-lg p-3 hover:bg-purple-100 transition-colors">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-purple-800 text-sm">{pack.nombre}</h4>
                        <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                          -{descuentoPorcentaje.toFixed(0)}% OFF
                        </span>
                      </div>
                      
                      <div className="text-xs text-purple-700 mb-2">
                        Incluye: {pack.pack_productos.map(item => 
                          `${item.cantidad}x ${item.productos.nombre}`
                        ).join(', ')}
                      </div>
                      
                      <div className="flex justify-between items-center mb-2 text-xs">
                        <span className="text-gray-600">Individual:</span>
                        <span className="line-through text-gray-500">Bs {precioIndividual.toFixed(2)}</span>
                      </div>
                      
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-bold text-purple-800">Pack:</span>
                        <span className="text-lg font-bold text-green-600">Bs {pack.precio_pack}</span>
                      </div>
                      
                      <button
                        onClick={() => agregarPackAlCarrito(pack)}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded font-bold text-sm"
                      >
                        🛒 Agregar Pack
                      </button>
                    </div>
                  );
                })}
              </div>
              
              <div className="flex items-center justify-center mb-4">
                <div className="flex-grow border-t border-gray-300"></div>
                <span className="px-3 text-gray-500 text-sm">O productos individuales</span>
                <div className="flex-grow border-t border-gray-300"></div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm md:text-base bg-white rounded-xl shadow-xl border border-gray-900 text-center">
              <thead>
                <tr className="bg-gray-200 text-gray-900">
                  <th className="p-2">Imagen</th>
                  <th className="p-2">Nombre</th>
                  <th className="p-2">Categoría</th>
                  <th className="p-2">Precio</th>
                  <th className="p-2">Stock</th>
                  <th className="p-2">Agregar</th>
                </tr>
              </thead>
              <tbody>
                {productosFiltrados.map(prod => (
                  <tr key={prod.user_id}>
                    <td className="p-2 text-center align-middle">
                      {imagenesProductos[prod.user_id]?.[0] ? (
                        <img src={imagenesProductos[prod.user_id][0]} alt="img" className="h-14 w-14 object-cover rounded-lg border mx-auto shadow-sm" style={{maxWidth:'56px',maxHeight:'56px'}} />
                      ) : (
                        <span className="text-gray-400">Sin imagen</span>
                      )}
                    </td>
                    <td className="p-2 text-left font-bold text-gray-900">{prod.nombre}</td>
                    <td className="p-2 text-gray-900">{prod.categorias?.categori || 'Sin Categoría'}</td>
                    <td className="p-2">
                      <PrecioConPromocion 
                        producto={prod} 
                        promociones={promociones}
                        compact={true}
                        className="text-gray-900 font-bold"
                      />
                    </td>
                    <td className="p-2 text-gray-900">{prod.stock}</td>
                    <td className="p-2">
                      <button onClick={() => agregarAlCarrito(prod)} className="bg-green-700 hover:bg-green-800 text-white px-3 py-1 rounded font-bold">Agregar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}