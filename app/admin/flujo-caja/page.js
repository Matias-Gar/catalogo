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
  { value: "card", label: "Tarjeta" },
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

function weekRangeISO() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = (day + 6) % 7;

  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10),
  };
}

function monthRangeISO() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
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
  const [movements, setMovements] = useState([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingClosures, setLoadingClosures] = useState(false);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [submittingClosure, setSubmittingClosure] = useState(false);

  const [movementDate, setMovementDate] = useState(todayISO());
  const [movementType, setMovementType] = useState("income");
  const [movementMethod, setMovementMethod] = useState("cash");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementDescription, setMovementDescription] = useState("");
  const [savingMovement, setSavingMovement] = useState(false);
  const [deletingMovementId, setDeletingMovementId] = useState(null);
  const [editingMovement, setEditingMovement] = useState(null);
  const [editFormData, setEditFormData] = useState({
    date: "",
    type: "income",
    payment_method: "cash",
    amount: "",
    description: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

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

  async function fetchMovements() {
    try {
      setLoadingMovements(true);
      const { uid, token } = await getSessionContext();
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
        cashbox_id: cashboxId || "main",
        limit: "200",
      });

      const res = await fetch(`/api/cash/movements?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await res.json();

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudo cargar movimientos");
      }

      setMovements(payload.data || []);
      setUserId(uid);
    } catch (error) {
      showToast(error.message || "Error al cargar movimientos", "error");
    } finally {
      setLoadingMovements(false);
    }
  }

  useEffect(() => {
    fetchSummary();
    fetchClosures();
    fetchMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, cashboxId]);

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
      await Promise.all([fetchSummary(), fetchMovements()]);
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
      await Promise.all([fetchSummary(), fetchClosures(), fetchMovements()]);
    } catch (error) {
      showToast(error.message || "Error al cerrar caja", "error");
    } finally {
      setSubmittingClosure(false);
    }
  }

  async function handleDeleteMovement(movementId) {
    if (!window.confirm("¿Estás seguro que deseas eliminar este movimiento? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      setDeletingMovementId(movementId);
      const res = await authFetch(`/api/cash/movements?id=${movementId}`, {
        method: "DELETE",
      });

      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudo eliminar el movimiento");
      }

      showToast("Movimiento eliminado correctamente");
      await Promise.all([fetchSummary(), fetchMovements()]);
    } catch (error) {
      showToast(error.message || "Error al eliminar movimiento", "error");
    } finally {
      setDeletingMovementId(null);
    }
  }

  function openEditModal(movement) {
    setEditingMovement(movement.id);
    setEditFormData({
      date: movement.date || todayISO(),
      type: movement.type || "income",
      payment_method: movement.payment_method || "cash",
      amount: movement.amount || "",
      description: movement.description || "",
    });
  }

  function closeEditModal() {
    setEditingMovement(null);
    setEditFormData({
      date: "",
      type: "income",
      payment_method: "cash",
      amount: "",
      description: "",
    });
  }

  async function handleSaveEdit(e) {
    e.preventDefault();

    try {
      setSavingEdit(true);
      const res = await authFetch("/api/cash/movements", {
        method: "PATCH",
        body: JSON.stringify({
          id: editingMovement,
          date: editFormData.date,
          type: editFormData.type,
          payment_method: editFormData.payment_method,
          amount: editFormData.amount,
          description: editFormData.description,
        }),
      });

      const payload = await res.json();

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || "No se pudo actualizar el movimiento");
      }

      showToast("Movimiento actualizado correctamente");
      closeEditModal();
      await Promise.all([fetchSummary(), fetchMovements()]);
    } catch (error) {
      showToast(error.message || "Error al actualizar movimiento", "error");
    } finally {
      setSavingEdit(false);
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
            <div className="mt-1 flex items-center gap-2">
              <input
                type="text"
                value={userId || "No logueado"}
                readOnly
                placeholder="Debes iniciar sesion"
                className="h-10 flex-1 rounded-md border border-slate-300 bg-slate-900 px-3 font-mono text-sm font-bold text-white"
              />
              {userId && (
                <div className="flex items-center gap-1 rounded-md bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-700 shadow-md">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                  </svg>
                  Activo
                </div>
              )}
            </div>
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                fetchSummary();
                fetchClosures();
                fetchMovements();
              }}
              disabled={loadingSummary || loadingClosures}
              className="h-10 w-full rounded border-none px-7 py-2 text-sm font-black text-white shadow-md cursor-pointer bg-blue-500 hover:bg-blue-600"
            >
              {loadingSummary || loadingClosures ? "Actualizando..." : "Actualizar"}
            </button>
          </div>

          <div className="md:col-span-2 lg:col-span-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const today = todayISO();
                setStartDate(today);
                setEndDate(today);
              }}
              className="h-9 rounded border-none px-4 py-2 text-xs font-black text-white shadow-md cursor-pointer bg-green-500 hover:bg-green-600"
            >
              Diario (hoy)
            </button>
            <button
              type="button"
              onClick={() => {
                const range = weekRangeISO();
                setStartDate(range.from);
                setEndDate(range.to);
              }}
              className="h-9 rounded border-none px-4 py-2 text-xs font-black text-white shadow-md cursor-pointer bg-blue-500 hover:bg-blue-600"
            >
              Semanal
            </button>
            <button
              type="button"
              onClick={() => {
                const range = monthRangeISO();
                setStartDate(range.from);
                setEndDate(range.to);
              }}
              className="h-9 rounded border-none px-4 py-2 text-xs font-black text-white shadow-md cursor-pointer bg-orange-500 hover:bg-orange-600"
            >
              Mensual
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-6">
          <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Ingresos efectivo</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatBs(summary?.income_by_method?.cash)}</p>
          </div>
          <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow">
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Ingreso banco</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatBs(summary?.income_bank)}</p>
            <p className="mt-1 text-xs text-slate-500">QR + Tarjeta + Transferencia</p>
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
          <div className="rounded-2xl border border-cyan-200 bg-white p-5 shadow">
            <p className="text-xs font-bold uppercase tracking-wide text-cyan-600">QR esperado</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatBs(summary?.expected_qr)}</p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow">
            <h2 className="text-lg font-extrabold text-slate-900">Registrar movimiento</h2>
            <p className="mt-1 text-sm text-slate-600">Ingreso o egreso con metodo de pago y descripcion.</p>
            <p className="mt-1 text-xs text-slate-500">Puedes registrar ingresos extra fuera de inventario (por ejemplo, servicios, ajuste o ingreso adicional).</p>

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
                className="h-10 rounded border-none px-7 py-2 text-sm font-black text-white shadow-md cursor-pointer bg-green-500 hover:bg-green-600 disabled:bg-green-300 md:col-span-2"
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
                  className="h-10 rounded border-none px-7 py-2 text-sm font-black text-white shadow-md cursor-pointer bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 disabled:text-white"
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
          <h3 className="text-base font-extrabold text-slate-900">Movimientos registrados</h3>
          <p className="mt-1 text-sm text-slate-600">Lista de ingresos y egresos del rango seleccionado para confirmar cada registro.</p>

          {loadingMovements ? (
            <div className="mt-4 text-sm text-slate-500">Cargando movimientos...</div>
          ) : movements.length === 0 ? (
            <div className="mt-4 text-sm text-slate-500">No hay movimientos en el rango seleccionado.</div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2">Fecha</th>
                    <th className="py-2">Tipo</th>
                    <th className="py-2">Metodo</th>
                    <th className="py-2">Descripcion</th>
                    <th className="py-2 text-right">Monto</th>
                    <th className="py-2 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((movement) => {
                    const isIncome = movement.type === "income";
                    const methodLabel = PAYMENT_OPTIONS.find((opt) => opt.value === movement.payment_method)?.label || movement.payment_method || "-";
                    return (
                      <tr key={movement.id} className="border-b border-slate-100 text-slate-700">
                        <td className="py-2">{movement.date ? new Date(movement.date).toLocaleString("es-BO") : "-"}</td>
                        <td className={`py-2 font-semibold ${isIncome ? "text-emerald-700" : "text-rose-700"}`}>
                          {isIncome ? "Ingreso" : "Egreso"}
                        </td>
                        <td className="py-2">{methodLabel}</td>
                        <td className="py-2">{movement.description || "-"}</td>
                        <td className={`py-2 text-right font-bold ${isIncome ? "text-emerald-700" : "text-rose-700"}`}>
                          {isIncome ? "+" : "-"}{formatBs(movement.amount)}
                        </td>
                        <td className="py-2 text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              type="button"
                              onClick={() => openEditModal(movement)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-blue-100 text-blue-600 hover:bg-blue-200"
                              title="Editar movimiento"
                            >
                              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z" />
                                <path d="M20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMovement(movement.id)}
                              disabled={deletingMovementId === movement.id}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Eliminar movimiento"
                            >
                              {deletingMovementId === movement.id ? (
                                <span className="text-xs">...</span>
                              ) : (
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
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

        {/* Modal de Edición */}
        {editingMovement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900">Editar movimiento</h2>
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-semibold text-slate-700">
                    Fecha
                    <input
                      type="date"
                      value={editFormData.date}
                      onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
                      required
                    />
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    Tipo
                    <select
                      value={editFormData.type}
                      onChange={(e) => setEditFormData({ ...editFormData, type: e.target.value })}
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
                    >
                      {TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    Método de pago
                    <select
                      value={editFormData.payment_method}
                      onChange={(e) => setEditFormData({ ...editFormData, payment_method: e.target.value })}
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
                    >
                      {PAYMENT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
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
                      value={editFormData.amount}
                      onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
                      className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
                      placeholder="0.00"
                      required
                    />
                  </label>
                </div>

                <label className="text-sm font-semibold text-slate-700">
                  Descripción
                  <input
                    type="text"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3"
                    placeholder="Detalle del movimiento"
                  />
                </label>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={savingEdit}
                      className="flex-1 rounded border-none px-4 py-2 text-sm font-black text-black shadow-md cursor-pointer bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                      className="flex-1 rounded border-none px-4 py-2 text-sm font-black text-white shadow-md cursor-pointer bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300"
                  >
                    {savingEdit ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
