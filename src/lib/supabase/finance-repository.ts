import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseUserMessage } from "@/lib/supabase/error-message";
import type {
  Category,
  Cheque,
  ChequeStatus,
  Employee,
  EmployeePayment,
  EmployeePaymentStatus,
  FinancialTransaction,
  IncomeSource,
  Supplier,
  TransactionFilters,
} from "@/lib/finance/types";

type EntityInput<T> = Omit<T, "id" | "company_id" | "created_at" | "updated_at">;

type EmployeePaymentCreateInput = Omit<EntityInput<EmployeePayment>, "transaction_id">;

function todayLocalISODate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Tabela ainda não criada no projeto remoto (migração não aplicada) ou recurso inexistente no PostgREST. */
function isSchemaMissingError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache") ||
    msg.includes("not found") ||
    (msg.includes("relation") && msg.includes("does not exist"))
  );
}

/** Cache em memória (aba do browser): evita N consultas repetidas a `companies` no mesmo carregamento. */
let companyIdCache: { authUserId: string; companyId: string } | null = null;
/** Pedidos paralelos partilham a mesma Promise (1× getUser + 1× companies por “rajada”). */
let companyResolveInFlight: Promise<string> | null = null;

function isMissingHourlyRateColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const payload = error as { message?: unknown; details?: unknown; hint?: unknown };
  const text = [payload.message, payload.details, payload.hint]
    .filter((v) => typeof v === "string")
    .join(" ")
    .toLowerCase();
  return text.includes("hourly_rate") && (text.includes("column") || text.includes("schema cache"));
}

function normalizeEmployeeRow(row: Partial<Employee> & { weekly_salary?: number | null }): Employee {
  const numericHourlyRate = Number(row.hourly_rate ?? row.weekly_salary ?? 0);
  return {
    ...(row as Employee),
    hourly_rate: Number.isFinite(numericHourlyRate) ? numericHourlyRate : 0,
  };
}

export function clearFinanceCompanyIdCache() {
  companyIdCache = null;
  companyResolveInFlight = null;
}

async function resolveCompanyId(supabase: SupabaseClient): Promise<string> {
  if (companyResolveInFlight) {
    return companyResolveInFlight;
  }

  companyResolveInFlight = (async () => {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        companyIdCache = null;
        throw new Error("Sessão inválida. Faça login novamente.");
      }

      if (companyIdCache?.authUserId === user.id) {
        return companyIdCache.companyId;
      }

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (companyError) throw companyError;
      if (!company) throw new Error("Empresa não encontrada para este usuário.");

      companyIdCache = { authUserId: user.id, companyId: company.user_id };
      return company.user_id;
    } finally {
      companyResolveInFlight = null;
    }
  })();

  return companyResolveInFlight;
}

async function listByCompany<T>(supabase: SupabaseClient, table: string) {
  const companyId = await resolveCompanyId(supabase);
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as T[];
}

async function insertByCompany<T>(
  supabase: SupabaseClient,
  table: string,
  payload: EntityInput<T>,
) {
  const companyId = await resolveCompanyId(supabase);
  const { data, error } = await supabase
    .from(table)
    .insert({ ...payload, company_id: companyId })
    .select("*")
    .single();
  if (error) throw error;
  return data as T;
}

async function updateByCompanyRow<T>(
  supabase: SupabaseClient,
  table: string,
  id: string,
  patch: Record<string, unknown>,
) {
  const companyId = await resolveCompanyId(supabase);
  const { data, error } = await supabase
    .from(table)
    .update(patch)
    .eq("id", id)
    .eq("company_id", companyId)
    .select("*")
    .single();
  if (error) throw error;
  return data as T;
}

async function resolvePayrollExpenseCategory(supabase: SupabaseClient): Promise<Category> {
  const categories = await listByCompany<Category>(supabase, "categories");
  const cat =
    categories.find(
      (c) => c.type === "expense" && c.active && /folha|sal[aá]rio|funcion[aá]rio|pessoal/i.test(c.name),
    ) ??
    categories.find((c) => c.type === "expense" && c.active) ??
    categories.find((c) => c.type === "expense");
  if (!cat) {
    throw new Error("Cadastre ao menos uma categoria de despesa para gerar o lançamento automático da folha.");
  }
  return cat;
}

