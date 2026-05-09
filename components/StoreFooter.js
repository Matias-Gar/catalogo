"use client";

import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_STORE_SETTINGS, fetchStoreSettings } from '../lib/storeSettings';
import { usePublicSucursal } from './PublicSucursalSelector';

export default function StoreFooter() {
  const [storeSettings, setStoreSettings] = useState(DEFAULT_STORE_SETTINGS);
  const { activePais, activeSucursal } = usePublicSucursal();

  useEffect(() => {
    let mounted = true;

    const loadSettings = async () => {
      const settings = await fetchStoreSettings({
        paisId: activePais?.id,
        paisSlug: activePais?.slug,
        whatsapp: activePais?.whatsapp,
        direccion: activePais?.direccion,
      });
      if (mounted) setStoreSettings(settings);
    };

    loadSettings();

    const handleStorage = (event) => {
      if (event.key === 'store_settings_local') {
        loadSettings();
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      mounted = false;
      window.removeEventListener('storage', handleStorage);
    };
  }, [activePais?.direccion, activePais?.id, activePais?.slug, activePais?.whatsapp]);

  const whatsappLink = useMemo(() => {
    if (!storeSettings?.whatsapp_number) return '';
    return `https://wa.me/${storeSettings.whatsapp_number}`;
  }, [storeSettings?.whatsapp_number]);

  const footerAddress = activeSucursal?.direccion || activePais?.direccion || storeSettings?.store_address || '';
  const footerPhone = activeSucursal?.telefono || activePais?.whatsapp || storeSettings?.whatsapp_number || '';
  const footerWhatsappLink = footerPhone ? `https://wa.me/${String(footerPhone).replace(/[^\d]/g, '')}` : whatsappLink;

  return (
    <footer className="border-t border-slate-200 bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 text-center items-center">
        <div className="text-lg font-black tracking-wide">{storeSettings?.store_name || 'Mi Tienda Online'}</div>
        {storeSettings?.store_info ? (
          <p className="max-w-3xl text-sm leading-6 text-slate-300">{storeSettings.store_info}</p>
        ) : null}
        {footerAddress ? (
          <p className="text-sm font-medium text-slate-200">Ubicacion: {footerAddress}</p>
        ) : null}
        {footerPhone ? (
          <div>
            <a href={footerWhatsappLink} target="_blank" rel="noreferrer" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200 hover:underline">
              WhatsApp: +{footerPhone}
            </a>
          </div>
        ) : null}
      </div>
    </footer>
  );
}
