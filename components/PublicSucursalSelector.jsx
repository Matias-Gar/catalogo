"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { buildCountryPath, getCountrySlugFromPath, stripCountryFromPath } from "../lib/countryRoutes";

const STORAGE_KEY = "streetwear.public_sucursal_id";

function getSavedSucursalId(countrySlug = "bo") {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(`${STORAGE_KEY}_${countrySlug}`) || window.localStorage.getItem(STORAGE_KEY) || "";
}

export function usePublicSucursal() {
  const [sucursales, setSucursales] = useState([]);
  const [activePais, setActivePais] = useState(null);
  const [activeSucursalId, setActiveSucursalIdState] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const activeCountrySlug = getCountrySlugFromPath(pathname);

  const setActiveSucursalId = useCallback((id) => {
    setActiveSucursalIdState(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`${STORAGE_KEY}_${activeCountrySlug}`, id);
      window.dispatchEvent(new CustomEvent("public-sucursal:changed", { detail: { sucursalId: id, countrySlug: activeCountrySlug } }));
    }
  }, [activeCountrySlug]);

  useEffect(() => {
    let mounted = true;

    const loadSucursales = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/public/sucursales?pais=${encodeURIComponent(activeCountrySlug)}`);
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || "No se pudieron cargar sucursales.");
        }

        const branches = Array.isArray(result.sucursales) ? result.sucursales : [];
        const savedId = getSavedSucursalId(activeCountrySlug);
        const savedStillValid = branches.some((branch) => branch.id === savedId);
        const nextId = savedStillValid ? savedId : branches[0]?.id || "";

        if (!mounted) return;
        setSucursales(branches);
        setActivePais(result.pais || null);
        if (nextId) setActiveSucursalId(nextId);
      } catch (requestError) {
        if (mounted) setError(requestError?.message || "No se pudieron cargar sucursales.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadSucursales();

    return () => {
      mounted = false;
    };
  }, [activeCountrySlug, setActiveSucursalId]);

  useEffect(() => {
    const syncFromBrowser = (event) => {
      if (event?.detail?.countrySlug && event.detail.countrySlug !== activeCountrySlug) return;
      const nextId = event?.detail?.sucursalId || getSavedSucursalId(activeCountrySlug);
      if (nextId) setActiveSucursalIdState(nextId);
    };

    const syncFromStorage = (event) => {
      if (event.key === STORAGE_KEY) syncFromBrowser(event);
    };

    window.addEventListener("public-sucursal:changed", syncFromBrowser);
    window.addEventListener("storage", syncFromStorage);

    return () => {
      window.removeEventListener("public-sucursal:changed", syncFromBrowser);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, [activeCountrySlug]);

  const activeSucursal = useMemo(
    () => sucursales.find((branch) => branch.id === activeSucursalId) || null,
    [activeSucursalId, sucursales]
  );

  return {
    sucursales,
    activePais,
    activeCountrySlug,
    activeSucursal,
    activeSucursalId,
    loading,
    error,
    setActiveSucursalId,
  };
}

export default function PublicSucursalSelector({
  activeSucursal,
  activeSucursalId,
  currentPublicView,
  error,
  loading,
  setActiveSucursalId,
  sucursales,
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const countrySlug = getCountrySlugFromPath(pathname);
  const cleanPath = stripCountryFromPath(pathname);
  const isPedidoRoute = cleanPath?.includes("/productos");
  const articleHref = buildCountryPath(countrySlug, isPedidoRoute ? "/productos" : "/");
  const insumosHref = buildCountryPath(countrySlug, isPedidoRoute ? "/insumos/productos" : "/insumos");

  if (loading || sucursales.length === 0) return null;

  return (
    <div className="fixed right-3 top-20 z-40 sm:right-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full border border-gray-200 bg-white/85 px-3 py-1.5 text-[11px] font-semibold text-gray-600 shadow-sm backdrop-blur transition hover:bg-white hover:text-gray-900"
        title="Cambiar sucursal"
      >
        {activeSucursal?.nombre || "Sucursal"}
      </button>

      {open && (
        <div className="mt-2 w-64 rounded-lg border border-gray-200 bg-white/95 p-3 text-sm shadow-xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Ver desde</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-7 w-7 rounded-full text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              title="Cerrar"
            >
              x
            </button>
          </div>

          {error && <p className="mb-2 rounded-md bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">{error}</p>}

          <div className="space-y-1">
            {sucursales.map((branch) => (
              <button
                key={branch.id}
                type="button"
                className={`w-full rounded-md px-2.5 py-2 text-left transition ${
                  branch.id === activeSucursalId
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => setActiveSucursalId(branch.id)}
              >
                <span className="block truncate font-bold">{branch.nombre}</span>
                {branch.direccion && (
                  <span className={`block truncate text-xs ${branch.id === activeSucursalId ? "text-gray-300" : "text-gray-400"}`}>
                    {branch.direccion}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
            <Link
              href={articleHref}
              className={`rounded-md px-3 py-2 text-center text-xs font-bold transition ${
                currentPublicView === "articulos" ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => setOpen(false)}
            >
              Articulos
            </Link>
            <Link
              href={insumosHref}
              className={`rounded-md px-3 py-2 text-center text-xs font-bold transition ${
                currentPublicView === "insumos" ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => setOpen(false)}
            >
              Insumos
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
