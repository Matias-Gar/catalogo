import { boxProductCode } from './boxProductCodes.mjs';

// Convert browser-supported formats (including WebP) to embedded PNG thumbnails.
async function thumbnail(sources) {
  for (const source of [...new Set(sources.filter(Boolean))]) {
    if (source === '/sin-imagen.png') continue;
    try {
      const img = await new Promise((resolve, reject) => {
        const img = new Image();
        const timeout = setTimeout(() => { img.src = ''; reject(new Error('Tiempo agotado')); }, 15000);
        img.crossOrigin = 'anonymous';
        img.onload = () => { clearTimeout(timeout); resolve(img); };
        img.onerror = () => { clearTimeout(timeout); reject(new Error('Imagen no disponible')); };
        img.src = source;
      });
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const scale = Math.min(128 / img.naturalWidth, 128 / img.naturalHeight);
      const width = img.naturalWidth * scale, height = img.naturalHeight * scale;
      ctx.drawImage(img, (128 - width) / 2, (128 - height) / 2, width, height);
      return canvas.toDataURL('image/png');
    } catch { /* Try the next product photo if this source is unavailable. */ }
  }
  return null;
}

export async function exportBoxInventory({ products, branch, box, search, productType = '', category = '', getLocation, getSources, onProgress }) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bodega y cajas';
  const sheet = workbook.addWorksheet('Bodega y cajas', { views: [{ state: 'frozen', ySplit: 5 }] });
  sheet.columns = [
    { width: 20 }, { width: 48 }, { width: 24 }, { width: 24 }, { width: 18 }, { width: 18 },
  ];
  sheet.addRow(['Códigos y cajas de productos']);
  sheet.addRow(['Sucursal', branch || '', 'Fecha', new Date().toLocaleString('es-BO', { timeZone: 'America/La_Paz' })]);
  sheet.addRow(['Caja', box === '__none' ? 'Sin asignar' : box || 'Todas', 'Búsqueda', search || 'Todas']);
  sheet.addRow(['Productos', products.length, 'Tipo', productType || 'Todos', 'Categoría', category || 'Todas']);
  const header = sheet.addRow(['Foto', 'Producto', 'Código', 'Caja']);
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF047857' } };
  for (const product of products) {
    const row = sheet.addRow(['', product.nombre, boxProductCode(product) || 'Sin codigo registrado', getLocation(product) || 'Sin caja asignada']);
    row.height = 78;
    row.alignment = { vertical: 'middle', wrapText: true };
  }
  let next = 0, completed = 0, missing = 0;
  await Promise.all(Array.from({ length: Math.min(4, products.length) }, async () => {
    while (next < products.length) {
      const index = next++;
      const photo = await thumbnail(getSources(products[index]));
      if (photo) {
        const imageId = workbook.addImage({ base64: photo, extension: 'png' });
        sheet.addImage(imageId, { tl: { col: 0.15, row: index + 5 + 0.05 }, ext: { width: 96, height: 96 }, editAs: 'oneCell' });
      } else {
        sheet.getCell(index + 6, 1).value = 'Sin imagen disponible';
        missing++;
      }
      onProgress?.(++completed, products.length);
    }
  }));
  sheet.autoFilter = { from: 'A5', to: `D${products.length + 5}` };
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `bodega-cajas-${(branch || 'sucursal').replace(/[^\p{L}\p{N}_-]/gu, '-')}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return { missing };
}
