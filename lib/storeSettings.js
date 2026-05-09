import { supabase } from './SupabaseClient';
import { CONFIG } from './config';

const SETTINGS_KEY = 'global_store_settings';
const LOCAL_STORAGE_KEY = 'store_settings_local';

export const DEFAULT_STORE_SETTINGS = {
  store_name: CONFIG.BUSINESS_NAME || 'Mi Tienda Online',
  whatsapp_number: CONFIG.WHATSAPP_BUSINESS || '',
  store_info: '',
  store_address: CONFIG.BUSINESS_ADDRESS || CONFIG.DIRECCION_COMERCIAL || '',
  store_logo_url: '',
};

function cleanWhatsappNumber(input) {
  return String(input || '').replace(/[^\d]/g, '');
}

function mergeWithDefaults(value) {
  const merged = {
    ...DEFAULT_STORE_SETTINGS,
    ...(value || {}),
  };

  merged.whatsapp_number = cleanWhatsappNumber(merged.whatsapp_number);
  merged.store_name = String(merged.store_name || DEFAULT_STORE_SETTINGS.store_name).trim();
  merged.store_info = String(merged.store_info || '').trim();
  merged.store_address = String(merged.store_address || DEFAULT_STORE_SETTINGS.store_address).trim();
  merged.store_logo_url = String(merged.store_logo_url || '').trim();

  return merged;
}

function getLocalKey(scope = {}) {
  const countryKey = scope.paisId || scope.paisSlug || 'global';
  return `${LOCAL_STORAGE_KEY}_${countryKey}`;
}

function getLocalSettings(scope = {}) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(getLocalKey(scope)) || localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return mergeWithDefaults(JSON.parse(raw));
  } catch {
    return null;
  }
}

function setLocalSettings(settings, scope = {}) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getLocalKey(scope), JSON.stringify(mergeWithDefaults(settings)));
  } catch {
    // noop
  }
}

async function fetchPaisBySlug(slug) {
  if (!slug) return null;
  const { data } = await supabase
    .from('paises')
    .select('id, nombre, slug, whatsapp, direccion')
    .eq('slug', slug)
    .maybeSingle();
  return data || null;
}

export async function fetchStoreSettings(scope = {}) {
  try {
    if (scope.paisId || scope.paisSlug) {
      const params = new URLSearchParams();
      if (scope.paisId) params.set('pais_id', scope.paisId);
      if (scope.paisSlug) params.set('pais', scope.paisSlug);
      const response = await fetch(`/api/public/store-settings?${params.toString()}`);
      const payload = await response.json().catch(() => null);
      if (response.ok && payload?.success && payload?.settings) {
        const settings = mergeWithDefaults(payload.settings);
        setLocalSettings(settings, { paisId: payload.pais?.id || scope.paisId, paisSlug: payload.pais?.slug || scope.paisSlug });
        return settings;
      }
    }

    const pais = scope.paisId
      ? { id: scope.paisId, whatsapp: scope.whatsapp, direccion: scope.direccion }
      : await fetchPaisBySlug(scope.paisSlug);

    if (pais?.id) {
      const { data, error } = await supabase
        .from('pais_settings')
        .select('settings')
        .eq('pais_id', pais.id)
        .maybeSingle();

      if (!error) {
        const settings = mergeWithDefaults({
          ...(data?.settings || {}),
          whatsapp_number: pais.whatsapp || data?.settings?.whatsapp_number,
          store_address: pais.direccion || data?.settings?.store_address,
        });
        setLocalSettings(settings, { paisId: pais.id, paisSlug: scope.paisSlug });
        return settings;
      }
    }

    const { data, error } = await supabase
      .from('app_settings')
      .select('settings')
      .eq('key', SETTINGS_KEY)
      .maybeSingle();

    if (!error && data?.settings) {
      const settings = mergeWithDefaults(data.settings);
      setLocalSettings(settings, scope);
      return settings;
    }
  } catch {
    // noop
  }

  const local = getLocalSettings(scope);
  return local || mergeWithDefaults(null);
}

export async function saveStoreSettings(input, scope = {}) {
  const settings = mergeWithDefaults(input);
  let persistedToSupabase = false;

  try {
    if (scope.paisId) {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const response = await fetch('/api/admin/pais-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          pais_id: scope.paisId,
          settings,
        }),
      });
      const payload = await response.json().catch(() => null);
      persistedToSupabase = response.ok && payload?.success;
      const savedSettings = persistedToSupabase && payload?.settings ? mergeWithDefaults(payload.settings) : settings;
      setLocalSettings(savedSettings, scope);
      return { settings: savedSettings, persistedToSupabase, error: payload?.error || null };
    }

    const { error } = await supabase
      .from('app_settings')
      .upsert(
        {
          key: SETTINGS_KEY,
          settings,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' }
      );

    persistedToSupabase = !error;
  } catch {
    persistedToSupabase = false;
  }

  setLocalSettings(settings, scope);

  return {
    settings,
    persistedToSupabase,
  };
}