async function insertPayrollExpenseTransaction(
  supabase: SupabaseClient,
  payment: Pick<EmployeePayment, "employee_id" | "week_start" | "amount" | "payment_date">,
): Promise<FinancialTransaction> {
  const expenseCat = await resolvePayrollExpenseCategory(supabase);
  const txDate = payment.payment_date ?? todayLocalISODate();
  return insertByCompany<FinancialTransaction>(supabase, "transactions", {
    type: "expense",
    amount: Number(payment.amount),
    category_id: expenseCat.id,
    employee_id: payment.employee_id,
    supplier_id: null,
    income_source_id: null,
    payment_method: "transfer",
    status: "paid",
    transaction_date: txDate,
    due_date: null,
    paid_at: new Date().toISOString(),
    description: `Folha (semana referência ${payment.week_start})`,
  });
}

/**
 * Mantém `transactions` alinhado ao estado do pagamento de folha (como `setChequeStatus`).
 */
async function reconcileEmployeePaymentAfterWrite(
  supabase: SupabaseClient,
  before: EmployeePayment,
  after: EmployeePayment,
): Promise<EmployeePayment> {
  const companyId = await resolveCompanyId(supabase);
  let row = after;

  if (after.status !== "paid" && after.transaction_id) {
    await supabase
      .from("transactions")
      .update({ status: "cancelled" })
      .eq("id", after.transaction_id)
      .eq("company_id", companyId);
    row = await updateByCompanyRow<EmployeePayment>(supabase, "employee_payments", after.id, {
      transaction_id: null,
    });
    return row;
  }

  if (after.status === "paid") {
    if (!after.transaction_id) {
      const tx = await insertPayrollExpenseTransaction(supabase, after);
      row = await updateByCompanyRow<EmployeePayment>(supabase, "employee_payments", after.id, {
        transaction_id: tx.id,
      });
      return row;
    }
    const txNeedsUpdate =
      Number(before.amount) !== Number(after.amount) ||
      before.employee_id !== after.employee_id ||
      (before.payment_date ?? "") !== (after.payment_date ?? "");
    if (txNeedsUpdate) {
      await supabase
        .from("transactions")
        .update({
          amount: Number(after.amount),
          employee_id: after.employee_id,
          transaction_date: after.payment_date ?? todayLocalISODate(),
        })
        .eq("id", after.transaction_id)
        .eq("company_id", companyId);
    }
    return row;
  }

  return row;
}

async function deleteByCompanyRow(supabase: SupabaseClient, table: string, id: string) {
  const companyId = await resolveCompanyId(supabase);

  const { data: deletedRows, error: deleteError } = await supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("company_id", companyId)
    .select("id");

  if (deleteError) throw deleteError;

  if (Array.isArray(deletedRows) && deletedRows.length > 0) {
    return;
  }

  /** O corpo do DELETE pode vir vazio mesmo com sucesso (PostgREST/Prefer). Confirmamos com SELECT head. */
  const { count, error: countError } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("id", id)
    .eq("company_id", companyId);

  if (countError) throw countError;

  if (count === null) {
    throw new Error(
      "Não foi possível confirmar a eliminação na base de dados. Tente outra vez ou verifique a ligação.",
    );
  }

  if (count > 0) {
    throw new Error(
      "O registo não foi eliminado. No Supabase, aplique a migração que cria a política RLS de DELETE em employee_payments (ficheiro 20260415250000_employee_payments_delete_rls.sql) e volte a tentar.",
    );
  }
}

export { supabaseUserMessage } from "@/lib/supabase/error-message";

function isPostgresUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return String((error as { code?: unknown }).code) === "23505";
}

function isMissingDbColumnError(error: unknown, column: string): boolean {
  const text = supabaseUserMessage(error).toLowerCase();
  const col = column.toLowerCase();
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  if (code === "42703" && text.includes(col)) return true;
  if (text.includes("schema cache") && text.includes(col)) return true;
  if (text.includes("could not find") && text.includes(col)) return true;
  return false;
}

