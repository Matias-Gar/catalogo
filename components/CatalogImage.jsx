"use client";

import Image from "next/image";
import { useState } from "react";
import { resolveStorageImageUrl } from "../lib/storageImageUrl.mjs";
import { getCatalogImageSource } from "../lib/catalogImageSource.mjs";

export default function CatalogImage({ sources = [], ...props }) {
  const urls = [...new Set(sources.map((url) => resolveStorageImageUrl(url)).filter(Boolean))];
  return <CatalogImageContent key={urls.join("|")} urls={urls} {...props} />;
}

function CatalogImageContent({ urls, alt, unoptimized = false, ...props }) {
  const [index, setIndex] = useState(0);
  const [useOriginal, setUseOriginal] = useState(false);
  const src = urls[index];
  if (!src) return <span role="img" aria-label={alt || "Sin imagen"} className="flex h-full w-full items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">Sin imagen</span>;
  const optimizedSource = getCatalogImageSource(src);
  const canOptimize = optimizedSource.startsWith("/") && !optimizedSource.startsWith("//");
  const showOriginal = unoptimized || !canOptimize || useOriginal;
  return <Image
    {...props}
    src={showOriginal ? src : optimizedSource}
    alt={alt || "Producto"}
    width={600}
    height={400}
    quality={75}
    unoptimized={showOriginal}
    onError={() => {
      if (canOptimize && !useOriginal) setUseOriginal(true);
      else { setIndex((value) => value + 1); setUseOriginal(false); }
    }}
  />;
}
