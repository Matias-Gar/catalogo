import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/SupabaseClient';

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function parseExtraCosts(costosExtra) {
  if (!costosExtra || typeof costosExtra !== 'object') return 0;
  return Object.entries(costosExtra).reduce((sum, [key, value]) => {
    if (key === 'descuento' || key === 'descuentos') return sum;
    return sum + toNumber(value);
  }, 0);
}

function dateKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  return d.toISOString().slice(0, 10);
}

function isWithinDateRange(dateValue, from, to) {
  if (!from && !to) return true;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const fromDate = from ? new Date(`${from}T00:00:00`) : null;
  const toDate = to ? new Date(`${to}T23:59:59`) : null;

  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  return true;
}

export function useVentasDashboard() {
  const [ventas, setVentas] = useState([]);
  const [detallesPorVenta, setDetallesPorVenta] = useState({});
  const [productMap, setProductMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadDashboardData() {
      setLoading(true);
      setError('');
      try {
        const { data: ventasData, error: ventasError } = await supabase
          .from('ventas')
          .select('id, cliente_nombre, total, fecha, descuentos, costos_extra')
          .order('fecha', { ascending: false });

        if (ventasError) throw ventasError;

        const safeVentas = Array.isArray(ventasData) ? ventasData : [];

        let detallesData = [];
        const detalleEnriquecido = await supabase
          .from('ventas_detalle')
          .select(`
            venta_id,
            cantidad,
            precio_unitario,
            costo_unitario,
            color,
            tipo,
            descripcion,
            producto_id,
            pack_id,
            productos (
              nombre
            ),
            packs (
              nombre
            )
          `);

        if (detalleEnriquecido.error) {
          const detalleFallback = await supabase
            .from('ventas_detalle')
            .select('*');
          if (detalleFallback.error) throw detalleEnriquecido.error;
          detallesData = detalleFallback.data || [];
        } else {
          detallesData = detalleEnriquecido.data || [];
        }

        const safeDetalles = Array.isArray(detallesData) ? detallesData : [];
        const detallesMap = {};
        const productIds = new Set();

        safeDetalles.forEach((item) => {
          const ventaId = item?.venta_id;
          if (!ventaId) return;

          if (!detallesMap[ventaId]) detallesMap[ventaId] = [];
          detallesMap[ventaId].push(item);

          if (item?.producto_id != null) {
            productIds.add(item.producto_id);
          }
        });

        let products = [];
        if (productIds.size > 0) {
          const ids = Array.from(productIds);
          const { data: productsData, error: productsError } = await supabase
            .from('productos')
            .select('id, user_id, nombre, precio_compra')
            .in('user_id', ids);

          if (productsError) {
            const fallback = await supabase
              .from('productos')
              .select('id, user_id, nombre, precio_compra')
              .in('id', ids);
            if (fallback.error) throw productsError;
            products = Array.isArray(fallback.data) ? fallback.data : [];
          } else {
            products = Array.isArray(productsData) ? productsData : [];
          }
        }

        const nextProductMap = {};
        products.forEach((p) => {
          if (p?.user_id != null) nextProductMap[p.user_id] = p;
          if (p?.id != null) nextProductMap[p.id] = p;
        });

        if (!mounted) return;
        setVentas(safeVentas);
        setDetallesPorVenta(detallesMap);
        setProductMap(nextProductMap);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || 'No se pudo cargar el dashboard de ventas');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboardData();
    return () => {
      mounted = false;
    };
  }, []);

  const salesRows = useMemo(() => {
    return ventas
      .filter((venta) => isWithinDateRange(venta?.fecha, dateFrom, dateTo))
      .map((venta) => {
        const details = detallesPorVenta[venta.id] || [];
        const items = [];

        let gananciaItems = 0;
        let costoItems = 0;
        let cantidadProductos = 0;

        details.forEach((item) => {
          const qty = toNumber(item?.cantidad || 0);
          const precioUnitario = toNumber(item?.precio_unitario || 0);
          const ingreso = precioUnitario * qty;

          const productInfo = productMap[item?.producto_id] || null;
          const costoUnitarioDetalle = item?.costo_unitario;
          const costoUnitario = costoUnitarioDetalle != null
            ? toNumber(costoUnitarioDetalle)
            : (item?.pack_id || item?.tipo === 'pack')
              ? 0
              : toNumber(productInfo?.precio_compra || 0);

          const costo = costoUnitario * qty;
          const gananciaItem = ingreso - costo;

          const itemName =
            item?.productos?.nombre ||
            productInfo?.nombre ||
            item?.packs?.nombre ||
            item?.descripcion ||
            (item?.pack_id || item?.tipo === 'pack'
              ? `Pack #${item?.pack_id ?? 'N/A'}`
              : `Producto #${item?.producto_id ?? 'N/A'}`);

          items.push({
            nombre: itemName,
            cantidad: qty,
            precio: precioUnitario,
            costo,
            costoUnitario,
            ingreso,
            ganancia: gananciaItem,
            color: item?.color || '',
            tipo: item?.pack_id || item?.tipo === 'pack' ? 'pack' : 'producto',
            lowProfit: gananciaItem < 0,
          });

          gananciaItems += gananciaItem;
          costoItems += costo;
          cantidadProductos += qty;
        });

        const descuentos = toNumber(venta?.descuentos || 0);
        const costosExtra = parseExtraCosts(venta?.costos_extra);
        const ganancia = gananciaItems - descuentos - costosExtra;
        const costoTotal = costoItems + descuentos + costosExtra;
        const totalVenta = toNumber(venta?.total || items.reduce((sum, item) => sum + item.ingreso, 0));
        const margen = totalVenta > 0 ? (ganancia / totalVenta) * 100 : 0;

        return {
          id: venta.id,
          cliente: venta?.cliente_nombre?.trim() || 'Consumidor final',
          fecha: venta?.fecha,
          total: totalVenta,
          costo: costoTotal,
          ganancia,
          margen,
          descuentos,
          costosExtra,
          cantidadProductos,
          details,
          items,
        };
      })
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }, [ventas, detallesPorVenta, productMap, dateFrom, dateTo]);

  const kpis = useMemo(() => {
    const totalVentas = salesRows.length;
    const totalIngresos = salesRows.reduce((sum, row) => sum + row.total, 0);
    const totalGanancias = salesRows.reduce((sum, row) => sum + row.ganancia, 0);
    const totalDescuentos = salesRows.reduce((sum, row) => sum + row.descuentos, 0);
    const productosVendidos = salesRows.reduce((sum, row) => sum + row.cantidadProductos, 0);
    const ticketPromedio = totalVentas > 0 ? totalIngresos / totalVentas : 0;

    return {
      totalVentas,
      totalIngresos,
      totalGanancias,
      totalDescuentos,
      ticketPromedio,
      productosVendidos,
    };
  }, [salesRows]);

  const salesByDay = useMemo(() => {
    const grouped = {};
    salesRows.forEach((row) => {
      const key = dateKey(row.fecha);
      if (!grouped[key]) {
        grouped[key] = { day: key, ventas: 0, ingresos: 0, ganancia: 0 };
      }
      grouped[key].ventas += 1;
      grouped[key].ingresos += row.total;
      grouped[key].ganancia += row.ganancia;
    });

    return Object.values(grouped).sort((a, b) => a.day.localeCompare(b.day));
  }, [salesRows]);

  const topProducts = useMemo(() => {
    const grouped = {};
    salesRows.forEach((row) => {
      row.items.forEach((item) => {
        const label = item.color ? `${item.nombre} (${item.color})` : item.nombre;
        const key = `${item.tipo}:${label}`;
        if (!grouped[key]) {
          grouped[key] = { name: label, cantidad: 0, total: 0 };
        }

        const qty = toNumber(item?.cantidad || 0);
        grouped[key].cantidad += qty;
        grouped[key].total += toNumber(item?.ingreso || 0);
      });
    });

    return Object.values(grouped)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 8);
  }, [salesRows]);

  return {
    loading,
    error,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    kpis,
    salesRows,
    salesByDay,
    topProducts,
  };
}
