// app/layout.tsx

import type { Metadata } from "next";
// 💡 NOTA: Asumo que estás usando la versión correcta de "geist/font" o "next/font/google"
// La importación de las fuentes depende de cómo las hayas instalado.
// Si usas 'next/font/google' para Geist, tu estructura de importación es correcta.
import { Geist, Geist_Mono } from "next/font/google"; 
import "./globals.css";
import Header from "../components/Header"; 
import FacebookPixel from "../components/FacebookPixel"; 
import ToastProvider from "@/components/ui/ToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mi Tienda Online",
  description: "Catálogo y pedidos en línea",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Cambié 'lang="en"' a 'lang="es"' ya que estás programando en español
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        
        {/* 💡 PASO 2: Colocar el Header antes del {children} */}
        {/* El Header aparecerá en la parte superior de todas las páginas */}
        <Header /> 
        
        {children}
        
        {/* 📊 Facebook Pixel para tracking */}
        <FacebookPixel />
        <ToastProvider />
      </body>
    </html>
  );
}