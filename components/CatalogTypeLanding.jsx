"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Boxes, Headphones, ImageIcon, Package, ShieldCheck, ShoppingBag, Tags, Truck } from "lucide-react";
import { useProductViews } from "@/hooks/useProductViews";
import { buildCountryPath, getCountrySlugFromPath } from "@/lib/countryRoutes";
import { getProductViewPublicPath } from "@/lib/productViews";
import { usePublicSucursal } from "@/components/PublicSucursalSelector";

const CARD_STYLES = [
  { accent: "#5b42e8", soft: "#f1efff", border: "#9c8cff" },
  { accent: "#ff6b16", soft: "#fff3eb", border: "#ffab78" },
  { accent: "#15945b", soft: "#ecfbf3", border: "#74c99d" },
  { accent: "#1684c7", soft: "#edf8ff", border: "#72bce8" },
  { accent: "#df356a", soft: "#fff0f5", border: "#ed8baa" },
  { accent: "#9a42d1", soft: "#faf0ff", border: "#c68ce8" },
];

function ViewIcon({ index }) {
  const Icon = index % 3 === 0 ? ShoppingBag : index % 3 === 1 ? Package : Boxes;
  return <Icon className="h-8 w-8" strokeWidth={1.8} />;
}

export default function CatalogTypeLanding() {
  const pathname = usePathname();
  const countrySlug = getCountrySlugFromPath(pathname);
  const { productViews, loadingProductViews } = useProductViews();
  const { activeSucursalId, loading: loadingSucursal } = usePublicSucursal();
  const [previews, setPreviews] = useState({});

  useEffect(() => {
    if (!activeSucursalId) return;
    let mounted = true;
    fetch(`/api/public/catalog-preview?sucursalId=${encodeURIComponent(activeSucursalId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => { if (mounted && result?.success) setPreviews(result.previews || {}); })
      .catch(() => { if (mounted) setPreviews({}); });
    return () => { mounted = false; };
  }, [activeSucursalId]);

  return (
    <main className="min-h-[calc(100vh-80px)] bg-[radial-gradient(circle_at_top_left,_#ede9fe,_transparent_38%),linear-gradient(180deg,#f8fafc,#f3f6fb)] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="mx-auto mb-6 max-w-3xl pt-2 text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">¿Qué deseas ver en el catálogo?</h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">Explora nuestras categorías y descubre todo lo que tenemos para ti.</p>
        </div>

        {loadingProductViews || loadingSucursal ? <div className="py-16 text-center font-semibold text-slate-500">Cargando catálogos...</div> : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {productViews.map((view, index) => {
              const style = CARD_STYLES[index % CARD_STYLES.length];
              const preview = previews[view.value] || { count: 0, categories: [] };
              return (
                <Link key={view.value} href={buildCountryPath(countrySlug, getProductViewPublicPath(view.value))}
                  className="group flex min-h-[255px] flex-col overflow-hidden rounded-3xl bg-white p-5 shadow-md transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
                  style={{ border: `1px solid ${style.border}` }}>
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-md" style={{ background: style.accent }}><ViewIcon index={index} /></div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: style.accent }}>Catálogo</p>
                      <h2 className="text-2xl font-black leading-tight text-slate-900">{view.label}</h2>
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">Descubre todo lo disponible en esta sección.</p>
                    </div>
                  </div>

                  <div className="mt-4 flex min-h-[76px] gap-2.5 overflow-x-auto pb-2">
                    {preview.categories.length ? preview.categories.map((category) => (
                      <div key={category.id} className="w-[58px] shrink-0 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 shadow-sm">
                          {category.imageUrl ? <img src={category.imageUrl} alt={category.name} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <ImageIcon className="h-5 w-5 text-slate-300" />}
                        </div>
                        <p className="mt-1 truncate text-[10px] font-bold text-slate-700" title={category.name}>{category.name}</p>
                      </div>
                    )) : <div className="flex w-full items-center justify-center rounded-2xl border border-dashed border-slate-200 text-xs font-semibold text-slate-400" style={{ background: style.soft }}>Próximamente nuevas categorías</div>}
                  </div>

                  <div className="mt-auto border-t border-slate-200 pt-3">
                    <div className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ background: style.accent }}>
                      <span>Ver productos de {view.label.toLowerCase()}</span>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white" style={{ color: style.accent }}><ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <section className="mt-6 overflow-hidden rounded-2xl border border-violet-100 bg-white/95 shadow-sm">
          <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-7">
            <div className="flex h-14 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-50 p-2">
              <img src="/brand/garblac-logo.png" alt="Importadora GARBLAC" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-700">Nuestra historia</p>
              <h2 className="mt-0.5 text-lg font-black leading-tight text-slate-900">Street Wear es una tienda de Importadora GARBLAC</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">Nacimos emprendiendo. Hoy importamos para que otros también puedan crecer.</p>
            </div>
          </div>

          <details className="group border-t border-slate-100">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-3 text-sm font-bold text-violet-700 transition hover:bg-violet-50/70 sm:px-7">
              <span>Conoce nuestra historia</span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-lg transition group-open:rotate-45">+</span>
            </summary>
            <div className="border-t border-violet-50 bg-gradient-to-b from-violet-50/50 to-white px-5 py-6 text-sm leading-7 text-slate-600 sm:px-7 md:px-10">
              <div className="mx-auto max-w-4xl space-y-4">
                <h3 className="text-xl font-black leading-tight text-slate-900">Nacimos emprendiendo. Hoy importamos para que otros también puedan crecer.</h3>
                <p>En <strong className="text-slate-900">Importadora GARBLAC</strong> conocemos lo que significa empezar desde abajo, cuidar cada boliviano invertido y buscar una oportunidad para salir adelante.</p>
                <p>Nosotros también comenzamos con un emprendimiento, con sueños, esfuerzo y muchas ganas de crecer. Ese camino nos enseñó algo importante: <strong className="text-slate-900">para un pequeño emprendedor, comprar a buen precio puede marcar la diferencia entre simplemente vender y realmente obtener ganancias.</strong></p>
                <p>Por eso comenzamos a importar directamente y a buscar alianzas con fabricantes y grandes empresas, con un propósito claro: <strong className="text-slate-900">acercar precios competitivos también a quienes están comenzando</strong>, no solamente a los grandes negocios.</p>
                <p>Queremos que quien inicia, desea generar un ingreso extra o está construyendo su negocio pueda acceder a <strong className="text-slate-900">productos e insumos de calidad a precios que le permitan crecer, competir y ganar.</strong></p>
                <blockquote className="rounded-xl border-l-4 border-violet-600 bg-white px-5 py-4 text-base font-black text-violet-800 shadow-sm">Si nuestros emprendedores crecen, nosotros crecemos con ellos.</blockquote>
                <p>Trabajamos constantemente para encontrar mejores productos, proveedores y precios. No queremos ser solamente una importadora que vende; queremos convertirnos en <strong className="text-slate-900">un aliado para cientos de emprendedores que están construyendo su futuro.</strong></p>
                <p className="leading-6">Detrás de cada producto que entregamos puede comenzar una venta.<br />Detrás de cada venta puede crecer un negocio.<br />Y detrás de ese negocio puede cambiar la historia de una familia.</p>
                <div className="pt-2 text-center">
                  <p className="text-lg font-black text-slate-900">Importadora GARBLAC</p>
                  <p className="font-bold text-violet-700">Importamos oportunidades. Impulsamos emprendedores. Crecemos juntos.</p>
                </div>
              </div>
            </div>
          </details>
        </section>

        <div className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          {[[ShieldCheck, "Calidad garantizada", "Productos seleccionados"], [Truck, "Envíos a nivel nacional", "Entregas rápidas y seguras"], [Tags, "Precios competitivos", "Las mejores opciones"], [Headphones, "Soporte especializado", "Atención personalizada"]].map(([Icon, title, text]) => (
            <div key={title} className="flex items-center gap-3 px-2 py-1"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-700"><Icon className="h-5 w-5" /></span><span><strong className="block text-xs text-slate-900">{title}</strong><small className="text-[10px] text-slate-500">{text}</small></span></div>
          ))}
        </div>
      </section>
    </main>
  );
}
