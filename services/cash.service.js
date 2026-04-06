const ALLOWED_TYPES = new Set(["income", "expense"]);
const ALLOWED_METHODS = new Set(["cash", "qr", "card", "transfer", "other"]);

function parseAmount(value, fieldName = "amount") {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Invalid ${fieldName}: must be a number greater than 0`);
  }
  return Number(numeric.toFixed(2));
}

function normalizeDateInput(value, fieldName) {
  if (!value || typeof value !== "string") {
    throw new Error(`Missing ${fieldName}`);
  }

  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`Invalid ${fieldName}: expected YYYY-MM-DD`);
  }
  return trimmed;
}

function buildRange(startDate, endDate) {
  if (startDate > endDate) {
    throw new Error("start_date cannot be greater than end_date");
  }

  return {
    startISO: `${startDate}T00:00:00.000Z`,
    endISO: `${endDate}T23:59:59.999Z`,
  };
}

function methodTemplate() {
  return { cash: 0, qr: 0, card: 0, transfer: 0, other: 0 };
}

function normalizeSalePaymentMethod(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "efectivo" || raw === "cash") return "cash";
  if (raw === "qr") return "qr";
  if (raw === "tarjeta" || raw === "card") return "card";
  if (raw === "transferencia" || raw === "transfer") return "transfer";
  return "other";
}

function isAutoSaleIncomeMovement(row) {
  if (!row || row.type !== "income") return false;
  const description = String(row.description || "").toLowerCase();
  return description.includes("ingreso automatico por venta #");
}

function summarizeMovements(rows = []) {
  const incomeByMethod = methodTemplate();
  const expenseByMethod = methodTemplate();

  for (const row of rows) {
    const method = ALLOWED_METHODS.has(row.payment_method) ? row.payment_method : "other";
    const amount = Number(row.amount || 0);

    if (row.type === "income") {
      incomeByMethod[method] += amount;
    }
    if (row.type === "expense") {
      expenseByMethod[method] += amount;
    }
  }

  const totalIncome = Object.values(incomeByMethod).reduce((acc, val) => acc + val, 0);
  const totalExpense = Object.values(expenseByMethod).reduce((acc, val) => acc + val, 0);
  const net = totalIncome - totalExpense;

  return {
    incomeByMethod,
    expenseByMethod,
    totalIncome,
    totalExpense,
    net,
    cashIncome: incomeByMethod.cash,
    cashExpense: expenseByMethod.cash,
  };
}

export async function createCashMovement(supabase, payload) {
  const date = normalizeDateInput(payload?.date, "date");
  const type = String(payload?.type || "").toLowerCase();
  const paymentMethod = String(payload?.payment_method || "").toLowerCase();
  const amount = parseAmount(payload?.amount);
  const description = String(payload?.description || "").trim();
  const userId = payload?.user_id ? String(payload.user_id) : null;
  const cashboxId = payload?.cashbox_id ? String(payload.cashbox_id) : "main";

  if (!ALLOWED_TYPES.has(type)) {
    throw new Error("Invalid type: must be income or expense");
  }
  if (!ALLOWED_METHODS.has(paymentMethod)) {
    throw new Error("Invalid payment_method: must be cash, qr, card, transfer or other");
  }

  const row = {
    date: `${date}T12:00:00.000Z`,
    type,
    payment_method: paymentMethod,
    amount,
    description,
    user_id: userId,
    cashbox_id: cashboxId,
  };

  const { data, error } = await supabase
    .from("cash_movements")
    .insert(row)
    .select("id, date, type, payment_method, amount, description, user_id, cashbox_id")
    .single();

  if (error) {
    throw new Error(error.message || "Failed to create movement");
  }

  return data;
}

export async function getCashSummary(supabase, params) {
  const startDate = normalizeDateInput(params?.start_date, "start_date");
  const endDate = normalizeDateInput(params?.end_date, "end_date");
  const userId = params?.user_id ? String(params.user_id) : null;
  const cashboxId = params?.cashbox_id ? String(params.cashbox_id) : "main";
  const manualOpening = params?.opening_balance;
  const manualOpeningQr = params?.opening_qr;

  const { startISO, endISO } = buildRange(startDate, endDate);

  let movementQuery = supabase
    .from("cash_movements")
    .select("id, date, type, payment_method, amount, description, user_id, cashbox_id")
    .gte("date", startISO)
    .lte("date", endISO)
    .eq("cashbox_id", cashboxId)
    .order("date", { ascending: true });

  if (userId) {
    movementQuery = movementQuery.eq("user_id", userId);
  }

  const { data: movements, error: movementError } = await movementQuery;
  if (movementError) {
    throw new Error(movementError.message || "Failed to fetch movements");
  }

  // Movimientos automaticos por venta se excluyen para evitar doble conteo,
  // porque los ingresos principales se calculan directamente desde la tabla ventas.
  const movementRows = (movements || []).filter((row) => !isAutoSaleIncomeMovement(row));

  let salesQuery = supabase
    .from("ventas")
    .select("id, fecha, total, modo_pago")
    .gte("fecha", startISO)
    .lte("fecha", endISO)
    .order("fecha", { ascending: true });

  const { data: sales, error: salesError } = await salesQuery;
  if (salesError) {
    throw new Error(salesError.message || "Failed to fetch sales for cash summary");
  }

  const salesIncomeByMethod = methodTemplate();
  for (const sale of sales || []) {
    const method = normalizeSalePaymentMethod(sale?.modo_pago);
    const amount = Number(sale?.total || 0);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    salesIncomeByMethod[method] += amount;
  }

  const movementSummary = summarizeMovements(movementRows);

  const incomeByMethod = {
    cash: salesIncomeByMethod.cash + movementSummary.incomeByMethod.cash,
    qr: salesIncomeByMethod.qr + movementSummary.incomeByMethod.qr,
    card: salesIncomeByMethod.card + movementSummary.incomeByMethod.card,
    transfer: salesIncomeByMethod.transfer + movementSummary.incomeByMethod.transfer,
    other: salesIncomeByMethod.other + movementSummary.incomeByMethod.other,
  };

  const expenseByMethod = movementSummary.expenseByMethod;
  const totalIncome = Object.values(incomeByMethod).reduce((acc, val) => acc + val, 0);
  const totalExpense = Object.values(expenseByMethod).reduce((acc, val) => acc + val, 0);
  const net = totalIncome - totalExpense;

  let openingBalance = Number(manualOpening ?? NaN);
  let openingQr = Number(manualOpeningQr ?? NaN);
  if (!Number.isFinite(openingBalance)) {
    let closureQuery = supabase
      .from("cash_closures")
      .select("*")
      .eq("cashbox_id", cashboxId)
      .lte("end_date", startDate)
      .order("end_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (userId) {
      closureQuery = closureQuery.eq("user_id", userId);
    }

    const { data: lastClosures, error: closureError } = await closureQuery;
    if (closureError) {
      throw new Error(closureError.message || "Failed to fetch last closure");
    }

    openingBalance = Number(lastClosures?.[0]?.expected_cash || 0);
    if (!Number.isFinite(openingQr)) {
      openingQr = Number(lastClosures?.[0]?.expected_qr || 0);
    }
  }

  if (!Number.isFinite(openingQr)) {
    openingQr = 0;
  }

  const expectedCash = Number((openingBalance + incomeByMethod.cash - expenseByMethod.cash).toFixed(2));
  const expectedQr = Number((openingQr + incomeByMethod.qr - expenseByMethod.qr).toFixed(2));
  const incomeBank = Number((incomeByMethod.qr + incomeByMethod.card + incomeByMethod.transfer).toFixed(2));

  return {
    range: {
      start_date: startDate,
      end_date: endDate,
      cashbox_id: cashboxId,
      user_id: userId,
    },
    opening_balance: Number(openingBalance.toFixed(2)),
    opening_qr: Number(openingQr.toFixed(2)),
    income_by_method: {
      cash: Number(incomeByMethod.cash.toFixed(2)),
      qr: Number(incomeByMethod.qr.toFixed(2)),
      card: Number(incomeByMethod.card.toFixed(2)),
      transfer: Number(incomeByMethod.transfer.toFixed(2)),
      other: Number(incomeByMethod.other.toFixed(2)),
    },
    expense_by_method: {
      cash: Number(expenseByMethod.cash.toFixed(2)),
      qr: Number(expenseByMethod.qr.toFixed(2)),
      card: Number(expenseByMethod.card.toFixed(2)),
      transfer: Number(expenseByMethod.transfer.toFixed(2)),
      other: Number(expenseByMethod.other.toFixed(2)),
    },
    totals: {
      income: Number(totalIncome.toFixed(2)),
      expense: Number(totalExpense.toFixed(2)),
      net: Number(net.toFixed(2)),
    },
    income_bank: incomeBank,
    expected_cash: expectedCash,
    expected_qr: expectedQr,
    movements: movementRows,
    sales: sales || [],
  };
}

export async function listCashMovements(supabase, params = {}) {
  const limitRaw = Number(params?.limit || 200);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 200;
  const userId = params?.user_id ? String(params.user_id) : null;
  const cashboxId = params?.cashbox_id ? String(params.cashbox_id) : "main";

  let query = supabase
    .from("cash_movements")
    .select("id, date, type, payment_method, amount, description, user_id, cashbox_id, created_at")
    .eq("cashbox_id", cashboxId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const hasStart = Boolean(params?.start_date);
  const hasEnd = Boolean(params?.end_date);
  if (hasStart || hasEnd) {
    const startDate = normalizeDateInput(params?.start_date || params?.end_date, "start_date");
    const endDate = normalizeDateInput(params?.end_date || params?.start_date, "end_date");
    const { startISO, endISO } = buildRange(startDate, endDate);
    query = query.gte("date", startISO).lte("date", endISO);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "Failed to fetch cash movements");
  }

  return data || [];
}

export async function deleteCashMovement(supabase, movementId) {
  if (!movementId) {
    throw new Error("Movement ID is required");
  }

  const { error } = await supabase
    .from("cash_movements")
    .delete()
    .eq("id", movementId);

  if (error) {
    throw new Error(error.message || "Failed to delete cash movement");
  }

  return { success: true };
}

export async function createCashClosure(supabase, payload) {
  const startDate = normalizeDateInput(payload?.start_date, "start_date");
  const endDate = normalizeDateInput(payload?.end_date, "end_date");
  const userId = payload?.user_id ? String(payload.user_id) : null;
  const cashboxId = payload?.cashbox_id ? String(payload.cashbox_id) : "main";

  const summary = await getCashSummary(supabase, {
    start_date: startDate,
    end_date: endDate,
    user_id: userId,
    cashbox_id: cashboxId,
    opening_balance: payload?.opening_balance,
    opening_qr: payload?.opening_qr,
  });

  const openingBalance = Number(summary.opening_balance);
  const openingQr = Number(summary.opening_qr || 0);
  const realCash = parseAmount(payload?.real_cash, "real_cash");
  const realQrRaw = payload?.real_qr;
  const realQr = realQrRaw === undefined || realQrRaw === null || realQrRaw === ""
    ? Number(summary.expected_qr || 0)
    : parseAmount(realQrRaw, "real_qr");
  const expectedCash = Number(summary.expected_cash);
  const expectedQr = Number(summary.expected_qr || 0);
  const difference = Number((realCash - expectedCash).toFixed(2));
  const qrDifference = Number((realQr - expectedQr).toFixed(2));

  let existingQuery = supabase
    .from("cash_closures")
    .select("id")
    .eq("start_date", startDate)
    .eq("end_date", endDate)
    .eq("cashbox_id", cashboxId)
    .limit(1);

  if (userId) {
    existingQuery = existingQuery.eq("user_id", userId);
  }

  const { data: existing, error: existingError } = await existingQuery;
  if (existingError) {
    throw new Error(existingError.message || "Failed to validate existing closure");
  }

  if (existing?.length) {
    const conflictError = new Error("A closure for this range already exists");
    conflictError.statusCode = 409;
    throw conflictError;
  }

  const closureRow = {
    start_date: startDate,
    end_date: endDate,
    opening_balance: openingBalance,
    opening_qr: openingQr,
    expected_cash: expectedCash,
    expected_qr: expectedQr,
    real_cash: realCash,
    real_qr: realQr,
    difference,
    qr_difference: qrDifference,
    user_id: userId,
    cashbox_id: cashboxId,
  };

  let closure = null;
  let insertError = null;

  const withQr = await supabase
    .from("cash_closures")
    .insert(closureRow)
    .select("*")
    .single();

  closure = withQr.data;
  insertError = withQr.error;

  if (insertError) {
    const message = String(insertError.message || "").toLowerCase();
    const missingQrColumn = message.includes("opening_qr")
      || message.includes("expected_qr")
      || message.includes("real_qr")
      || message.includes("qr_difference");

    if (missingQrColumn) {
      const fallbackRow = {
        start_date: startDate,
        end_date: endDate,
        opening_balance: openingBalance,
        expected_cash: expectedCash,
        real_cash: realCash,
        difference,
        user_id: userId,
        cashbox_id: cashboxId,
      };

      const fallbackInsert = await supabase
        .from("cash_closures")
        .insert(fallbackRow)
        .select("*")
        .single();

      closure = fallbackInsert.data;
      insertError = fallbackInsert.error;
    }
  }

  if (insertError) {
    const message = insertError.message || "Failed to create closure";
    const isConflict = message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique");
    const dbError = new Error(message);
    dbError.statusCode = isConflict ? 409 : 500;
    throw dbError;
  }

  return {
    closure,
    summary,
  };
}

export async function listCashClosures(supabase, params) {
  const limitRaw = Number(params?.limit || 50);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  const userId = params?.user_id ? String(params.user_id) : null;
  const cashboxId = params?.cashbox_id ? String(params.cashbox_id) : "main";

  let query = supabase
    .from("cash_closures")
    .select("*")
    .eq("cashbox_id", cashboxId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "Failed to fetch closures");
  }

  return data || [];
}
