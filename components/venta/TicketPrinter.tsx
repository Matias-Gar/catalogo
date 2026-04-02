"use client";
import React, { useImperativeHandle, forwardRef, useRef } from 'react';
import jsPDF from 'jspdf';
import { CONFIG } from '../../lib/config';

declare global {
  interface Window {
    qz?: any;
  }
}

interface TicketPrinterProps {
  carrito: any[];
  clienteNombre: string;
  clienteNIT: string;
  modoPago: string;
  requiereFactura: boolean;
  subtotal: number;
  totalDescuento: number;
  total: number;
  pago: number;
  cambio: number;
  ultimoTicket: any;
  setUltimoTicket: (t: any) => void;
}

export interface TicketPrinterHandle {
  printComprobante: () => Promise<void>;
}

const TicketPrinter = forwardRef<TicketPrinterHandle, TicketPrinterProps>((props, ref) => {
  const ticketRef = useRef<HTMLDivElement>(null);

  // replicamos funciones desde Página original
  async function printTicketAsPDF(ticketSnapshot: any) {
    console.log('printTicketAsPDF init', { ticketSnapshot });

    if (!ticketSnapshot || typeof ticketSnapshot !== 'object') {
      console.warn('printTicketAsPDF: ticketSnapshot inválido');
      return false;
    }

    const items = Array.isArray(ticketSnapshot.items) ? ticketSnapshot.items : [];

    if (items.length === 0) console.warn('printTicketAsPDF: no hay items', items);

    try {
      const PAPER_WIDTH = 72; // cambia a 58 / 80 si quieres
      const MARGIN = 2;
      const CONTENT_WIDTH = PAPER_WIDTH - MARGIN * 2;

      const doc = new jsPDF({ unit: 'mm', format: [PAPER_WIDTH, 340] });
      let y = 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('COMPROBANTE TIENDA STREETWEAR', PAPER_WIDTH / 2, y, { align: 'center' });
      y += 5;
      doc.setFontSize(7);
      doc.text('StreetWear', PAPER_WIDTH / 2, y, { align: 'center' });
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.text('Dirección:', 5, y); y += 3;
      doc.text('Av. Capitan Victor Ustariz entre Av. Melchor Perez de Olguin y C.G. Gamarra', 5, y, { maxWidth: CONTENT_WIDTH }); y += 4;
      doc.text('Contacto WhatsApp: +59177434023', 5, y); y += 4;
      doc.line(5, y, PAPER_WIDTH - 5, y); y += 4;

      doc.text(`Fecha: ${ticketSnapshot.fecha || new Date().toLocaleString()}`, MARGIN, y); y += 3;
      doc.text(`Cliente: ${ticketSnapshot.cliente_nombre || '-'}`, MARGIN, y); y += 3;
      doc.text(`Pago: ${ticketSnapshot.modo_pago || '-'}`, MARGIN, y); y += 3;
      doc.line(MARGIN, y, PAPER_WIDTH - MARGIN, y); y += 3;

      doc.setFont('courier', 'bold');
      doc.setFontSize(7);
      doc.text('Cant', MARGIN, y);
      doc.text('Detalle', MARGIN + 10, y);
      doc.text('Bs', PAPER_WIDTH - MARGIN, y, { align: 'right' });
      y += 3;
      doc.setLineWidth(0.1);
      doc.line(MARGIN, y, PAPER_WIDTH - MARGIN, y);
      y += 3;

      doc.setFont('courier', 'normal');
      for (const item of items) {
        const nombre = item.nombre || item.producto_nombre || 'Producto';
        const qty = item.cantidad || item.cant || 1;
        const precio = Number(item.precio_unitario || item.precio || 0).toFixed(2);
        const lines = doc.splitTextToSize(nombre, CONTENT_WIDTH - 20);

        doc.text(String(qty), MARGIN, y);
        doc.text(lines, MARGIN + 10, y);
        doc.text(`Bs ${precio}`, PAPER_WIDTH - MARGIN, y, { align: 'right' });
        y += lines.length * 3;
      }

      if (items.length === 0) {
        doc.text('Sin items para imprimir', MARGIN, y); y += 4;
      }

      y += 2;
      doc.line(MARGIN, y, PAPER_WIDTH - MARGIN, y);
      y += 3;

      const total = Number(ticketSnapshot.total || 0);
      const subtotal = Number(ticketSnapshot.subtotal || total);
      const descuento = Number(ticketSnapshot.descuento || 0);
      const pago = Number(ticketSnapshot.pago || 0);
      const cambio = Number(ticketSnapshot.cambio || 0);

      doc.setFont('courier', 'bold');
      doc.text('SUBTOTAL', MARGIN, y); doc.text(`Bs ${subtotal.toFixed(2)}`, PAPER_WIDTH - MARGIN, y, { align: 'right' }); y += 3;
      if (descuento > 0) { doc.text('DESC', MARGIN, y); doc.text(`-Bs ${descuento.toFixed(2)}`, PAPER_WIDTH - MARGIN, y, { align: 'right' }); y += 3; }
      doc.text('TOTAL', MARGIN, y); doc.text(`Bs ${total.toFixed(2)}`, PAPER_WIDTH - MARGIN, y, { align: 'right' }); y += 3;
      doc.text('PAGO', MARGIN, y); doc.text(`Bs ${pago.toFixed(2)}`, PAPER_WIDTH - MARGIN, y, { align: 'right' }); y += 3;
      doc.text('CAMBIO', MARGIN, y); doc.text(`Bs ${cambio.toFixed(2)}`, PAPER_WIDTH - MARGIN, y, { align: 'right' }); y += 4;

      try {
        // QR de contacto Whatsapp y comprobante digital
        // @ts-ignore
        const qr = await import('qrcode');
        const qrCanvasWA = document.createElement('canvas');
        const qrCanvasDigital = document.createElement('canvas');
        const whatsappUrl = 'https://wa.me/59177434023?text=Hola%20StreetWear%2C%20quiero%20informaci%C3%B3n';
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://streetwear.example');
        const digitalUrl = `${appUrl.replace(/\/+$/, '')}/admin/ventas/comprobante/${ticketSnapshot?.venta?.id || '0000'}`;

        await qr.toCanvas(qrCanvasWA, whatsappUrl, { width: 100 });
        await qr.toCanvas(qrCanvasDigital, digitalUrl, { width: 100 });

        const qrImgWA = qrCanvasWA.toDataURL('image/png');
        const qrImgDigital = qrCanvasDigital.toDataURL('image/png');

        const qrSize = 18;
        const gap = 4;
        const startX = (PAPER_WIDTH - qrSize * 2 - gap) / 2;

        doc.addImage(qrImgWA, 'PNG', startX, y, qrSize, qrSize);
        doc.addImage(qrImgDigital, 'PNG', startX + qrSize + gap, y, qrSize, qrSize);
        y += qrSize + 3;

        doc.setFontSize(6);
        doc.text('WhatsApp', startX + qrSize / 2, y, { align: 'center' });
        doc.text('Comprobante digital', startX + qrSize + gap + qrSize / 2, y, { align: 'center' });
        y += 4;
      } catch (err) {
        console.warn('qrcode no disponible, omitiendo QR', err);
      }

      doc.setFontSize(6);
      doc.text('¡Gracias por su compra!', PAPER_WIDTH / 2, y, { align: 'center' });
      y += 5;

      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);

      let iframe = document.getElementById('ticket-print-iframe') as HTMLIFrameElement | null;
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.id = 'ticket-print-iframe';
        iframe.style.position = 'fixed';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.zIndex = '9999';
        iframe.style.border = 'none';
        document.body.appendChild(iframe);
      }

      iframe.src = url;

      iframe.onload = () => {
        try {
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
        } catch (err) {
          console.warn('Error al imprimir desde iframe interno', err);
        } finally {
          URL.revokeObjectURL(url);
        }
      };

      return true;

      return true;
    } catch (err) {
      console.error('printTicketAsPDF error', err);
      return false;
    }
  }

  async function printComprobanteThermal(ticketSnapshot: any) {
    if (!window.qz || !window.qz.api) {
      console.warn('qz-tray no está disponible; se usará impresión estándar');
      return false;
    }
    try {
      const lines: string[] = [];
      lines.push('\x1b@'); // init escpos
      lines.push('\x1b!\x00');
      const append = (text: string) => { lines.push(text + '\n'); };
      append(String(CONFIG.BUSINESS_NAME || 'Tienda'));
      if (CONFIG.BUSINESS_ADDRESS) append(CONFIG.BUSINESS_ADDRESS);
      if (CONFIG.BUSINESS_PHONE) append(`Tel: ${CONFIG.BUSINESS_PHONE}`);
      if (CONFIG.BUSINESS_NIT) append(`NIT: ${CONFIG.BUSINESS_NIT}`);
      append('');
      append(`Fecha: ${ticketSnapshot?.fecha || new Date().toLocaleString()}`);
      append(`Cliente: ${ticketSnapshot?.cliente_nombre || '-'}`);
      if (ticketSnapshot?.cliente_nit) append(`NIT/CI: ${ticketSnapshot.cliente_nit}`);
      append(`Método: ${ticketSnapshot?.modo_pago || '-'}`);
      append('--------------------------------');
      for (const item of ticketSnapshot?.items || []) {
        append(`${item.cantidad || item.cant || 1}x ${item.nombre || item.producto_nombre || 'Producto'}  Bs ${Number(item.precio_unitario || item.precio || item.precio_pack || 0).toFixed(2)}`);
      }
      append('--------------------------------');
      append(`SUBTOTAL: Bs ${Number(ticketSnapshot?.subtotal || ticketSnapshot?.total || 0).toFixed(2)}`);
      if (ticketSnapshot?.descuento) append(`Descuento: Bs ${Number(ticketSnapshot.descuento).toFixed(2)}`);
      append(`TOTAL: Bs ${Number(ticketSnapshot?.total || 0).toFixed(2)}`);
      if (ticketSnapshot?.pago !== undefined) append(`Pago: Bs ${Number(ticketSnapshot.pago || 0).toFixed(2)}`);
      append(`Cambio: Bs ${Number(ticketSnapshot?.cambio || 0).toFixed(2)}`);
      append('');
      append('¡Gracias por su compra!');
      lines.push('\x1dV\x00'); // corte
      const config = window.qz.configs.create('POS-80C');
      await window.qz.print(config, lines);
      return true;
    } catch (err) {
      console.warn('printComprobanteThermal error', err);
      return false;
    }
  }

  async function printComprobante() {
    if (!props.modoPago) return alert('Selecciona un método de pago antes de imprimir');
    if ((!props.carrito || props.carrito.length === 0) && !props.ultimoTicket) return alert('No hay productos para imprimir');
    const ticket = (props.ultimoTicket && (!props.carrito || props.carrito.length === 0))
      ? props.ultimoTicket
      : {
          fecha: new Date().toLocaleString(),
          cliente_nombre: props.clienteNombre,
          cliente_nit: props.clienteNIT,
          modo_pago: props.modoPago,
          requiere_factura: props.requiereFactura,
          items: (props.carrito || []).map(it => ({ ...it, precio_unitario: it.precio || it.precio_unitario || 0 })),
          subtotal: props.subtotal,
          descuento: props.totalDescuento,
          total: props.total,
          pago: props.pago,
          cambio: props.cambio
        };
    props.setUltimoTicket(ticket);
    try {
      const thermalOk = await printComprobanteThermal(ticket);
      if (thermalOk) return;

      const pdfOk = await printTicketAsPDF(ticket);
      if (pdfOk) return;
      // fallback similar as before ... but for brevity reuse earlier code from parent (could duplicate or call external)

      const printContainer = ticketRef.current;
      if (printContainer) {
        const html = printContainer.innerHTML;
        const printWindow = window.open('', '_blank', 'width=300,height=800');
        if (printWindow) {
          const initialStyles = `
            <style>
              @page { size: 80mm auto; margin: 0; }
              html, body { margin: 0; padding: 0; }
              body { width: 80mm; margin: 0; padding: 0; }
              .ticket-wrapper { width: 80mm; margin: 0; padding: 0; }
            </style>
          `;
          printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8">${initialStyles}</head><body><div class="ticket-wrapper">${html}</div></body></html>`);
          printWindow.document.close();
          setTimeout(() => { try { printWindow.print(); printWindow.close(); } catch (e) { console.warn('fallback print call failed', e); } }, 400);
        }
      }
    } catch (err) {
      console.warn('printComprobante error', err);
      alert('Error al intentar imprimir el comprobante');
    }
  }

  useImperativeHandle(ref, () => ({ printComprobante }));

  return <div id="ticket-print" ref={ticketRef} className="hidden print:block" />;
});

export default TicketPrinter;
