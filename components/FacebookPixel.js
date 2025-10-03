// 📊 Componente para Facebook Pixel
"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

declare global {
  interface Window {
    fbq: any;
  }
}

export default function FacebookPixel() {
  const pathname = usePathname();

  useEffect(() => {
    // Solo cargar si tenemos el píxel configurado
    const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;
    if (!pixelId) return;

    // Cargar Facebook Pixel
    import('react-facebook-pixel')
      .then((x) => x.default)
      .then((ReactPixel) => {
        ReactPixel.init(pixelId);
        ReactPixel.pageView();
      });

    // Función fbq global
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

  }, []);

  // Track de cambios de página
  useEffect(() => {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, [pathname]);

  // Funciones de tracking para eventos específicos
  const trackEvent = (eventName: string, data?: any) => {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', eventName, data);
    }
  };

  // Event tracking para e-commerce
  const trackPurchase = (value: number, currency: string = 'BOB') => {
    trackEvent('Purchase', { value, currency });
  };

  const trackAddToCart = (productId: string, value: number) => {
    trackEvent('AddToCart', { 
      content_ids: [productId], 
      value, 
      currency: 'BOB' 
    });
  };

  const trackViewContent = (productId: string, productName: string) => {
    trackEvent('ViewContent', {
      content_ids: [productId],
      content_name: productName,
      content_type: 'product'
    });
  };

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
  const trackPurchase = (value: number, currency: string = 'BOB') => {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'Purchase', { value, currency });
    }
  };

  const trackAddToCart = (productId: string, value: number) => {
    if (typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'AddToCart', { 
        content_ids: [productId], 
        value, 
        currency: 'BOB' 
      });
    }
  };

  const trackViewContent = (productId: string, productName: string) => {
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