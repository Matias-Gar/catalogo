import { useState, useEffect, useCallback } from 'react';
import { supabase } from './SupabaseClient';

export function useUserProfile() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const getProfile = useCallback(async (id) => {
    if (!id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      setProfile(data || null);
    } catch (err) {
      console.error('useUserProfile - getProfile error:', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getProfile(userId);
  }, [userId, getProfile]);

  useEffect(() => {
    getProfile();

    // Escuchar cambios en la autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          await loadUserProfile(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setProfile(data);
    } catch (error) {
      setError(error.message);
    }
  }

  async function updateProfile(updates) {
    try {
      if (!user) throw new Error('No hay usuario autenticado');

      const { error } = await supabase
        .from('perfiles')
        .upsert({
          id: user.id,
          rol: 'cliente', // Asegurar que siempre sea cliente
          ...updates
        });

      if (error) throw error;

      await loadUserProfile(user.id);
      return { success: true };
    } catch (error) {
      setError(error.message);
      return { success: false, error: error.message };
    }
  }

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      setProfile(null);
      return { success: true };
    } catch (error) {
      setError(error.message);
      return { success: false, error: error.message };
    }
  }

  return {
    user,
    profile,
    loading,
    error,
    updateProfile,
    signOut,
    refreshProfile: getProfile
  };
}