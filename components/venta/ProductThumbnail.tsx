"use client";

import { resolveStorageImageUrl } from '../../lib/storageImageUrl.mjs';
import CatalogImage from '../CatalogImage';

export default function ProductThumbnail({ sources, name, size = 56 }: {
  sources: (string | undefined | null)[]; name: string; size?: number;
}) {
  const urls = [...new Set(sources.map(url => resolveStorageImageUrl(url)).filter((url): url is string => !!url && url !== '/sin-imagen.png'))];
  // El estado se reinicia cuando cambia la lista de fuentes, incluso al cargar imagenes tarde.
  return <Thumbnail key={urls.join('|')} urls={urls} name={name} size={size} />;
}

function Thumbnail({ urls, name, size }: { urls: string[]; name: string; size: number }) {
  return urls.length
    ? <CatalogImage sources={urls} alt={name} sizes={`${size}px`}
        className="mx-auto rounded-lg border object-contain"
        style={{ width: size, height: size }} />
    : <span className="text-xs text-gray-500">Sin imagen</span>;
}
