"use client";

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import CatalogImage from './CatalogImage';

export default function ProductImageViewer({ imageList, imageIndex = 0, productName, onClose, onSelect }) {
  const dialog = useRef(null);
  const touch = useRef(null);
  const count = imageList.length;
  const index = Math.max(0, Math.min(imageIndex, count - 1));

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const opener = document.activeElement;
    const body = document.body;
    const saved = { position: body.style.position, top: body.style.top, width: body.style.width, overflow: body.style.overflow };
    const scrollY = window.scrollY;
    Object.assign(body.style, { position: 'fixed', top: `-${scrollY}px`, width: '100%', overflow: 'hidden' });
    if (element.showModal) element.showModal();
    else element.setAttribute('open', '');
    element.querySelector('button')?.focus();
    return () => {
      if (element.open && element.close) element.close();
      Object.assign(body.style, saved);
      window.scrollTo(0, scrollY);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  if (!count || typeof document === 'undefined') return null;
  const move = (delta) => onSelect((index + delta + count) % count);
  return createPortal(
    <dialog ref={dialog} aria-label={`Imágenes de ${productName || 'producto'}`} aria-modal="true"
      className="product-image-viewer"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key === 'Tab') {
          const buttons = [...event.currentTarget.querySelectorAll('button')];
          const target = event.shiftKey ? buttons.at(-1) : buttons[0];
          if (document.activeElement === (event.shiftKey ? buttons[0] : buttons.at(-1))) { event.preventDefault(); target.focus(); }
        }
      }}>
      <div className="relative w-full max-w-2xl min-w-0">
        <button type="button" className="viewer-control absolute right-2 top-2 z-10" aria-label="Cerrar visor" onClick={onClose}>×</button>
        <div style={{ touchAction: 'pan-y pinch-zoom' }}
          onTouchStart={(event) => { touch.current = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null; }}
          onTouchMove={(event) => { if (event.touches.length !== 1) touch.current = null; }}
          onTouchCancel={() => { touch.current = null; }}
          onTouchEnd={(event) => {
            const start = touch.current;
            touch.current = null;
            if (!start || event.touches.length || !event.changedTouches.length) return;
            const dx = event.changedTouches[0].clientX - start.x;
            const dy = event.changedTouches[0].clientY - start.y;
            if (count > 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
          }}>
          <CatalogImage key={index} unoptimized sources={[imageList[index]]} alt={productName} sizes="(max-width: 768px) 100vw, 672px" loading="eager"
            className="viewer-image w-full object-contain rounded-xl bg-white" />
        </div>
        {count > 1 && <>
          <button type="button" className="viewer-control absolute left-2 top-1/2 -translate-y-1/2" aria-label="Imagen anterior" onClick={() => move(-1)}>←</button>
          <button type="button" className="viewer-control absolute right-2 top-1/2 -translate-y-1/2" aria-label="Imagen siguiente" onClick={() => move(1)}>→</button>
        </>}
        <p className="text-center text-white font-bold mt-2" aria-live="polite">{productName} ({index + 1} / {count})</p>
        {count > 1 && <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
          {imageList.map((src, i) => <button type="button" key={`${src}-${i}`} aria-label={`Ver imagen ${i + 1}`} aria-pressed={i === index}
            className={`shrink-0 rounded border-2 ${i === index ? 'border-green-600' : 'border-gray-300'}`} onClick={() => onSelect(i)}>
            <CatalogImage unoptimized sources={[src]} alt={`${productName} miniatura ${i + 1}`} sizes="56px" className="w-14 h-14 object-cover rounded" />
          </button>)}
        </div>}
      </div>
    </dialog>, document.body);
}
