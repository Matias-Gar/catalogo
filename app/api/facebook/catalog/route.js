// 🔗 API para sincronizar productos con Facebook Catalog
import { supabase } from '../../../lib/SupabaseClient';
import { FacebookCatalogAPI } from '../../../lib/FacebookCatalogAPI';

export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { action } = req.body;
    const fbCatalog = new FacebookCatalogAPI();

    switch (action) {
      case 'sync_all':
        // 🔄 Sincronizar todos los productos
        const syncResult = await fbCatalog.syncAllProducts();
        return res.status(200).json({
          success: true,
          message: 'Sincronización completada',
          data: syncResult
        });

      case 'sync_single':
        // 📤 Sincronizar un producto específico
        const { producto_id } = req.body;
        
        const { data: producto } = await supabase
          .from('productos')
          .select('*')
          .eq('user_id', producto_id)
          .single();

        if (!producto) {
          return res.status(404).json({ error: 'Producto no encontrado' });
        }

        const uploadResult = await fbCatalog.uploadProduct(producto);
        return res.status(200).json({
          success: true,
          message: 'Producto sincronizado',
          data: uploadResult
        });

      case 'delete':
        // 🗑️ Eliminar producto del catálogo
        const { retailer_id } = req.body;
        const deleteResult = await fbCatalog.deleteProduct(retailer_id);
        return res.status(200).json({
          success: true,
          message: 'Producto eliminado del catálogo',
          data: deleteResult
        });

      case 'stats':
        // 📊 Obtener estadísticas
        const statsResult = await fbCatalog.getCatalogStats();
        return res.status(200).json({
          success: true,
          data: statsResult
        });

      default:
        return res.status(400).json({ error: 'Acción no válida' });
    }

  } catch (error) {
    console.error('Error en Facebook Catalog API:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      details: error.message
    });
  }
}