async function insertEmployeePaymentRow(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<EmployeePayment> {
  return insertByCompany<EmployeePayment>(
    supabase,
    "employee_payments",
    payload as unknown as EntityInput<EmployeePayment>,
  );
}

/** Mensagem amigável quando DELETE falha por FK (Postgres 23503). */
export function cadastroDeleteErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    String((error as { code: unknown }).code) === "23503"
  ) {
    return "Não é possível excluir: existem lançamentos, cheques, pagamentos de folha ou outros registos vinculados a este cadastro.";
  }
  if (error instanceof Error) return error.message;
  return "Não foi possível excluir o cadastro.";
}

export const financeRepository = {
  async getCompanySettings(supabase: SupabaseClient) {
    const companyId = await resolveCompanyId(supabase);
    const { data, error } = await supabase
      .from("companies")
      .select("currency, weekly_cheque_limit, start_of_week")
      .eq("user_id", companyId)
      .single();
    if (error) throw error;
    return data;
  },

  async listEmployees(supabase: SupabaseClient) {
    const companyId = await resolveCompanyId(supabase);
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) =>
      normalizeEmployeeRow(row as Partial<Employee> & { weekly_salary?: number | null }),
    );
  },
  async createEmployee(supabase: SupabaseClient, payload: EntityInput<Employee>) {
    try {
      return await insertByCompany<Employee>(supabase, "employees", payload);
    } catch (error) {
      if (!isMissingHourlyRateColumnError(error)) throw error;
      const companyId = await resolveCompanyId(supabase);
      const { data, error: fallbackError } = await supabase
        .from("employees")
        .insert({
          company_id: companyId,
          name: payload.name,
          role: payload.role,
          weekly_salary: payload.hourly_rate,
          active: payload.active,
        })
        .select("*")
        .single();
      if (fallbackError) throw fallbackError;
      return normalizeEmployeeRow(data as Partial<Employee> & { weekly_salary?: number | null });
    }
  },
  async updateEmployee(
    supabase: SupabaseClient,
    id: string,
    patch: Partial<Pick<Employee, "name" | "role" | "hourly_rate" | "active">>,
  ) {
    try {
      return await updateByCompanyRow<Employee>(supabase, "employees", id, patch as Record<string, unknown>);
    } catch (error) {
      if (!isMissingHourlyRateColumnError(error)) throw error;
      const fallbackPatch: Record<string, unknown> = { ...patch };
      if ("hourly_rate" in fallbackPatch) {
        fallbackPatch.weekly_salary = fallbackPatch.hourly_rate;
        delete fallbackPatch.hourly_rate;
      }
      const row = await updateByCompanyRow<Partial<Employee> & { weekly_salary?: number | null }>(
        supabase,
        "employees",
        id,
        fallbackPatch,
      );
      return normalizeEmployeeRow(row);
    }
  },
  deleteEmployee(supabase: SupabaseClient, id: string) {
    return deleteByCompanyRow(supabase, "employees", id);
  },

  /**
   * @param filter `string` — `week_start` exato (comportamento anterior).
   * Objeto com `intersectingDateRange` — semanas ou `payment_date` que intersectam [from, to] (menos dados que listar tudo).
   */
  async listEmployeePayments(
    supabase: SupabaseClient,
    filter?: string | { intersectingDateRange: { from: string; to: string } },
  ) {
    const companyId = await resolveCompanyId(supabase);
    const baseSelect = "*, employee:employees(id,name)";

    if (filter && typeof filter === "object" && filter.intersectingDateRange) {
      const { from, to } = filter.intersectingDateRange;
      const [byWeek, byPaid] = await Promise.all([
        supabase
          .from("employee_payments")
          .select(baseSelect)
          .eq("company_id", companyId)
          .gte("week_start", from)
          .lte("week_start", to)
          .order("week_start", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("employee_payments")
          .select(baseSelect)
          .eq("company_id", companyId)
          .not("payment_date", "is", null)
          .gte("payment_date", from)
          .lte("payment_date", to)
          .order("week_start", { ascending: false })
          .order("created_at", { ascending: false }),
      ]);
      if (byWeek.error) throw byWeek.error;
      if (byPaid.error) throw byPaid.error;
      const merged = new Map<string, EmployeePayment>();
      for (const row of [...(byWeek.data ?? []), ...(byPaid.data ?? [])]) {
        merged.set(row.id, row as EmployeePayment);
      }
      return [...merged.values()].sort(
        (a, b) => new Date(b.week_start).getTime() - new Date(a.week_start).getTime(),
      );
    }

    let query = supabase
      .from("employee_payments")
      .select(baseSelect)
      .eq("company_id", companyId)
      .order("week_start", { ascending: false })
      .order("created_at", { ascending: false });

    if (typeof filter === "string" && filter) {
      query = query.eq("week_start", filter);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as EmployeePayment[];
  },
  async createEmployeePayment(supabase: SupabaseClient, payload: EmployeePaymentCreateInput) {
    let toInsert = { ...payload };
    if (toInsert.status === "paid" && !toInsert.payment_date) {
      toInsert = { ...toInsert, payment_date: todayLocalISODate() };
    }
    let insertPayload: Record<string, unknown> = {
      employee_id: toInsert.employee_id,
      week_start: toInsert.week_start,
      amount: toInsert.amount,
      status: toInsert.status,
      payment_date: toInsert.payment_date,
      notes: toInsert.notes,
      hours_worked: toInsert.hours_worked,
      transaction_id: null,
    };

    let row: EmployeePayment | null = null;
    for (let attempt = 0; attempt < 6 && !row; attempt++) {
      try {
        row = await insertEmployeePaymentRow(supabase, insertPayload);
      } catch (e) {
        if (isPostgresUniqueViolation(e)) {
          throw new Error(
            "Já existe um pagamento de folha para este funcionário nesta semana de referência. Edite o existente ou escolha outra semana.",
          );
        }
        if (isMissingDbColumnError(e, "hours_worked")) {
          const { hours_worked: _h, ...rest } = insertPayload;
          insertPayload = rest;
          continue;
        }
        if (isMissingDbColumnError(e, "transaction_id")) {
          const { transaction_id: _t, ...rest } = insertPayload;
          insertPayload = rest;
          continue;
        }
        throw e;
      }
    }
    if (!row) {
      throw new Error("Não foi possível gravar o pagamento após várias tentativas. Verifique migrações e RLS no Supabase.");
    }

    if (row.status === "paid") {
      return reconcileEmployeePaymentAfterWrite(supabase, row, row);
    }
    return row;
  },
  async updateEmployeePayment(
    supabase: SupabaseClient,
    id: string,
    patch: Partial<
      Pick<
        EmployeePayment,
        "employee_id" | "week_start" | "hours_worked" | "amount" | "status" | "payment_date" | "notes"
      >
    >,
  ) {
    const companyId = await resolveCompanyId(supabase);
    const { data: before, error: fetchErr } = await supabase
      .from("employee_payments")
      .select("*")
      .eq("id", id)
      .eq("company_id", companyId)
      .single();
    if (fetchErr) throw fetchErr;
    if (!before) throw new Error("Pagamento de folha não encontrado.");

    const nextStatus = patch.status ?? (before.status as EmployeePaymentStatus);
    const nextPaymentDate =
      patch.payment_date !== undefined ? patch.payment_date : (before.payment_date as string | null);

    const effective: Record<string, unknown> = { ...patch };
    if (nextStatus === "paid" && !nextPaymentDate) {
      effective.payment_date = todayLocalISODate();
    }

    let after: EmployeePayment;
    try {
      after = await updateByCompanyRow<EmployeePayment>(supabase, "employee_payments", id, effective);
    } catch (e) {
      if (isMissingDbColumnError(e, "hours_worked") && "hours_worked" in effective) {
        const { hours_worked: _h, ...eff } = effective;
        after = await updateByCompanyRow<EmployeePayment>(supabase, "employee_payments", id, eff);
      } else {
        throw e;
      }
    }
    return reconcileEmployeePaymentAfterWrite(supabase, before as EmployeePayment, after);
  },
  async deleteEmployeePayment(supabase: SupabaseClient, id: string) {
    const companyId = await resolveCompanyId(supabase);
    const { data: row, error: fetchErr } = await supabase
      .from("employee_payments")
      .select("transaction_id")
      .eq("id", id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    const txId = row?.transaction_id as string | null | undefined;
    if (txId) {
      await supabase
        .from("transactions")
        .update({ status: "cancelled" })
        .eq("id", txId)
        .eq("company_id", companyId);
    }
    await deleteByCompanyRow(supabase, "employee_payments", id);
  },

  async listCheques(supabase: SupabaseClient, from?: string, to?: string) {
    const companyId = await resolveCompanyId(supabase);
    let query = supabase
      .from("cheques")
      .select("*")
      .eq("company_id", companyId)
      .order("cheque_date", { ascending: false });

    if (from) query = query.gte("cheque_date", from);
    if (to) query = query.lte("cheque_date", to);

    const { data, error } = await query;
    if (error) {
      if (isSchemaMissingError(error)) return [];
      throw error;
    }
    return (data ?? []) as Cheque[];
  },
  createCheque(supabase: SupabaseClient, payload: EntityInput<Cheque>) {
    return insertByCompany<Cheque>(supabase, "cheques", payload);
  },

  async updateCheque(
    supabase: SupabaseClient,
    id: string,
    patch: Partial<Pick<Cheque, "status" | "notes" | "transaction_id">>,
  ) {
    const companyId = await resolveCompanyId(supabase);
    const { data, error } = await supabase
      .from("cheques")
      .update(patch)
      .eq("id", id)
      .eq("company_id", companyId)
      .select("*")
      .single();
    if (error) throw error;
    return data as Cheque;
  },

  /**
   * Atualiza o status do cheque. Ao marcar **compensado**, cria despesa paga em `transactions`
   * (livro caixa) e grava `transaction_id`. Ao sair de compensado, cancela o lançamento vinculado.
   */
  async setChequeStatus(supabase: SupabaseClient, chequeId: string, newStatus: ChequeStatus) {
    const companyId = await resolveCompanyId(supabase);
    const { data: cheque, error: fetchErr } = await supabase
      .from("cheques")
      .select("*")
      .eq("id", chequeId)
      .eq("company_id", companyId)
      .single();
    if (fetchErr) throw fetchErr;
    if (!cheque) throw new Error("Cheque não encontrado.");

    const oldStatus = cheque.status as ChequeStatus;
    const linkedTxId = cheque.transaction_id as string | null;

    if (newStatus === "compensated") {
      if (linkedTxId) {
        const { data, error } = await supabase
          .from("cheques")
          .update({ status: newStatus })
          .eq("id", chequeId)
          .eq("company_id", companyId)
          .select("*")
          .single();
        if (error) throw error;
        return data as Cheque;
      }

      const categories = await listByCompany<Category>(supabase, "categories");
      const expenseCat =
        categories.find((c) => c.type === "expense" && c.active && /cheque/i.test(c.name)) ??
        categories.find((c) => c.type === "expense" && c.active) ??
        categories.find((c) => c.type === "expense");
      if (!expenseCat) {
        throw new Error("Cadastre ao menos uma categoria de despesa para gerar o lançamento automático.");
      }

      const txDate = todayLocalISODate();
      const tx = await insertByCompany<FinancialTransaction>(supabase, "transactions", {
        type: "expense",
        amount: Number(cheque.amount),
        category_id: expenseCat.id,
        employee_id: null,
        supplier_id: cheque.supplier_id,
        income_source_id: null,
        payment_method: "cheque",
        status: "paid",
        transaction_date: txDate,
        due_date: txDate,
        paid_at: new Date().toISOString(),
        description: `Cheque compensado (emissão ${cheque.cheque_date})`,
      });

      const { data: updated, error: upErr } = await supabase
        .from("cheques")
        .update({ status: newStatus, transaction_id: tx.id })
        .eq("id", chequeId)
        .eq("company_id", companyId)
        .select("*")
        .single();
      if (upErr) throw upErr;
      return updated as Cheque;
    }

    if (oldStatus === "compensated" && linkedTxId) {
      await supabase
        .from("transactions")
        .update({ status: "cancelled" })
        .eq("id", linkedTxId)
        .eq("company_id", companyId);

      const { data: updated, error: upErr } = await supabase
        .from("cheques")
        .update({ status: newStatus, transaction_id: null })
        .eq("id", chequeId)
        .eq("company_id", companyId)
        .select("*")
        .single();
      if (upErr) throw upErr;
      return updated as Cheque;
    }

    const { data: updated, error: upErr } = await supabase
      .from("cheques")
      .update({ status: newStatus })
      .eq("id", chequeId)
      .eq("company_id", companyId)
      .select("*")
      .single();
    if (upErr) throw upErr;
    return updated as Cheque;
  },

  listSuppliers(supabase: SupabaseClient) {
    return listByCompany<Supplier>(supabase, "suppliers");
  },
  createSupplier(supabase: SupabaseClient, payload: EntityInput<Supplier>) {
    return insertByCompany<Supplier>(supabase, "suppliers", payload);
  },
  updateSupplier(
    supabase: SupabaseClient,
    id: string,
    patch: Partial<Pick<Supplier, "name" | "contact_name" | "phone" | "notes" | "active">>,
  ) {
    return updateByCompanyRow<Supplier>(supabase, "suppliers", id, patch as Record<string, unknown>);
  },
  deleteSupplier(supabase: SupabaseClient, id: string) {
    return deleteByCompanyRow(supabase, "suppliers", id);
  },

  listIncomeSources(supabase: SupabaseClient) {
    return listByCompany<IncomeSource>(supabase, "income_sources");
  },
  createIncomeSource(supabase: SupabaseClient, payload: EntityInput<IncomeSource>) {
    return insertByCompany<IncomeSource>(supabase, "income_sources", payload);
  },
  updateIncomeSource(
    supabase: SupabaseClient,
    id: string,
    patch: Partial<Pick<IncomeSource, "name" | "description" | "active">>,
  ) {
    return updateByCompanyRow<IncomeSource>(supabase, "income_sources", id, patch as Record<string, unknown>);
  },
  deleteIncomeSource(supabase: SupabaseClient, id: string) {
    return deleteByCompanyRow(supabase, "income_sources", id);
  },

  listCategories(supabase: SupabaseClient) {
    return listByCompany<Category>(supabase, "categories");
  },
  createCategory(supabase: SupabaseClient, payload: EntityInput<Category>) {
    return insertByCompany<Category>(supabase, "categories", payload);
  },
  updateCategory(
    supabase: SupabaseClient,
    id: string,
    patch: Partial<Pick<Category, "name" | "type" | "active">>,
  ) {
    return updateByCompanyRow<Category>(supabase, "categories", id, patch as Record<string, unknown>);
  },
  deleteCategory(supabase: SupabaseClient, id: string) {
    return deleteByCompanyRow(supabase, "categories", id);
  },

  async listTransactions(supabase: SupabaseClient, filters: TransactionFilters = {}) {
    const companyId = await resolveCompanyId(supabase);
    let query = supabase
      .from("transactions")
      .select(
        "*, category:categories(id,name,type), employee:employees(id,name), supplier:suppliers(id,name), income_source:income_sources(id,name)",
      )
      .eq("company_id", companyId)
      .order("transaction_date", { ascending: false });

    if (filters.from) query = query.gte("transaction_date", filters.from);
    if (filters.to) query = query.lte("transaction_date", filters.to);
    if (filters.type) query = query.eq("type", filters.type);
    if (filters.status) query = query.eq("status", filters.status);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as FinancialTransaction[];
  },
  createTransaction(supabase: SupabaseClient, payload: EntityInput<FinancialTransaction>) {
    return insertByCompany<FinancialTransaction>(supabase, "transactions", payload);
  },

  async updateTransaction(
    supabase: SupabaseClient,
    id: string,
    patch: Partial<
      Pick<
        FinancialTransaction,
        | "type"
        | "amount"
        | "category_id"
        | "employee_id"
        | "supplier_id"
        | "income_source_id"
        | "payment_method"
        | "status"
        | "transaction_date"
        | "due_date"
        | "paid_at"
        | "description"
      >
    >,
  ) {
    const companyId = await resolveCompanyId(supabase);
    const { data, error } = await supabase
      .from("transactions")
      .update(patch)
      .eq("id", id)
      .eq("company_id", companyId)
      .select(
        "*, category:categories(id,name,type), employee:employees(id,name), supplier:suppliers(id,name), income_source:income_sources(id,name)",
      )
      .single();
    if (error) throw error;
    return data as FinancialTransaction;
  },
};
