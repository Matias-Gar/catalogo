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
import { CartItem, Pack, PackProduct, Producto } from '../../../../hooks/useCarrito';
import { supabase } from '../../../../lib/SupabaseClient';
import { showToast } from '../../../../components/ui/Toast';

type VariantMatch = {
  variante_id?: number | string;
  id?: number | string;
  color?: string;
  precio?: number;
  stock?: number;
  sku?: string;
  codigo_barra?: string;
};

type VentaCajaPayload = {
  id?: number | string;
  fecha?: string;
  total?: number;
  modo_pago?: string;
};

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
    setCarrito,
    stockWarning,
    clearStockWarning
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
  const [cobrarImpuestos, setCobrarImpuestos] = React.useState(false);
  const tasaImpuestos = 0.16;
  const [showInsufficientPaymentWarning, setShowInsufficientPaymentWarning] = React.useState(false);
  // campos contables adicionales
  const [envio, setEnvio] = React.useState(0);
  const [comision, setComision] = React.useState(0);
  const [publicidad, setPublicidad] = React.useState(0);
  const [rebajas, setRebajas] = React.useState(0);

  const totalBaseOperacion = Math.max(0, Number(total) + Number(envio) + Number(comision) - Number(publicidad) - Number(rebajas));
  const totalConImpuestos = cobrarImpuestos ? (totalBaseOperacion / (1 - tasaImpuestos)) : totalBaseOperacion;
  const impuestosCalculados = cobrarImpuestos ? (totalConImpuestos - totalBaseOperacion) : 0;
  const totalCobrar = Number(totalConImpuestos.toFixed(2));
  const cambio = pago > 0 ? pago - totalCobrar : 0;
  const pagoInsuficiente = modoPago === 'efectivo' && pago > 0 && pago < totalCobrar;

  const printerRef = useRef<TicketPrinterHandle>(null);
  const efectivizarBtnRef = useRef<HTMLButtonElement>(null);

  // shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'b') { e.preventDefault(); document.querySelector<HTMLInputElement>('input[placeholder="Escanea o ingresa cÃ³digo de barra"]')?.focus(); }
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
    if (modoPago && modoPago !== 'efectivo') setPago(totalCobrar);
    if (!modoPago) setPago(0);
  }, [modoPago, totalCobrar]);

  // warning visual si el pago en efectivo es menor al total
  useEffect(() => {
    if (pagoInsuficiente) {
      setShowInsufficientPaymentWarning(true);
    } else {
      setShowInsufficientPaymentWarning(false);
    }
  }, [pagoInsuficiente]);

  useEffect(() => {
    if (!stockWarning) return;
    const timeoutId = setTimeout(() => clearStockWarning(), 2500);
    return () => clearTimeout(timeoutId);
  }, [stockWarning, clearStockWarning]);

  const procesarCodigo = useCallback(async (codigo: string) => {
    const normalizeCode = (value: unknown) => String(value ?? '').replace(/\D/g, '');
    const matchesBarcode = (input: string, stored: unknown) => {
      const a = normalizeCode(input);
      const b = normalizeCode(stored);
      if (!a || !b) return false;
      return a === b || (a.length === 13 && a.slice(0, 12) === b) || (b.length === 13 && b.slice(0, 12) === a);
    };

    const buildScannedProduct = (p: Producto) => {
      const variants = Array.isArray(p.variantes) ? p.variantes : [];
      const matchedVariant = variants.find((variant) => {
        const currentVariant = variant as VariantMatch;
        return matchesBarcode(codigo, currentVariant?.codigo_barra) || matchesBarcode(codigo, currentVariant?.sku);
      }) as VariantMatch | undefined;
      if (!matchedVariant) return null;

      return {
        ...p,
        variante_id: matchedVariant?.variante_id ?? matchedVariant?.id,
        color: matchedVariant?.color || 'Sin color',
        precio: Number(matchedVariant?.precio ?? p.precio ?? 0),
        stock: Number(matchedVariant?.stock ?? 0),
        codigo: String(matchedVariant?.sku || '')
      } as Producto;
    };

    let productoEncontrado: Producto | null = null;
    for (const p of productos) {
      const candidate = buildScannedProduct(p);
      if (candidate) {
        productoEncontrado = candidate;
        break;
      }
    }

    // Fallback: buscar en DB por si el producto se creó recientemente y la página sigue abierta
    if (!productoEncontrado) {
      const resultados = await searchProductos(codigo);
      if (Array.isArray(resultados) && resultados.length > 0) {
        const conVariante = resultados.find((resultado) => resultado.variante_id != null);
        if (conVariante) {
          productoEncontrado = conVariante;
        }
      }
    }

    if (!productoEncontrado) {
      console.log("No encontrado:", codigo);
      return false;
    }

    agregar(productoEncontrado);

    // ðŸ”Š sonido
    beepRef.current?.play().catch(() => {});

    // ðŸ“³ vibraciÃ³n (si soporta)
    if (navigator.vibrate) navigator.vibrate(80);

    // ðŸ’¡ animaciÃ³n visual
    setScanFeedback(true);
    setTimeout(() => setScanFeedback(false), 200);
    return true;
  }, [productos, agregar, searchProductos]);

  const handleBuscadorSubmit = useCallback(async () => {
    const raw = busqueda.trim();
    if (!raw) {
      await searchProductos('');
      setShowSuggestions(true);
      return;
    }

    const codigoNumerico = raw.replace(/\D/g, '');
    if (codigoNumerico.length >= 6) {
      const now = Date.now();
      const last = lastAutoAddRef.current;
      if (!(last.code === codigoNumerico && now - last.timestamp < 700)) {
        const agregado = await procesarCodigo(codigoNumerico);
        if (agregado) {
          lastAutoAddRef.current = { code: codigoNumerico, timestamp: now };
          setBusqueda('');
          setShowSuggestions(false);
          return;
        }
      }
    }

    await searchProductos(raw);
    setShowSuggestions(true);
  }, [busqueda, procesarCodigo, searchProductos]);

  // detector de scanner real (teclado rÃ¡pido + ENTER)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;
      const active = document.activeElement as HTMLElement | null;
      const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);
      const isBarcodeInput = isInput && active instanceof HTMLInputElement && active.placeholder?.includes('Escanea o ingresa cÃ³digo de barra');

      // ignorar teclas especiales
      if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') return;

      // ENTER = terminar escaneo (solo si no estamos en un campo normal o estamos en campo de barcode)
      if (key === 'Enter') {
        if (isInput && !isBarcodeInput) return; // no ligar con enter de formulario normal

        const codigo = scanBuffer.current;

        if (codigo.length >= 6) {
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

      // solo nÃºmeros
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
  const registrarIngresoEnCaja = useCallback(async (venta: VentaCajaPayload) => {
    try {
      const modo = String(venta?.modo_pago || "").toLowerCase();
      const payment_method =
        modo === "efectivo"
          ? "cash"
          : modo === "qr"
            ? "qr"
            : modo === "tarjeta"
              ? "card"
            : modo === "transferencia"
              ? "transfer"
              : "other";

      const amount = Number(venta?.total || 0);
      if (!Number.isFinite(amount) || amount <= 0) return;

      const saleDate = String(venta?.fecha || "").slice(0, 10) || new Date().toISOString().slice(0, 10);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const response = await fetch('/api/cash/movements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: saleDate,
          type: 'income',
          payment_method,
          amount,
          description: `Ingreso automatico por venta #${venta?.id}`,
          cashbox_id: 'main',
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || 'No se pudo registrar el ingreso automatico en caja');
      }
    } catch (cashError) {
      // No bloqueamos la venta por un error de sincronizacion de caja.
      console.error('No se pudo registrar ingreso automatico en caja:', cashError);
      showToast('La venta se guardo, pero no se pudo reflejar en flujo de caja automaticamente.', 'info');
    }
  }, []);

  const efectivizarVenta = useCallback(async () => {
    if (carrito.length === 0) { showToast('El carrito esta vacio', 'error'); return; }
    if (!modoPago) { showToast('Selecciona un metodo de pago', 'error'); return; }
    if (cliente.requiereFactura && (!cliente.nombre.trim() || !cliente.nit.trim())) { showToast('Completa los datos de facturacion (nombre y NIT)', 'error'); return; }
    if (modoPago === 'efectivo' && pago < totalCobrar) { showToast('El pago recibido es insuficiente', 'error'); return; }

    // lÃ³gica replicada del componente antiguo con service helpers
    setEfectivizando(true);
    try {
      const productIds = Array.from(
        new Set(
          carrito
            .filter((item: Producto) => item.tipo !== 'pack' && item.user_id)
            .map((item: Producto) => String(item.user_id))
        )
      );
      const productCostMap = new Map<string, { user_id?: string | number; precio_compra?: number; nombre?: string }>();

      if (productIds.length > 0) {
        const { data: productCostsByUserId, error: productCostsByUserIdError } = await supabase
          .from('productos')
          .select('user_id, nombre, precio_compra')
          .in('user_id', productIds);

        if (productCostsByUserIdError) throw productCostsByUserIdError;

        const foundByUserId = Array.isArray(productCostsByUserId) ? productCostsByUserId : [];
        foundByUserId.forEach((product) => {
          if (product?.user_id != null) productCostMap.set(String(product.user_id), product);
        });
      }

      // armar objeto de costos extra
      const costos_extra = {
        envio: Number(envio) || 0,
        comision: Number(comision) || 0,
        impuestos: Number(impuestosCalculados.toFixed(2)) || 0,
        cobrar_impuestos: cobrarImpuestos,
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
        total: totalCobrar,
        pago,
        cambio,
        descuentos: totalDescuento,
        costos_extra
      });
      if (ventaError || !venta) throw ventaError || new Error('no venta');

      await Promise.all(carrito.map(async (p: Producto) => {
        const cantidad = p.cantidad ?? 1;
        if (p.tipo === 'pack') {
          const pack = p.pack_data || packs.find((pk: Pack) => pk.id === p.pack_id);
          if (pack) {
            const { error: detallePackError } = await ventasService.insertarVentaDetalle({
              venta_id: venta.id,
              producto_id: null,
              cantidad,
              precio_unitario: pack.precio_pack,
              costo_unitario: 0,
              color: null,
              descripcion: `ðŸ“¦ Pack: ${pack.nombre}`,
              tipo: 'pack',
              pack_id: pack.id
            });

            if (detallePackError) throw detallePackError;

            await Promise.all((pack.pack_productos ?? []).map(async (item: PackProduct) => {
              const cantidadTotal = item.cantidad * cantidad;
              const { error: stockPackError } = await ventasService.descontarStock(item.productos.user_id, cantidadTotal);
              if (stockPackError) throw stockPackError;
            }));
          }
        } else {
          const precioInfo = calcularPrecioConPromocion(p, []);
          const productInfo = productCostMap.get(String(p.user_id));
          const costoUnitario = Number(productInfo?.precio_compra || 0);
          const descripcionItem = `${p.nombre}${p.color ? ` ${p.color}` : ''}`.trim();

          const { error: detalleProductoError } = await ventasService.insertarVentaDetalle({
            venta_id: venta.id,
            producto_id: p.user_id,
            cantidad,
            precio_unitario: precioInfo.precioFinal,
            costo_unitario: costoUnitario,
            variante_id: p.variante_id || null,
            color: p.color || null,
            descripcion: descripcionItem,
            tipo: 'producto',
          });

          if (detalleProductoError) throw detalleProductoError;

          const { error: stockProductoError } = await ventasService.descontarStock(p.user_id, cantidad);
          if (stockProductoError) throw stockProductoError;
        }
      }));

      // Sincroniza automáticamente ingresos de ventas con flujo de caja.
      await registrarIngresoEnCaja(venta);

      // snapshot ticket y imprimir
      const ticket = {
        venta,
        items: carrito.map((it: Producto) => ({ ...it })),
        fecha: new Date().toLocaleString(),
        cliente_nombre: cliente.nombre,
        cliente_nit: cliente.nit,
        modo_pago: modoPago,
        requiere_factura: cliente.requiereFactura,
        subtotal,
        descuento: totalDescuento,
        total: totalCobrar,
        envio,
        comision,
        publicidad,
        rebajas,
        impuestos: Number(impuestosCalculados.toFixed(2)),
        cobrar_impuestos: cobrarImpuestos,
        pago,
        cambio
      };
      printerRef.current?.printComprobante();
      // limpieza de carrito y cliente despuÃ©s de impresiÃ³n
      setCarrito([]);
      setPago(0);
      // reset costos
      setEnvio(0); setComision(0); setPublicidad(0); setRebajas(0); setCobrarImpuestos(false);
      cambiarCampo('nombre',''); cambiarCampo('carnet',''); cambiarCampo('telefono',''); cambiarCampo('email',''); cambiarCampo('nit',''); cambiarCampo('guardado',false); cambiarCampo('requiereFactura',false);
      setEfectivizando(false);
      showToast('Venta efectivizada y stock actualizado');
    } catch (err) {
      const errorContext = err && typeof err === 'object'
        ? ['message', 'details', 'hint']
            .map((key) => {
              const value = (err as Record<string, unknown>)[key];
              return typeof value === 'string' && value.trim() ? value : null;
            })
            .filter(Boolean)
            .join(' | ')
        : '';
      const errorMessage = err instanceof Error
        ? err.message
        : errorContext || String(err);
      showToast('Error al crear venta: ' + errorMessage, 'error');
      setEfectivizando(false);
    }
  }, [carrito, cliente, modoPago, pago, cambio, totalCobrar, subtotal, totalDescuento, packs, setCarrito, cambiarCampo, envio, comision, publicidad, rebajas, impuestosCalculados, cobrarImpuestos, registrarIngresoEnCaja]);

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
              <span className="text-gray-900">Base operativa: <span className="font-bold">Bs {totalBaseOperacion.toFixed(2)}</span></span>
              {cobrarImpuestos && <span className="text-amber-700">IVA+IT (16%): +Bs {impuestosCalculados.toFixed(2)}</span>}
              <span className="text-2xl font-extrabold text-gray-900">Total a cobrar: Bs {totalCobrar.toFixed(2)}</span>
            </div>
            {/* costos adicionales configurables por admin */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-gray-700">Envio</label>
                <input type="number" step="0.01" min="0" value={envio} onChange={e=>setEnvio(Number(e.target.value))} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block text-gray-700">Comision</label>
                <input type="number" step="0.01" min="0" value={comision} onChange={e=>setComision(Number(e.target.value))} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block text-gray-700">Impuestos</label>
                <input type="number" step="0.01" min="0" value={Number(impuestosCalculados.toFixed(2))} readOnly className="w-full border p-2 rounded bg-gray-100" />
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
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-800">
              <input
                type="checkbox"
                checked={cobrarImpuestos}
                onChange={(e) => setCobrarImpuestos(e.target.checked)}
                className="w-4 h-4"
              />
              Cobrar IVA + IT (16% sobre precio final)
            </label>
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
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-bold py-2 rounded-lg text-lg print:hidden mt-2"
                onClick={() => printerRef.current?.printComprobante()}
                disabled={pagoInsuficiente}
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
            onSubmit={handleBuscadorSubmit}
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

          {stockWarning && (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="font-bold text-amber-800">Stock insuficiente</p>
              <p className="text-sm text-amber-700">{stockWarning}</p>
            </div>
          )}

          {showInsufficientPaymentWarning && (
            <div className="mt-4 p-4 rounded-lg border border-red-300 bg-red-50">
              <p className="text-red-800 font-bold">El pago recibido es insuficiente</p>
              <p className="text-red-700 text-sm">Faltan: Bs {(totalCobrar - pago).toFixed(2)}</p>
            </div>
          )}

          <button
            ref={efectivizarBtnRef}
            aria-label="efectivizar-venta"
            onClick={efectivizarVenta}
            className="mt-4 w-full bg-black hover:bg-gray-900 text-white font-bold py-3 rounded-lg text-lg disabled:opacity-60"
            disabled={efectivizando || showInsufficientPaymentWarning}
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
              âœ” Producto agregado
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
        total={totalCobrar}
        envio={envio}
        comision={comision}
        publicidad={publicidad}
        rebajas={rebajas}
        impuestos={Number(impuestosCalculados.toFixed(2))}
        cobrarImpuestos={cobrarImpuestos}
        pago={pago}
        cambio={cambio}
        ultimoTicket={undefined}
        setUltimoTicket={() => {}}
      />
    </div>
  );
}


