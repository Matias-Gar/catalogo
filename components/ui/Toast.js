// components/ui/toast.js
import React from "react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Función para mostrar las notificaciones
export const showToast = (message, type = "success") => {
  if (type === "success") {
    toast.success(message);
  } else if (type === "error") {
    toast.error(message);
  } else {
    toast.info(message);
  }
};

// Componente que contiene el ToastContainer
export function Toast() {
  return (
    <ToastContainer
      position="top-right"
      autoClose={5000}
      hideProgressBar
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
    />
  );
}
