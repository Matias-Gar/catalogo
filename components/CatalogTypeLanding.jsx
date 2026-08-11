"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Boxes, Package, ShoppingBag, ArrowRight } from "lucide-react";
import { useProductViews } from "@/hooks/useProductViews";
import { buildCountryPath, getCountrySlugFromPath } from "@/lib/countryRoutes";
import { getProductViewPublicPath } from "@/lib/productViews";
import { DEFAULT_STORE_SETTINGS, fetchStoreSettings } from "@/lib/storeSettings";

const CARD_STYLES = [
  "from-violet-600 to-indigo-700",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-blue-700",
  "from-rose-500 to-pink-700",
  "from-fuchsia-500 to-purple-700",
];

function ViewIcon({ index }) {
  const Icon = index % 3 === 0 ? ShoppingBag : index % 3 === 1 ? Package : Boxes;
  return <Icon className="h-9 w-9" strokeWidth={1.8} />;
}

export default function CatalogTypeLanding() {
  const pathname = usePathname();
  const countrySlug = getCountrySlugFromPath(pathname);
  const { productViews, loadingProductViews } = useProductViews();
  const [storeSettings, setStoreSettings] = useState(DEFAULT_STORE_SETTINGS);

  useEffect(() => {
    let mounted = true;
    fetchStoreSettings({ paisSlug: countrySlug }).then((settings) => {
      if (mounted) setStoreSettings(settings);
    });
    return () => { mounted = false; };
  }, [countrySlug]);

  return (
    <main className="min-h-[calc(100vh-80px)] bg-[radial-gradient(circle_at_top_left,_#ede9fe,_transparent_40%),linear-gradient(180deg,#f8fafc,#eef2ff)] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="mb-7 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-md sm:px-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:text-left">
            <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-50 p-2">
              <img src="/brand/garblac-logo.png" alt="Importadora GARBLAC" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 sm:justify-start">
                <h1 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{storeSettings.store_name || 'Street Wear'}</h1>
                <span className="text-sm font-bold text-violet-700">una tienda de Importadora GARBLAC</span>
              </div>
              <p className="mt-1 text-sm leading-6 text-slate-600">Importadora legalmente establecida, con documentación en regla y Matrícula de Comercio.</p>
            </div>
            {storeSettings.store_logo_url && <img src={storeSettings.store_logo_url} alt={`Logo de ${storeSettings.store_name || 'Street Wear'}`} className="hidden h-14 w-14 shrink-0 rounded-full border-2 border-white object-cover shadow sm:block" />}
          </div>
        </div>

        <div className="mx-auto mb-7 max-w-3xl text-center">
          <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">¿Qué deseas ver en el catálogo?</h2>
          <p className="mt-2 text-sm text-slate-600 sm:text-base">Elige una sección. Cada tipo está organizado por separado.</p>
        </div>

        {loadingProductViews ? (
          <div className="py-16 text-center font-semibold text-slate-500">Cargando catálogos...</div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {productViews.map((view, index) => (
              <Link
                key={view.value}
                href={buildCountryPath(countrySlug, getProductViewPublicPath(view.value))}
                className="group overflow-hidden rounded-3xl bg-white shadow-md ring-1 ring-slate-200 transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
              >
                <div className={`flex min-h-36 flex-col justify-between bg-gradient-to-br ${CARD_STYLES[index % CARD_STYLES.length]} p-5 text-white`}>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur"><ViewIcon index={index} /></div>
                  <div className="mt-5 flex items-end justify-between gap-3">
                    <div><p className="text-xs font-bold uppercase tracking-widest text-white/70">Catálogo</p><h2 className="mt-1 text-2xl font-black">{view.label}</h2></div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-900 transition group-hover:translate-x-1"><ArrowRight className="h-5 w-5" /></span>
                  </div>
                </div>
                <div className="px-6 py-4 text-sm font-semibold text-slate-600">Ver productos de {view.label.toLowerCase()}</div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
