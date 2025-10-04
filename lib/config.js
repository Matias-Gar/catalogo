// Configuración global de la aplicación - Última actualización: número WhatsApp 59162121738

export const CONFIG = {
  // WhatsApp Business
  WHATSAPP_BUSINESS: "59162121738",
  
  // Nombre del negocio
  BUSINESS_NAME: "Tienda Online",
  
  // Configuración de promociones
  PROMOCIONES: {
    MOSTRAR_PORCENTAJE: true,
    MOSTRAR_MONTO: true,
    COLOR_DESCUENTO: "text-red-600",
    COLOR_PRECIO_PROMOCIONAL: "text-green-600"
  },
  
  // Configuración de inventario
  INVENTARIO: {
    STOCK_MINIMO_ALERTA: 3,
    STOCK_CRITICO_ALERTA: 1
  }
};

// Funciones de utilidad para WhatsApp
export const whatsappUtils = {
  // Crear URL de WhatsApp con mensaje
  createWhatsAppURL: (numero, mensaje) => {
    const encodedMessage = encodeURIComponent(mensaje);
    return `https://wa.me/${numero}?text=${encodedMessage}`;
  },
  
  // Abrir WhatsApp con mensaje
  openWhatsApp: (numero, mensaje) => {
    const url = whatsappUtils.createWhatsAppURL(numero, mensaje);
    window.open(url, '_blank');
  },
  
  // Enviar mensaje al WhatsApp Business
  sendToBusinessWhatsApp: (mensaje) => {
    whatsappUtils.openWhatsApp(CONFIG.WHATSAPP_BUSINESS, mensaje);
  }
};