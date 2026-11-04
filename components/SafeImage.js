"use client";
import Image from "next/image";
import { getCatalogImageSource } from '../lib/catalogImageSource.mjs';
import { catalogImageLoader } from '../lib/catalogImageLoader.mjs';
import { resolveStorageImageUrl } from '../lib/storageImageUrl.mjs';
export default function SafeImage(props) {
  const src = typeof props.src === 'string' ? resolveStorageImageUrl(props.src) : props.src;
  const owned = typeof src === 'string' && getCatalogImageSource(src).startsWith('/api/public/catalog-image?');
  return <Image {...props} src={src} loader={props.loader || (owned ? catalogImageLoader : undefined)} />;
}
