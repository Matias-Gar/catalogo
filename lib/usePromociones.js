import { useState, useEffect } from 'react';
import { supabase } from './SupabaseClient';

export const usePromociones = () => {
  const [promociones, setPromociones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const obtenerPromociones = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('promociones')
          .select('*')
          .eq('activa', true);

        if (error) {
          console.error('Error al obtener promociones:', error);
          setError(error);
          return;
        }

        setPromociones(data || []);
      } catch (err) {
        console.error('Error:', err);
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    obtenerPromociones();

    // Suscribirse a cambios en promociones
    const subscription = supabase
      .channel('promociones-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'promociones' },
        (payload) => {
          console.log('Cambio en promociones:', payload);
          obtenerPromociones(); // Recargar promociones cuando hay cambios
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { promociones, loading, error };
};