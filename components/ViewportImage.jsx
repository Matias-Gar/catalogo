"use client";

import { useEffect, useRef, useState } from 'react';

/** @param {{children: import('react').ReactNode}} props */
export default function ViewportImage({ children }) {
  const container = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={container} className="h-full w-full">
    {visible ? children : <div className="h-full w-full bg-current opacity-5" aria-hidden="true" />}
  </div>;
}
