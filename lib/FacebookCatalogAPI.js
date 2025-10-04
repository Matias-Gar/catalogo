// 🔗 INTEGRACIÓN FACEBOOK CATALOG API
// Conecta tu sistema con el catálogo de Facebook Business
import { supabase } from '@/lib/SupabaseClient';

export class FacebookCatalogAPI {
  constructor() {
    this.accessToken = process.env.FACEBOOK_ACCESS_TOKEN;
    this.catalogId = process.env.FACEBOOK_CATALOG_ID;
    this.baseURL = 'https://graph.facebook.com/v18.0';
    this.appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  // 📤 Subir producto a Facebook Catalog (optimizado con tu esquema)
  async uploadProduct(producto) {
    // Obtener promociones activas del producto
    const { data: promociones } = await supabase
      .from('promociones')
      .select('*')
      .eq('producto_id', producto.user_id)
      .eq('activa', true)
      .lte('fecha_inicio', new Date().toISOString())
      .or('fecha_fin.is.null,fecha_fin.gte.' + new Date().toISOString());

    // Calcular precio con promoción si existe
    let salePrice = null;
    
    if (promociones && promociones.length > 0) {
      const promocion = promociones[0]; // Tomar la primera promoción activa
      if (promocion.tipo === 'descuento_porcentaje') {
        salePrice = producto.precio * (1 - promocion.valor / 100);
      } else if (promocion.tipo === 'descuento_monto') {
        salePrice = producto.precio - promocion.valor;
      } else if (promocion.tipo === 'precio_fijo') {
        salePrice = promocion.valor;
      }
    }

    // Obtener imágenes adicionales
    const { data: imagenes } = await supabase
      .from('producto_imagenes')
      .select('imagen_url')
      .eq('producto_id', producto.user_id);

    const productData = {
      retailer_id: producto.user_id.toString(),
      name: producto.nombre,
      description: producto.descripcion || `${producto.nombre} - Stock disponible: ${producto.stock}`,
      price: `${Math.round(producto.precio * 100)} BOB`, // Precio en centavos
      currency: 'BOB',
      availability: producto.stock > 0 ? 'in stock' : 'out of stock',
      condition: 'new',
      brand: 'Catálogo Online',
      category: producto.categoria || 'General',
      inventory: producto.stock,
      image_url: producto.imagen_url || '',
      url: `${this.appUrl}/productos?id=${producto.user_id}`,
      additional_image_urls: imagenes ? imagenes.map(img => img.imagen_url).slice(0, 9) : [], // Max 10 imágenes
      ...(salePrice && {
        sale_price: `${Math.round(salePrice * 100)} BOB`,
        sale_price_effective_date: promociones[0].fecha_inicio + '/' + (promociones[0].fecha_fin || '2025-12-31')
      })
    };

    try {
      const response = await fetch(
        `${this.baseURL}/${this.catalogId}/products`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`
          },
          body: JSON.stringify(productData)
        }
      );

      const result = await response.json();
      return { success: response.ok, data: result };
    } catch (error) {
      console.error('Error subiendo producto a Facebook:', error);
      return { success: false, error: error.message };
    }
  }

  // 🔄 Sincronizar todos los productos activos (con categorías)
  async syncAllProducts() {
    try {
      // Obtener productos activos con información de categoría
      const { data: productos } = await supabase
        .from('productos')
        .select(`
          *,
          categorias:category_id (
            id,
            categori
          )
        `)
        .gt('stock', 0); // Solo productos con stock

      if (!productos || productos.length === 0) {
        return {
          success: true,
          message: 'No hay productos con stock para sincronizar',
          total_productos: 0,
          results: []
        };
      }

      const results = [];
      let exitosos = 0;
      let fallidos = 0;
      
      for (const producto of productos) {
        // Enriquecer con nombre de categoría
        if (producto.categorias) {
          producto.categoria = producto.categorias.categori;
        }

        const result = await this.uploadProduct(producto);
        results.push({
          producto_id: producto.user_id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          stock: producto.stock,
          precio: producto.precio,
          result
        });

        if (result.success) {
          exitosos++;
        } else {
          fallidos++;
        }
        
        // Pausa para evitar rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      return {
        success: true,
        total_productos: productos.length,
        exitosos,
        fallidos,
        results
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 📦 Sincronizar packs como productos especiales
  async syncActivePacks() {
    try {
      const { data: packs } = await supabase
        .from('packs')
        .select(`
          *,
          pack_productos (
            cantidad,
            productos:producto_id (
              nombre,
              imagen_url
            )
          )
        `)
        .eq('activo', true)
        .or('fecha_fin.is.null,fecha_fin.gte.' + new Date().toISOString());

      const results = [];
      
      for (const pack of packs) {
        // Crear descripción del pack
        const productosEnPack = pack.pack_productos.map(pp => 
          `${pp.cantidad}x ${pp.productos.nombre}`
        ).join(', ');

        const packData = {
          retailer_id: `pack_${pack.id}`,
          name: pack.nombre,
          description: `${pack.descripcion || ''}\n\nIncluye: ${productosEnPack}`,
          price: `${Math.round(pack.precio_pack * 100)} BOB`,
          currency: 'BOB',
          availability: 'in stock',
          condition: 'new',
          brand: 'Packs Especiales',
          category: 'Packs y Ofertas',
          image_url: pack.imagen_url || pack.pack_productos[0]?.productos?.imagen_url || '',
          url: `${this.appUrl}/productos?pack=${pack.id}`
        };

        try {
          const response = await fetch(
            `${this.baseURL}/${this.catalogId}/products`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.accessToken}`
              },
              body: JSON.stringify(packData)
            }
          );

          const result = await response.json();
          results.push({
            pack_id: pack.id,
            nombre: pack.nombre,
            precio: pack.precio_pack,
            result: { success: response.ok, data: result }
          });
        } catch (error) {
          results.push({
            pack_id: pack.id,
            nombre: pack.nombre,
            result: { success: false, error: error.message }
          });
        }

        await new Promise(resolve => setTimeout(resolve, 200));
      }

      return {
        success: true,
        total_packs: packs.length,
        results
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 🗑️ Eliminar producto del catálogo
  async deleteProduct(retailerId) {
    try {
      const response = await fetch(
        `${this.baseURL}/${this.catalogId}/products/${retailerId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      return { success: response.ok };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 📊 Obtener estadísticas del catálogo
  async getCatalogStats() {
    try {
      const response = await fetch(
        `${this.baseURL}/${this.catalogId}?fields=product_count,name`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      const data = await response.json();
      
      // Estadísticas locales
      const { data: productos } = await supabase
        .from('productos')
        .select('user_id, stock')
        .gt('stock', 0);

      const { data: packs } = await supabase
        .from('packs')
        .select('id')
        .eq('activo', true);

      return { 
        success: true, 
        data: {
          ...data,
          productos_locales: productos?.length || 0,
          packs_activos: packs?.length || 0
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

// 🚀 Función para usar en tu API
export async function syncProductsToFacebook() {
  const fbCatalog = new FacebookCatalogAPI();
  return await fbCatalog.syncAllProducts();
}