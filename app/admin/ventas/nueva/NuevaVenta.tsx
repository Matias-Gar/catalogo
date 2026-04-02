"use client";
import React, { useEffect, useRef, useCallback } from 'react';
import { useCarrito } from '../../../../hooks/useCarrito';
import { useCliente } from '../../../../hooks/useCliente';
import { useProductos } from '../../../../hooks/useProductos';
import { usePromociones } from '../../../../lib/usePromociones';
import { usePacks } from '../../../../lib/packs';
import { calcularPrecioConPromocion } from '../../../../lib/promociones';
import * as ventasService from '../../../../services/ventas.service';
import ClienteForm from '../../../../components/venta/ClienteForm';
import BuscadorProductos from '../../../../components/venta/BuscadorProductos';
import CarritoPanel from '../../../../components/venta/CarritoPanel';
import TicketPrinter, { TicketPrinterHandle } from '../../../../components/venta/TicketPrinter';

export default function NuevaVenta() {
  // hooks
  const { cliente, cambiarCampo, buscarPorCarnet, guardar, buscarEmailHistorico } = useCliente();
  const { promociones } = usePromociones();
  const { packs } = usePacks();
  const {
    carrito,
    agregar,
    agregarPack,
    quitar,
    cambiarCantidad,
    subtotal,
    totalDescuento,
    total,
    loadingPacks,
    setCarrito
  } = useCarrito(promociones);

  const {
    productos,
    imagenes,
    searchResults,
    loading,
    searchLoading,
    fetchProductos,
    searchProductos
  } = useProductos(false); // no incluir precio de compra para vendedores

  const [busqueda, setBusqueda] = React.useState('');
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const lastAutoAddRef = React.useRef({ code: '', timestamp: 0 });

  const scanBuffer = React.useRef('');
  const scanTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scanFeedback, setScanFeedback] = React.useState(false);
  const beepRef = useRef<HTMLAudioElement | null>(null);

  const [efectivizando, setEfectivizando] = React.useState(false);

  const [modoPago, setModoPago] = React.useState('');
  const [pago, setPago] = React.useState(0);
  const cambio = pago > 0 ? pago - total : 0;
  // campos contables adicionales
  const [envio, setEnvio] = React.useState(0);
  const [comision, setComision] = React.useState(0);
  const [impuestos, setImpuestos] = React.useState(0);
  const [publicidad, setPublicidad] = React.useState(0);
  const [rebajas, setRebajas] = React.useState(0);

  const printerRef = useRef<TicketPrinterHandle>(null);
  const efectivizarBtnRef = useRef<HTMLButtonElement>(null);

  // shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'b') { e.preventDefault(); document.querySelector<HTMLInputElement>('input[placeholder="Escanea o ingresa código de barra"]')?.focus(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); document.querySelector<HTMLInputElement>('input[placeholder*="Buscar producto"]')?.focus(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'k') { e.preventDefault(); document.querySelector<HTMLInputElement>('input[placeholder*="Carnet"]')?.focus(); }
      if (e.ctrlKey && e.key.toLowerCase() === 'e') { e.preventDefault(); document.querySelector<HTMLButtonElement>('button[aria-label="efectivizar-venta"]')?.click(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // fetch iniciales
  useEffect(() => {
    fetchProductos();
  }, [fetchProductos]);

  // sonido beep
  useEffect(() => {
    beepRef.current = new Audio('/beep.mp3');
  }, []);

  // pago auto
  useEffect(() => {
    if (modoPago && modoPago !== 'efectivo') setPago(total);
    if (!modoPago) setPago(0);
  }, [modoPago, total]);

  const procesarCodigo = useCallback((codigo: string) => {
    const producto = productos.find(p => {
      const cod = String(p.codigo_barra ?? p.codigo ?? p.user_id ?? '').replace(/\D/g, '');
      const code12 = codigo.length === 13 ? codigo.slice(0, -1) : codigo;
      return cod === codigo || cod === code12;
    });

    if (!producto) {
      console.log("No encontrado:", codigo);
      return;
    }

    agregar(producto);

    // 🔊 sonido
    beepRef.current?.play().catch(() => {});

    // 📳 vibración (si soporta)
    if (navigator.vibrate) navigator.vibrate(80);

    // 💡 animación visual
    setScanFeedback(true);
    setTimeout(() => setScanFeedback(false), 200);
  }, [productos, agregar]);

  // detector de scanner real (teclado rápido + ENTER)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const active = document.activeElement as HTMLElement | null;
      const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);
      const isBarcodeInput = isInput && active instanceof HTMLInputElement && active.placeholder?.includes('Escanea o ingresa código de barra');

      // ignorar teclas especiales
      if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') return;

      // ENTER = terminar escaneo (solo si no estamos en un campo normal o estamos en campo de barcode)
      if (key === 'Enter') {
        if (isInput && !isBarcodeInput) return; // no ligar con enter de formulario normal

        const codigo = scanBuffer.current;

        if (codigo.length >= 12) {
          procesarCodigo(codigo);
        }

        scanBuffer.current = '';
        setBusqueda('');
        setShowSuggestions(false);

        if (scanTimer.current) {
          clearTimeout(scanTimer.current);
          scanTimer.current = null;
        }

        return;
      }

      // solo números
      if (/^[0-9]$/.test(key)) {
        if (isInput && !isBarcodeInput) return; // dejamos escribir cantidades y pagos normales

        e.preventDefault();
        scanBuffer.current += key;

        // reset timer (detectar si no es scanner)
        if (scanTimer.current) clearTimeout(scanTimer.current);

        scanTimer.current = setTimeout(() => {
          scanBuffer.current = '';
          scanTimer.current = null;
        }, 100);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (scanTimer.current) clearTimeout(scanTimer.current);
    };
  }, [procesarCodigo]);


  // acciones de venta
  const efectivizarVenta = useCallback(async () => {
    if (carrito.length === 0) return alert('El carrito está vacío');
    if (!modoPago) return alert('Selecciona un método de pago');
    if (cliente.requiereFactura && (!cliente.nombre.trim() || !cliente.nit.trim())) return alert('Completa los datos de facturación (nombre y NIT)');
    if (modoPago === 'efectivo' && pago < total) return alert('El pago recibido es insuficiente');

    // lógica replicada del componente antiguo con service helpers
    setEfectivizando(true);
    try {
      // armar objeto de costos extra
      const costos_extra = {
        envio: Number(envio) || 0,
        comision: Number(comision) || 0,
        impuestos: Number(impuestos) || 0,
        publicidad: Number(publicidad) || 0,
        rebajas: Number(rebajas) || 0,
        descuento: Number(totalDescuento) || 0
      };

      const { data: venta, error: ventaError } = await ventasService.crearVenta({
        cliente_nombre: cliente.nombre,
        cliente_telefono: cliente.telefono,
        cliente_email: cliente.email,
        cliente_nit: cliente.nit,
        requiere_factura: cliente.requiereFactura,
        modo_pago: modoPago,
        total,
        pago,
        cambio,
        descuentos: totalDescuento,
        costos_extra
      });
      if (ventaError || !venta) throw ventaError || new Error('no venta');

      await Promise.all(carrito.map(async (p) => {
        if (p.tipo === 'pack') {
          const pack = p.pack_data || packs.find((pk:any)=>pk.id===p.pack_id);
          if (pack) {
            await ventasService.insertarVentaDetalle({
              venta_id: venta.id,
              producto_id: null,
              cantidad: p.cantidad,
              precio_unitario: pack.precio_pack,
              descripcion: `📦 Pack: ${pack.nombre}`,
              tipo: 'pack',
              pack_id: pack.id
            });
            await Promise.all(pack.pack_productos.map(async (item:any) => {
              const cantidadTotal = item.cantidad * p.cantidad;
              await ventasService.descontarStock(item.productos.user_id, cantidadTotal);
            }));
          }
        } else {
          const precioInfo = calcularPrecioConPromocion(p, []);
          await ventasService.insertarVentaDetalle({ venta_id: venta.id, producto_id: p.user_id, cantidad: p.cantidad, precio_unitario: precioInfo.precioFinal });
          await ventasService.descontarStock(p.user_id, p.cantidad);
        }
      }));

      // snapshot ticket y imprimir
      const ticket = {
        venta,
        items: carrito.map((it: any) => ({ ...it })),
        fecha: new Date().toLocaleString(),
        cliente_nombre: cliente.nombre,
        cliente_nit: cliente.nit,
        modo_pago: modoPago,
        requiere_factura: cliente.requiereFactura,
        subtotal,
        descuento: totalDescuento,
        total,
        pago,
        cambio
      };
      printerRef.current?.printComprobante();
      // limpieza de carrito y cliente después de impresión
      setCarrito([]);
      setPago(0);
      // reset costos
      setEnvio(0); setComision(0); setImpuestos(0); setPublicidad(0); setRebajas(0);
      cambiarCampo('nombre',''); cambiarCampo('carnet',''); cambiarCampo('telefono',''); cambiarCampo('email',''); cambiarCampo('nit',''); cambiarCampo('guardado',false); cambiarCampo('requiereFactura',false);
      setEfectivizando(false);
      alert('Venta efectivizada y stock actualizado');
    } catch (err) {
      alert('Error al crear venta: ' + (err as any)?.message);
      setEfectivizando(false);
    }
  }, [carrito, cliente, modoPago, pago, cambio, total, subtotal, totalDescuento, packs, setCarrito, cambiarCampo]);

  // ...continued building UI mostly replicates previous layout using components

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start py-8 px-2 bg-gradient-to-br from-gray-100 to-gray-300">
      <h1 className="text-3xl font-extrabold mb-8 text-gray-900 w-full text-center">Nueva Venta</h1>
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-3 gap-6 bg-white rounded-xl shadow-xl p-0 mb-8 border border-gray-900">
        <div className="col-span-1 lg:col-span-1 bg-gray-50 border-b lg:border-b-0 lg:border-r border-gray-200 p-6 sticky top-16 z-0 print:hidden flex flex-col h-full">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="font-bold text-gray-900 text-lg">Resumen de la venta</span>
              <span className="text-gray-900">Subtotal: <span className="font-bold">Bs {subtotal.toFixed(2)}</span></span>
              {totalDescuento > 0 && <span className="text-green-700">Descuentos: -Bs {totalDescuento.toFixed(2)}</span>}
              <span className="text-2xl font-extrabold text-gray-900">Total: Bs {total.toFixed(2)}</span>
            </div>
            {/* costos adicionales configurables por admin */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-700">Envío</label>
                <input type="number" step="0.01" min="0" value={envio} onChange={e=>setEnvio(Number(e.target.value))} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block text-gray-700">Comisión</label>
                <input type="number" step="0.01" min="0" value={comision} onChange={e=>setComision(Number(e.target.value))} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block text-gray-700">Impuestos</label>
                <input type="number" step="0.01" min="0" value={impuestos} onChange={e=>setImpuestos(Number(e.target.value))} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block text-gray-700">Publicidad</label>
                <input type="number" step="0.01" min="0" value={publicidad} onChange={e=>setPublicidad(Number(e.target.value))} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block text-gray-700">Rebajas</label>
                <input type="number" step="0.01" min="0" value={rebajas} onChange={e=>setRebajas(Number(e.target.value))} className="w-full border p-2 rounded" />
              </div>
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
                onClick={() => printerRef.current?.printComprobante()}
              >
                {cliente.requiereFactura ? 'Imprimir factura' : 'Imprimir comprobante'}
              </button>
            )}
          </div>
        </div>
        <div className="col-span-2 p-6">
          <ClienteForm
            cliente={cliente}
            onChange={cambiarCampo}
            onBuscar={buscarPorCarnet}
            onGuardar={guardar}
            onBuscarEmailHistorico={buscarEmailHistorico}
          />

          <div className="mb-4 flex flex-col sm:flex-row gap-2 items-center">
            <label className="font-bold text-gray-900">Modo de pago:</label>
            <div className="flex gap-2 flex-wrap">
              {['efectivo','tarjeta','qr','transferencia'].map(m => (
                <button key={m} type="button" onClick={() => setModoPago(m)} className={`px-3 py-2 rounded-full font-semibold transition ${modoPago === m ? 'bg-green-700 text-white shadow' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
                  {m.charAt(0).toUpperCase()+m.slice(1)}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-3">
              <input
                type="number"
                min={0}
                step={0.01}
                className="w-40 border border-gray-900 bg-white text-gray-900 rounded px-3 py-2 placeholder-gray-700 focus:border-gray-900 focus:ring focus:ring-gray-900/30"
                placeholder="Pago recibido"
                value={pago}
                onChange={e => setPago(Number(e.target.value))}
              />
              <div className="text-sm text-gray-700">Cambio: <span className={cambio < 0 ? 'text-red-700' : 'text-green-700'}>Bs {cambio.toFixed(2)}</span></div>
            </div>
          </div>

          <BuscadorProductos
            busqueda={busqueda}
            onChange={val => { setBusqueda(val); searchProductos(val); }}
            onSubmit={() => searchProductos(busqueda)}
            searchResults={searchResults}
            searchLoading={searchLoading}
            imagenes={imagenes}
            onAdd={agregar}
            showSuggestions={showSuggestions}
            setShowSuggestions={setShowSuggestions}
          />

          <CarritoPanel
            carrito={carrito}
            imagenes={imagenes}
            quitar={quitar}
            cambiarCantidad={cambiarCantidad}
            subtotal={subtotal}
            totalDescuento={totalDescuento}
            total={total}
            modoPago={modoPago}
            pago={pago}
            cambio={cambio}
            packs={packs}
            promociones={promociones}
          />

          <button
            ref={efectivizarBtnRef}
            aria-label="efectivizar-venta"
            onClick={efectivizarVenta}
            className="mt-4 w-full bg-black hover:bg-gray-900 text-white font-bold py-3 rounded-lg text-lg disabled:opacity-60"
            disabled={efectivizando}
          >
            {efectivizando ? "Procesando..." : "Efectivizar venta"}
          </button>
        </div>
      </div>
      {efectivizando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl font-bold text-black">Procesando venta...</div>
        </div>
      )}

      {scanFeedback && (
        <>
          <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
            <div className="bg-green-500/90 text-white px-6 py-3 rounded-xl text-xl font-bold shadow-2xl animate-pulse">
              ✔ Producto agregado
            </div>
          </div>
          <div className="fixed inset-0 bg-green-400/20 z-40 pointer-events-none" />
        </>
      )}

      <TicketPrinter
        ref={printerRef}
        carrito={carrito}
        clienteNombre={cliente.nombre}
        clienteNIT={cliente.nit}
        modoPago={modoPago}
        requiereFactura={cliente.requiereFactura}
        subtotal={subtotal}
        totalDescuento={totalDescuento}
        total={total}
        pago={pago}
        cambio={cambio}
        ultimoTicket={null}
        setUltimoTicket={() => {}}
      />
    </div>
  );
}
