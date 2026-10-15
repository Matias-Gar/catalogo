"use client";

import { useState } from 'react';

export default function ProductThumbnail({ sources, name, size = 56 }: {
  sources: (string | undefined | null)[]; name: string; size?: number;
}) {
  const urls = [...new Set(sources.map(url => url?.trim()).filter((url): url is string => !!url && url !== '/sin-imagen.png'))];
  // El estado se reinicia cuando cambia la lista de fuentes, incluso al cargar imagenes tarde.
  return <Thumbnail key={urls.join('|')} urls={urls} name={name} size={size} />;
}

function Thumbnail({ urls, name, size }: { urls: string[]; name: string; size: number }) {
  const [index, setIndex] = useState(0);
  return urls[index]
    ? <img src={urls[index]} alt={name} width={size} height={size}
        onError={() => setIndex(i => i + 1)} className="mx-auto rounded-lg border object-contain"
        style={{ width: size, height: size }} />
    : <span className="text-xs text-gray-500">Sin imagen</span>;
}
