// 📊 Componente para Facebook Pixel - JavaScript version
"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function FacebookPixel() {
  const pathname = usePathname();

  useEffect(() => {
    // Solo cargar si tenemos el píxel configurado
    const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;
    if (!pixelId) return;

    // Función fbq global
    if (typeof window !== 'undefined') {
      window.fbq = window.fbq || function() {
        (window.fbq.q = window.fbq.q || []).push(arguments);
      };

      // Script del píxel
      if (!document.getElementById('facebook-pixel')) {
        const script = document.createElement('script');
        script.id = 'facebook-pixel';
        script.async = true;
        script.src = 'https://connect.facebook.net/en_US/fbevents.js';
        document.head.appendChild(script);

        // Inicializar píxel
        window.fbq('init', pixelId);
        window.fbq('track', 'PageView');
      }
    }
  }, []);

  // Track de cambios de página
  useEffect(() => {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, [pathname]);

  // No renderizar nada visible
  return (
    <>
      {/* Facebook Pixel - No Script */}
      <noscript>
        <img 
          height="1" 
          width="1" 
          style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}

// Hook para usar tracking en componentes
export const useFacebookPixel = () => {
  const trackPurchase = (value, currency = 'BOB') => {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'Purchase', { value, currency });
    }
  };

  const trackAddToCart = (productId, value) => {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'AddToCart', { 
        content_ids: [productId], 
        value, 
        currency: 'BOB' 
      });
    }
  };

  const trackViewContent = (productId, productName) => {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'ViewContent', {
        content_ids: [productId],
        content_name: productName,
        content_type: 'product'
      });
    }
  };

  return {
    trackPurchase,
    trackAddToCart,
    trackViewContent
  };
};