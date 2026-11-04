import { useState, useEffect, useId } from 'react';
import { publicSupabase as supabase } from './supabasePublic';
import { runCatalogQuery } from './catalogRequest';

/** @param {string | null} [sucursalId] */
export const usePromociones = (sucursalId = null) => {
  const subscriptionId = useId();
  const [promociones, setPromociones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const obtenerPromociones = async () => {
      try {
        setLoading(true);
        
        let query = supabase
          .from('promociones')
          .select('*')
          .eq('activa', true);
        if (sucursalId) query = query.eq('sucursal_id', sucursalId);
        const { data, error } = await runCatalogQuery(query);
        if (!mounted) return;

        if (error) {
          // console.error('Error al obtener promociones:', error);
          setError(error);
          return;
        }

        setPromociones(data || []);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        // console.error('Error:', err);
        setError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    obtenerPromociones();

    // Suscribirse a cambios en promociones
    const subscription = supabase
      .channel(`promociones-changes:${subscriptionId}:${sucursalId || 'public'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'promociones' },
        (payload) => {
          // console.log('Cambio en promociones:', payload);
          obtenerPromociones(); // Recargar promociones cuando hay cambios
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(subscription);
    };
  }, [sucursalId, subscriptionId]);

  return { promociones, loading, error };
};
