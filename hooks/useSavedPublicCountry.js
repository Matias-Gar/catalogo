"use client";

import { useSyncExternalStore } from 'react';
import { getSavedPublicCountrySlug } from '../lib/countryRoutes';

function subscribe(notify) {
  window.addEventListener('storage', notify);
  window.addEventListener('public-sucursal:changed', notify);
  return () => {
    window.removeEventListener('storage', notify);
    window.removeEventListener('public-sucursal:changed', notify);
  };
}

export function useSavedPublicCountry() {
  return useSyncExternalStore(subscribe, getSavedPublicCountrySlug, () => '');
}
