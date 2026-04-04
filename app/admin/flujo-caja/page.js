"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Toast, showToast } from "../../../components/ui/Toast";
import { supabase } from "../../../lib/SupabaseClient";

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Efectivo" },
  { value: "qr", label: "QR" },
  { value: "transfer", label: "Transferencia" },
  { value: "other", label: "Otros" },
];

const TYPE_OPTIONS = [
  { value: "income", label: "Ingreso" },
  { value: "expense", label: "Egreso" },
];

const PIE_COLORS = ["#16a34a", "#0284c7", "#7c3aed", "#f59e0b"];

function formatBs(value) {
  return `Bs ${Number(value || 0).toFixed(2)}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function FlujoCajaPage() {
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [openingBalanceInput, setOpeningBalanceInput] = useState("");
  const [realCashInput, setRealCashInput] = useState("");
  const [userId, setUserId] = useState("");
  const [cashboxId, setCashboxId] = useState("main");
  const [openingQrInput, setOpeningQrInput] = useState("");
  const [realQrInput, setRealQrInput] = useState("");

  const [summary, setSummary] = useState(null);
  const [closures, setClosures] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingClosures, setLoadingClosures] = useState(false);
  const [submittingClosure, setSubmittingClosure] = useState(false);

  const [movementDate, setMovementDate] = useState(todayISO());
  const [movementType, setMovementType] = useState("income");
  const [movementMethod, setMovementMethod] = useState("cash");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementDescription, setMovementDescription] = useState("");
  const [savingMovement, setSavingMovement] = useState(false);

  async function getSessionContext() {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session?.user?.id || !data?.session?.access_token) {
      throw new Error("Sesion no valida. Inicia sesion para usar caja.");
    }
    const uid = data.session.user.id;
    const token = data.session.access_token;
    setUserId(uid);
    return { uid, token };
  }

  async function authFetch(url, options = {}) {
    const { token } = await getSessionContext();
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    };
    return fetch(url, { ...options, headers });
  }

  async function fetchSummary() {
    try {
      setLoadingSummary(true);
      const { uid, token } = await getSessionContext();
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        cashbox_id: cashboxId || "main",
      });

      if (openingBalanceInput !== "") params.set("opening_balance", openingBalanceInput);
      if (openingQrInput !== "") params.set("opening_qr", openingQrInput);

      const res = await fetch(`/api/cash/summary?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await res.json();

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudo cargar el resumen de caja");
      }

      setSummary(payload.data);
      setUserId(uid);
    } catch (error) {
      showToast(error.message || "Error al cargar resumen", "error");
    } finally {
      setLoadingSummary(false);
    }
  }

  async function fetchClosures() {
    try {
      setLoadingClosures(true);
      const { uid, token } = await getSessionContext();
      const params = new URLSearchParams({
        cashbox_id: cashboxId || "main",
        limit: "25",
      });

      const res = await fetch(`/api/cash/closures?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await res.json();

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudo cargar historial de cierres");
      }

      setClosures(payload.data || []);
      setUserId(uid);
    } catch (error) {
      showToast(error.message || "Error al cargar cierres", "error");
    } finally {
      setLoadingClosures(false);
    }
  }

  useEffect(() => {
    fetchSummary();
    fetchClosures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const difference = useMemo(() => {
    const expectedCash = Number(summary?.expected_cash || 0);
    const realCash = Number(realCashInput || 0);
    if (!Number.isFinite(realCash)) return 0;
    return Number((realCash - expectedCash).toFixed(2));
  }, [realCashInput, summary]);

  const qrDifference = useMemo(() => {
    const expectedQr = Number(summary?.expected_qr || 0);
    const realQr = Number(realQrInput || 0);
    if (!Number.isFinite(realQr)) return 0;
    return Number((realQr - expectedQr).toFixed(2));
  }, [realQrInput, summary]);

  const chartIncomeExpenseData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "Ingresos", monto: Number(summary?.totals?.income || 0) },
      { name: "Egresos", monto: Number(summary?.totals?.expense || 0) },
    ];
  }, [summary]);

  const chartMethodDistribution = useMemo(() => {
    if (!summary) return [];
    return PAYMENT_OPTIONS.map((method) => ({
      name: method.label,
      value: Number(summary?.income_by_method?.[method.value] || 0),
    }));
  }, [summary]);

  async function handleCreateMovement(e) {
    e.preventDefault();

    try {
      setSavingMovement(true);
      const res = await authFetch("/api/cash/movements", {
        method: "POST",
        body: JSON.stringify({
          date: movementDate,
          type: movementType,
          payment_method: movementMethod,
          amount: movementAmount,
          description: movementDescription,
          cashbox_id: cashboxId || "main",
        }),
      });

      const payload = await res.json();

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudo registrar el movimiento");
      }

      setMovementAmount("");
      setMovementDescription("");
      showToast("Movimiento registrado correctamente");
      await fetchSummary();
    } catch (error) {
      showToast(error.message || "Error al registrar movimiento", "error");
    } finally {
      setSavingMovement(false);
    }
  }

  async function handleCloseCash() {
    if (realCashInput === "") {
      showToast("Ingresa el efectivo contado en caja", "info");
      return;
    }

    try {
      setSubmittingClosure(true);
      const res = await authFetch("/api/cash/closure", {
        method: "POST",
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          opening_balance: openingBalanceInput === "" ? null : Number(openingBalanceInput),
          opening_qr: openingQrInput === "" ? null : Number(openingQrInput),
          real_cash: Number(realCashInput),
          real_qr: realQrInput === "" ? null : Number(realQrInput),
          cashbox_id: cashboxId || "main",
        }),
      });

      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudo cerrar caja");
      }

      showToast("Cierre de caja registrado correctamente");
      await Promise.all([fetchSummary(), fetchClosures()]);
    } catch (error) {
      showToast(error.message || "Error al cerrar caja", "error");
    } finally {
      setSubmittingClosure(false);
    }
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-white via-slate-50 to-slate-100 px-4 py-8 sm:px-6 lg:px-8">
      <Toast />

      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-3xl font-black text-slate-900">Flujo de Caja y Cierre Dinamico</h1>
          <p className="mt-2 text-sm text-slate-600">
            Cierre por rango personalizado. Solo efectivo impacta la caja fisica esperada.
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow md:grid-cols-2 lg:grid-cols-5">
          <label className="text-sm font-semibold text-slate-700">
            Fecha inicio
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Fecha fin
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Caja
            <input
              type="text"
              value={cashboxId}
              onChange={(e) => setCashboxId(e.target.value)}
              placeholder="main"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Usuario logueado
            <input
              type="text"
              value={userId}
              readOnly
              placeholder="Debes iniciar sesion"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                fetchSummary();
                fetchClosures();
              }}
              disabled={loadingSummary || loadingClosures}
              className="h-10 w-full rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-black disabled:bg-slate-400"
            >
              {loadingSummary || loadingClosures ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Ingresos totales</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatBs(summary?.totals?.income)}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow">
            <p className="text-xs font-bold uppercase tracking-wide text-rose-600">Egresos totales</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatBs(summary?.totals?.expense)}</p>
          </div>
          <div className="rounded-2xl border border-sky-200 bg-white p-5 shadow">
            <p className="text-xs font-bold uppercase tracking-wide text-sky-600">Saldo neto</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatBs(summary?.totals?.net)}</p>
          </div>
          <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow">
            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600">Efectivo esperado</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatBs(summary?.expected_cash)}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow">
            <h2 className="text-lg font-extrabold text-slate-900">Registrar movimiento</h2>
            <p className="mt-1 text-sm text-slate-600">Ingreso o egreso con metodo de pago y descripcion.</p>

            <form onSubmit={handleCreateMovement} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Fecha
                <input
                  type="date"
                  value={movementDate}
                  onChange={(e) => setMovementDate(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
                  required
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Tipo
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
                >
                  {TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Metodo de pago
                <select
                  value={movementMethod}
                  onChange={(e) => setMovementMethod(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
                >
                  {PAYMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Monto
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
                  placeholder="0.00"
                  required
                />
              </label>

              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Descripcion
                <input
                  type="text"
                  value={movementDescription}
                  onChange={(e) => setMovementDescription(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
                  placeholder="Detalle del movimiento"
                />
              </label>

              <button
                type="submit"
                disabled={savingMovement}
                className="h-10 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-300 md:col-span-2"
              >
                {savingMovement ? "Guardando..." : "Guardar movimiento"}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow">
            <h2 className="text-lg font-extrabold text-slate-900">Cierre de caja</h2>
            <p className="mt-1 text-sm text-slate-600">
              expected_cash = saldo inicial + ingresos efectivo - egresos efectivo
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3">
              <label className="text-sm font-semibold text-slate-700">
                Saldo inicial (manual opcional)
                <input
                  type="number"
                  step="0.01"
                  value={openingBalanceInput}
                  onChange={(e) => setOpeningBalanceInput(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
                  placeholder="Si esta vacio usa ultimo cierre"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Saldo inicial QR (manual opcional)
                <input
                  type="number"
                  step="0.01"
                  value={openingQrInput}
                  onChange={(e) => setOpeningQrInput(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
                  placeholder="Si esta vacio usa 0 o ultimo cierre con QR"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Efectivo contado en caja
                <input
                  type="number"
                  step="0.01"
                  value={realCashInput}
                  onChange={(e) => setRealCashInput(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
                  placeholder="0.00"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                QR real (opcional para control)
                <input
                  type="number"
                  step="0.01"
                  value={realQrInput}
                  onChange={(e) => setRealQrInput(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
                  placeholder="Si esta vacio usa esperado QR"
                />
              </label>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Apertura</span>
                  <span className="font-semibold text-slate-900">{formatBs(summary?.opening_balance)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-600">Esperado en efectivo</span>
                  <span className="font-semibold text-slate-900">{formatBs(summary?.expected_cash)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-600">Esperado en QR</span>
                  <span className="font-semibold text-slate-900">{formatBs(summary?.expected_qr)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-600">Diferencia</span>
                  <span
                    className={`font-extrabold ${
                      difference < 0 ? "text-red-600" : difference > 0 ? "text-amber-600" : "text-emerald-600"
                    }`}
                  >
                    {formatBs(difference)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-slate-600">Diferencia QR</span>
                  <span
                    className={`font-extrabold ${
                      qrDifference < 0 ? "text-red-600" : qrDifference > 0 ? "text-amber-600" : "text-emerald-600"
                    }`}
                  >
                    {formatBs(qrDifference)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCloseCash}
                disabled={submittingClosure || !summary}
                className="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-black disabled:bg-slate-400"
              >
                {submittingClosure ? "Cerrando..." : "Cerrar caja"}
              </button>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow">
            <h3 className="text-base font-extrabold text-slate-900">Ingresos vs Egresos</h3>
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartIncomeExpenseData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatBs(value)} />
                  <Bar dataKey="monto" fill="#0f766e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow">
            <h3 className="text-base font-extrabold text-slate-900">Distribucion ingresos por metodo</h3>
            <div className="mt-3 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartMethodDistribution}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {chartMethodDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatBs(value)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow">
          <h3 className="text-base font-extrabold text-slate-900">Historial de cierres</h3>
          <p className="mt-1 text-sm text-slate-600">Ultimos cierres personalizados de la caja seleccionada.</p>

          {loadingClosures ? (
            <div className="mt-4 text-sm text-slate-500">Cargando cierres...</div>
          ) : closures.length === 0 ? (
            <div className="mt-4 text-sm text-slate-500">No hay cierres registrados.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2">Rango</th>
                    <th className="py-2">Apertura</th>
                    <th className="py-2">Esperado</th>
                    <th className="py-2">Real</th>
                    <th className="py-2">Diferencia</th>
                    <th className="py-2">Creado</th>
                  </tr>
                </thead>
                <tbody>
                  {closures.map((closure) => (
                    <tr key={closure.id} className="border-b border-slate-100 text-slate-700">
                      <td className="py-2">{closure.start_date} - {closure.end_date}</td>
                      <td className="py-2">{formatBs(closure.opening_balance)}</td>
                      <td className="py-2">{formatBs(closure.expected_cash)}</td>
                      <td className="py-2">{formatBs(closure.real_cash)}</td>
                      <td
                        className={`py-2 font-semibold ${
                          Number(closure.difference) < 0
                            ? "text-red-600"
                            : Number(closure.difference) > 0
                              ? "text-amber-600"
                              : "text-emerald-600"
                        }`}
                      >
                        {formatBs(closure.difference)}
                      </td>
                      <td className="py-2">{new Date(closure.created_at).toLocaleString("es-BO")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
