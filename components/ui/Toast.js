// components/ui/toast.js
"use client";

import { toast } from "react-toastify";

// Función para mostrar las notificaciones
export function showToast(message, type = "success") {
  if (typeof window === "undefined") return;
  switch (type) {
    case "error":
      toast.error(message);
      break;
    case "info":
      toast.info(message);
      break;
    default:
      toast.success(message);
  }
}

// Componente que contiene el ToastContainer - NO USAR, usar ToastProvider.jsx
// Este componente se mantiene por compatibilidad pero no debe usarse
export function Toast() {
  return null;
}

export default Toast;
