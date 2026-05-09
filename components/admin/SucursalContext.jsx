"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/SupabaseClient";

const STORAGE_KEY = "streetwear.active_sucursal_id";
const COUNTRY_STORAGE_KEY = "streetwear.active_pais_id";
const SucursalContext = createContext(null);

function getSavedSucursalId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(STORAGE_KEY) || "";
}

function getSavedPaisId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(COUNTRY_STORAGE_KEY) || "";
}

export function SucursalProvider({ children, showShell = true }) {
  const [sucursales, setSucursales] = useState([]);
  const [paises, setPaises] = useState([]);
  const [activePaisId, setActivePaisIdState] = useState("");
  const [activeSucursalId, setActiveSucursalIdState] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);

  const setActivePaisId = useCallback((id) => {
    setActivePaisIdState(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(COUNTRY_STORAGE_KEY, id);
      window.dispatchEvent(new CustomEvent("pais:changed", { detail: { paisId: id } }));
    }
  }, []);

  const setActiveSucursalId = useCallback((id) => {
    setActiveSucursalIdState(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, id);
      window.dispatchEvent(new CustomEvent("sucursal:changed", { detail: { sucursalId: id } }));
    }
  }, []);

  const loadSucursales = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch("/api/admin/sucursal-context", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "No se pudieron cargar sucursales.");
      }

      const branches = result.sucursales || [];
      const countries = result.paises || [];
      const savedPaisId = getSavedPaisId();
      const savedPaisStillValid = countries.some((country) => country.id === savedPaisId);
      const nextPaisId = savedPaisStillValid ? savedPaisId : countries[0]?.id || branches[0]?.pais_id || "";
      const branchesForCountry = nextPaisId ? branches.filter((branch) => branch.pais_id === nextPaisId) : branches;
      const savedId = getSavedSucursalId();
      const savedStillValid = branchesForCountry.some((branch) => branch.id === savedId);
      const nextId = savedStillValid ? savedId : branchesForCountry[0]?.id || "";

      setPaises(countries);
      setActivePaisId(nextPaisId || "");
      setSucursales(branches);
      setActiveSucursalId(nextId || "");
      setSelectorOpen((countries.length > 1 && !savedPaisStillValid) || (branchesForCountry.length > 1 && !savedStillValid));
    } catch (requestError) {
      setError(requestError?.message || "No se pudieron cargar sucursales.");
    } finally {
      setLoading(false);
    }
  }, [setActivePaisId, setActiveSucursalId]);

  useEffect(() => {
    loadSucursales();
  }, [loadSucursales]);

  const activeSucursal = useMemo(
    () => sucursales.find((branch) => branch.id === activeSucursalId && (!activePaisId || branch.pais_id === activePaisId)) || null,
    [activePaisId, activeSucursalId, sucursales]
  );

  const activePais = useMemo(
    () => paises.find((country) => country.id === activePaisId) || null,
    [activePaisId, paises]
  );

  const sucursalesActivas = useMemo(
    () => activePaisId ? sucursales.filter((branch) => branch.pais_id === activePaisId) : sucursales,
    [activePaisId, sucursales]
  );

  useEffect(() => {
    if (!activePaisId) return;
    if (sucursalesActivas.length === 0) {
      if (activeSucursalId) setActiveSucursalId("");
      return;
    }
    if (!sucursalesActivas.some((branch) => branch.id === activeSucursalId)) {
      setActiveSucursalId(sucursalesActivas[0].id);
    }
  }, [activePaisId, activeSucursalId, setActiveSucursalId, sucursalesActivas]);

  const value = useMemo(
    () => ({
      paises,
      activePais,
      activePaisId,
      sucursales,
      sucursalesActivas,
      activeSucursal,
      activeSucursalId,
      loading,
      error,
      setActivePaisId,
      setActiveSucursalId,
      reloadSucursales: loadSucursales,
    }),
    [activePais, activePaisId, activeSucursal, activeSucursalId, error, loadSucursales, loading, paises, setActivePaisId, setActiveSucursalId, sucursales, sucursalesActivas]
  );

  return (
    <SucursalContext.Provider value={value}>
      <SucursalShell
        activePais={activePais}
        activePaisId={activePaisId}
        activeSucursal={activeSucursal}
        activeSucursalId={activeSucursalId}
        error={error}
        loading={loading}
        selectorOpen={selectorOpen}
        paises={paises}
        setActivePaisId={setActivePaisId}
        setActiveSucursalId={setActiveSucursalId}
        setSelectorOpen={setSelectorOpen}
        showShell={showShell}
        sucursales={sucursalesActivas}
      >
        {children}
      </SucursalShell>
    </SucursalContext.Provider>
  );
}

function SucursalShell({
  activePais,
  activePaisId,
  activeSucursal,
  activeSucursalId,
  children,
  error,
  loading,
  paises,
  setActivePaisId,
  selectorOpen,
  setActiveSucursalId,
  setSelectorOpen,
  showShell,
  sucursales,
}) {
  const needsSelection = !loading && sucursales.length > 1 && selectorOpen;

  if (!showShell) return <>{children}</>;

  return (
    <>
      <div className="mb-4 rounded-md border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Operacion activa</p>
            <p className="text-base font-black text-gray-900">
              {loading ? "Cargando operacion..." : `${activePais?.nombre || "Sin pais"} / ${activeSucursal?.nombre || "Sin sucursal"}`}
            </p>
            {error && <p className="mt-1 text-sm font-semibold text-red-600">{error}</p>}
          </div>

          {(paises.length > 1 || sucursales.length > 1) && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {paises.length > 1 && (
                <select
                  className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                  value={activePaisId}
                  onChange={(event) => setActivePaisId(event.target.value)}
                >
                  {paises.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.nombre}
                    </option>
                  ))}
                </select>
              )}
              <select
                className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                value={activeSucursalId}
                onChange={(event) => setActiveSucursalId(event.target.value)}
              >
                {sucursales.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.nombre}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-md bg-gray-900 px-3 py-2 text-sm font-bold !text-white hover:bg-gray-800 disabled:bg-gray-400 disabled:!text-white"
                onClick={() => setSelectorOpen(true)}
              >
                Cambiar
              </button>
            </div>
          )}
        </div>
      </div>

      {children}

      {needsSelection && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-2xl">
            <h2 className="text-xl font-black text-gray-900">Selecciona la sucursal</h2>
            <p className="mt-1 text-sm text-gray-600">
              Trabajaras solo con los datos del pais y sucursal elegidos en esta sesion.
            </p>

            {paises.length > 1 && (
              <div className="mt-4">
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Pais</label>
                <select
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800"
                  value={activePaisId}
                  onChange={(event) => setActivePaisId(event.target.value)}
                >
                  {paises.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-4 grid gap-2">
              {sucursales.map((branch) => (
                <button
                  key={branch.id}
                  type="button"
                  className={`rounded-md border px-4 py-3 text-left transition ${
                    branch.id === activeSucursalId
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 bg-white hover:border-gray-400"
                  }`}
                  onClick={() => {
                    setActiveSucursalId(branch.id);
                    setSelectorOpen(false);
                  }}
                >
                  <span className="block font-black text-gray-900">{branch.nombre}</span>
                  <span className="block text-sm text-gray-500">{branch.direccion || branch.slug}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function useSucursalActiva() {
  const context = useContext(SucursalContext);
  if (!context) {
    throw new Error("useSucursalActiva debe usarse dentro de SucursalProvider");
  }
  return context;
}
