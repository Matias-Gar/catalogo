export const PRODUCT_VIEW_OPTIONS = [
  { value: 'articulos', label: 'Articulos' },
  { value: 'insumos', label: 'Insumos' },
];

export const DEFAULT_PRODUCT_VIEW = 'articulos';

export function normalizeProductView(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized) ? normalized : DEFAULT_PRODUCT_VIEW;
}

export function slugifyProductView(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getProductViewPublicPath(value, products = false) {
  const view = normalizeProductView(value);
  if (view === 'articulos') return products ? '/tipo/articulos/productos' : '/tipo/articulos';
  if (view === 'insumos') return products ? '/insumos/productos' : '/insumos';
  return `/tipo/${view}${products ? '/productos' : ''}`;
}

export function getProductViewMeta(value) {
  const view = normalizeProductView(value);
  if (view === 'insumos') {
    return {
      value: view,
      singular: 'insumo',
      plural: 'insumos',
      title: 'Insumos',
      adminTitle: 'Panel de Administracion de Insumos',
      createTitle: 'Anadir Nuevo Insumo',
      editTitle: 'Editar Insumos',
    };
  }

  if (view !== DEFAULT_PRODUCT_VIEW) {
    const title = view.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
    return { value: view, singular: title, plural: title, title, adminTitle: `Panel de ${title}`, createTitle: `Anadir ${title}`, editTitle: `Editar ${title}` };
  }

  return {
    value: DEFAULT_PRODUCT_VIEW,
    singular: 'articulo',
    plural: 'articulos',
    title: 'Articulos',
    adminTitle: 'Panel de Administracion de Articulos',
    createTitle: 'Anadir Nuevo Articulo',
    editTitle: 'Editar Articulos',
  };
}
