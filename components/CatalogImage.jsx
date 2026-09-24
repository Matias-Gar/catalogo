"use client";

import Image from "next/image";
import { useState } from "react";

export default function CatalogImage({ sources = [], ...props }) {
  const urls = [...new Set(sources.filter((url) => typeof url === "string" && url.trim()))];
  return <CatalogImageContent key={urls.join("|")} urls={urls} {...props} />;
}

function CatalogImageContent({ urls, alt, ...props }) {
  const [index, setIndex] = useState(0);
  const [useOriginal, setUseOriginal] = useState(false);
  const src = urls[index];
  if (!src) return <span role="img" aria-label={alt || "Sin imagen"} className="flex h-full w-full items-center justify-center rounded-lg bg-gray-100 text-sm text-gray-500">Sin imagen</span>;
  let canOptimize = src.startsWith("/") && !src.startsWith("//");
  try {
    const url = new URL(src);
    canOptimize = url.protocol === "https:" && url.hostname === "gzvtuenpwndodnetnmzi.supabase.co" && url.pathname.startsWith("/storage/v1/object/public/");
  } catch { /* Local images use their relative URL. */ }
  return <Image
    {...props}
    src={src}
    alt={alt || "Producto"}
    width={600}
    height={400}
    quality={75}
    unoptimized={!canOptimize || useOriginal}
    onError={() => {
      if (canOptimize && !useOriginal) setUseOriginal(true);
      else { setIndex((value) => value + 1); setUseOriginal(false); }
    }}
  />;
}
