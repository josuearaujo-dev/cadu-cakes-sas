"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BrandedFullPageLoader } from "@/components/branded-full-page-loader";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import type {
  Category,
  CategoryType,
  Employee,
  IncomeSource,
  PaymentMethod,
  Supplier,
  TransactionStatus,
} from "@/lib/finance/types";
import { moneyDraftFromNumber, parseMoneyInput, sanitizeMoneyDraft } from "@/lib/amount-input";
import { formatCurrency } from "@/lib/format-currency";
import { createClient } from "@/lib/supabase/client";
import { financeRepository } from "@/lib/supabase/finance-repository";

type TransactionView = {
  id: string;
  category_id: string;
  transaction_date: string;
  due_date: string | null;
  type: CategoryType;
  amount: number;
  payment_method: PaymentMethod;
  status: TransactionStatus;
  description: string | null;
  employee_id: string | null;
  supplier_id: string | null;
  income_source_id: string | null;
  category?: { id?: string; name?: string };
  supplier?: { name?: string };
  employee?: { name?: string };
  income_source?: { name?: string };
};

const STATUS_LABEL: Record<TransactionStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  cancelled: "Cancelado",
};

export default function LancamentosPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [transactions, setTransactions] = useState<TransactionView[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<CategoryType>("expense");
  const [amountInput, setAmountInput] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [incomeSourceId, setIncomeSourceId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("transfer");
  const [status, setStatus] = useState<TransactionStatus>("pending");
  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [description, setDescription] = useState("");

  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterType, setFilterType] = useState<"" | CategoryType>("");
  const [filterStatus, setFilterStatus] = useState<"" | TransactionStatus>("");
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [draftFilterFrom, setDraftFilterFrom] = useState("");
  const [draftFilterTo, setDraftFilterTo] = useState("");
  const [draftFilterType, setDraftFilterType] = useState<"" | CategoryType>("");
  const [draftFilterStatus, setDraftFilterStatus] = useState<"" | TransactionStatus>("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<TransactionView | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const filteredCategories = useMemo(
    () => categories.filter((item) => item.type === type),
    [categories, type],
  );
  const transactionsForTotals = useMemo(
    () => transactions.filter((item) => item.status !== "cancelled"),
    [transactions],
  );

  const totalEntradas = useMemo(
    () =>
      transactionsForTotals
        .filter((item) => item.type === "income")
        .reduce((acc, item) => acc + Number(item.amount), 0),
    [transactionsForTotals],
  );
  const totalDespesas = useMemo(
    () =>
      transactionsForTotals
        .filter((item) => item.type === "expense")
        .reduce((acc, item) => acc + Number(item.amount), 0),
    [transactionsForTotals],
  );
  const saldoFiltrado = totalEntradas - totalDespesas;
  const incomeBySource = useMemo(() => {
    const grouped = new Map<string, { label: string; total: number }>();
    transactionsForTotals
      .filter((item) => item.type === "income")
      .forEach((item) => {
        const sourceId = item.income_source_id ?? "__no_source__";
        const sourceLabel = item.income_source?.name?.trim() || "Sem fonte de entrada";
        const current = grouped.get(sourceId) ?? { label: sourceLabel, total: 0 };
        current.total += Number(item.amount);
        grouped.set(sourceId, current);
      });
    return Array.from(grouped.entries())
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.total - a.total);
  }, [transactionsForTotals]);

  const parsedLancamentoAmount = useMemo(() => parseMoneyInput(amountInput), [amountInput]);
  const lancamentoAmountValid = parsedLancamentoAmount !== null && parsedLancamentoAmount > 0;

  const loadReferences = useCallback(async () => {
    try {
      const supabase = createClient();
      const [settings, categoryData, employeeData, supplierData, incomeData] = await Promise.all([
        financeRepository.getCompanySettings(supabase),
        financeRepository.listCategories(supabase),
        financeRepository.listEmployees(supabase),
        financeRepository.listSuppliers(supabase),
        financeRepository.listIncomeSources(supabase),
      ]);
      setCurrency(String(settings.currency ?? "USD"));
      setCategories(categoryData);
      setEmployees(employeeData);
      setSuppliers(supplierData);
      setIncomeSources(incomeData);

      if (!categoryId && categoryData.length > 0) {
        const first = categoryData.find((item) => item.type === type);
        if (first) setCategoryId(first.id);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao carregar referências.";
      if (message.includes("Empresa não encontrada")) {
        router.push("/onboarding");
        return;
      }
      setError(message);
    }
  }, [categoryId, router, type]);

  const loadTransactions = useCallback(async () => {
    try {
      const supabase = createClient();
      const data = await financeRepository.listTransactions(supabase, {
        from: filterFrom || undefined,
        to: filterTo || undefined,
        type: filterType || undefined,
        status: filterStatus || undefined,
      });
      setTransactions(data as unknown as TransactionView[]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao carregar lançamentos.";
      if (message.includes("Empresa não encontrada")) {
        router.push("/onboarding");
        return;
      }
      setError(message);
    }
  }, [filterFrom, filterStatus, filterTo, filterType, router]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadReferences(), loadTransactions()]).finally(() => {
      if (!cancelled) setPageReady((done) => done || true);
    });
    return () => {
      cancelled = true;
    };
  }, [loadReferences, loadTransactions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");
    const to = params.get("to");
    if (from) {
      setFilterFrom(from);
      setDraftFilterFrom(from);
    }
    if (to) {
      setFilterTo(to);
      setDraftFilterTo(to);
    }
  }, []);

  useEffect(() => {
    const first = filteredCategories[0];
    if (first && !filteredCategories.some((item) => item.id === categoryId)) {
      setCategoryId(first.id);
    }
    if (!first) setCategoryId("");
  }, [filteredCategories, categoryId]);

  function openNewEntry() {
    setEditingId(null);
    setError(null);
    setType("expense");
    setAmountInput("");
    setEmployeeId("");
    setSupplierId("");
    setIncomeSourceId("");
    setPaymentMethod("transfer");
    setStatus("pending");
    setDescription("");
    setTransactionDate(new Date().toISOString().slice(0, 10));
    const first = categories.find((c) => c.type === "expense");
    setCategoryId(first?.id ?? "");
    setShowEntryModal(true);
  }

  function openEdit(item: TransactionView) {
    setEditingId(item.id);
    setError(null);
    setType(item.type);
    setAmountInput(moneyDraftFromNumber(Number(item.amount)));
    setCategoryId(item.category_id);
    setEmployeeId(item.employee_id ?? "");
    setSupplierId(item.supplier_id ?? "");
    setIncomeSourceId(item.income_source_id ?? "");
    setPaymentMethod(item.payment_method);
    setStatus(item.status);
    setTransactionDate(item.transaction_date);
    setDescription(item.description ?? "");
    setShowEntryModal(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!categoryId) throw new Error("Selecione uma categoria.");
      if (type === "income" && !incomeSourceId) {
        throw new Error("Transação de entrada exige fonte de entrada.");
      }
      const amountValue = parseMoneyInput(amountInput);
      if (amountValue === null || amountValue <= 0) {
        throw new Error("Informe um valor válido maior que zero.");
      }
      const supabase = createClient();
      const dueDateValue =
        paymentMethod === "cheque"
          ? transactionDate
          : status === "pending"
            ? transactionDate
            : null;

      const payload = {
        type,
        amount: amountValue,
        category_id: categoryId,
        employee_id: type === "expense" && employeeId ? employeeId : null,
        supplier_id: type === "expense" && supplierId ? supplierId : null,
        income_source_id: type === "income" ? incomeSourceId || null : null,
        payment_method: paymentMethod,
        status,
        transaction_date: transactionDate,
        due_date: dueDateValue,
        paid_at: status === "paid" ? new Date().toISOString() : null,
        description: description || null,
      };

      if (editingId) {
        await financeRepository.updateTransaction(supabase, editingId, payload);
      } else {
        await financeRepository.createTransaction(supabase, payload);
      }

      setAmountInput("");
      setEmployeeId("");
      setSupplierId("");
      setIncomeSourceId("");
      setPaymentMethod("transfer");
      setStatus("pending");
      setDescription("");
      setShowEntryModal(false);
      setEditingId(null);
      await loadTransactions();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : editingId ? "Erro ao salvar lançamento." : "Erro ao cadastrar lançamento.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmCancelTransaction() {
    if (!cancelTarget) return;
    setCancelling(true);
    setError(null);
    try {
      const supabase = createClient();
      await financeRepository.updateTransaction(supabase, cancelTarget.id, {
        status: "cancelled",
        paid_at: null,
      });
      setCancelTarget(null);
      await loadTransactions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao anular lançamento.");
    } finally {
      setCancelling(false);
    }
  }

  function openFilterModal() {
    setDraftFilterFrom(filterFrom);
    setDraftFilterTo(filterTo);
    setDraftFilterType(filterType);
    setDraftFilterStatus(filterStatus);
    setShowFilterModal(true);
  }

  function applyFilters() {
    setFilterFrom(draftFilterFrom);
    setFilterTo(draftFilterTo);
    setFilterType(draftFilterType);
    setFilterStatus(draftFilterStatus);
    setShowFilterModal(false);
  }

  function clearFilters() {
    setDraftFilterFrom("");
    setDraftFilterTo("");
    setDraftFilterType("");
    setDraftFilterStatus("");
    setFilterFrom("");
    setFilterTo("");
    setFilterType("");
    setFilterStatus("");
    setShowFilterModal(false);
  }

  if (!pageReady) {
    return <BrandedFullPageLoader />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar
          title="Lançamentos Financeiros"
          subtitle="Registro de entradas e despesas com filtros por período"
        />

        <section className="grid-4" style={{ marginBottom: 14 }}>
          <article className="card glass">
            <h3>Entradas (filtro atual)</h3>
            <p className="value">{formatCurrency(totalEntradas, currency)}</p>
          </article>
          <article className="card glass">
            <h3>Despesas (filtro atual)</h3>
            <p className="value">{formatCurrency(totalDespesas, currency)}</p>
          </article>
          <article className="card glass">
            <h3>Saldo</h3>
            <p className="value">{formatCurrency(saldoFiltrado, currency)}</p>
          </article>
          <article className="card glass">
            <h3>Qtd. lançamentos</h3>
            <p className="value">{transactionsForTotals.length}</p>
            <p className="hint" style={{ marginTop: 8, fontSize: "0.85rem" }}>
              Efetivos (exclui cancelados), alinhado aos totais.
            </p>
          </article>
        </section>

        <section className="card glass table-card" style={{ marginBottom: 14 }}>
          <h3>Entradas por fonte (filtro atual)</h3>
          {incomeBySource.length > 0 ? (
            <table className="table">
              <thead>
                <tr>
                  <th>Fonte de entrada</th>
                  <th className="table-num">Total</th>
                  <th className="table-num">% das entradas</th>
                </tr>
              </thead>
              <tbody>
                {incomeBySource.map((row) => {
                  const share = totalEntradas > 0 ? (row.total / totalEntradas) * 100 : 0;
                  return (
                    <tr key={row.id}>
                      <td>{row.label}</td>
                      <td className="table-num">{formatCurrency(row.total, currency)}</td>
                      <td className="table-num">{share.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="hint" style={{ marginTop: 8 }}>
              Nenhuma entrada encontrada no filtro atual.
            </p>
          )}
        </section>

        <section className="card glass lancamentos-actions" style={{ marginBottom: 14 }}>
          <button type="button" className="button-primary-action" onClick={openNewEntry}>
            + Novo lançamento
          </button>
          <button type="button" className="button-secondary-action" onClick={openFilterModal}>
            Filtros
          </button>
        </section>

        <section className="card glass table-card">
          <h3>Lançamentos registrados</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Categoria</th>
                <th>Valor</th>
                <th>Referência</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((item) => {
                const reference =
                  item.type === "income"
                    ? item.income_source?.name || "-"
                    : item.supplier?.name || item.employee?.name || "-";
                const isCancelled = item.status === "cancelled";
                return (
                  <tr key={item.id} style={isCancelled ? { opacity: 0.55 } : undefined}>
                    <td>{item.transaction_date}</td>
                    <td>{item.type === "income" ? "Entrada" : "Despesa"}</td>
                    <td>{item.category?.name || "-"}</td>
                    <td>{item.amount.toFixed(2)}</td>
                    <td>{reference}</td>
                    <td
                      className={
                        item.status === "paid"
                          ? "status-pago"
                          : item.status === "pending"
                            ? "status-pendente"
                            : ""
                      }
                    >
                      {STATUS_LABEL[item.status]}
                    </td>
                    <td>
                      {isCancelled ? (
                        <span className="hint">—</span>
                      ) : (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" className="button-secondary-action" onClick={() => openEdit(item)}>
                            Editar
                          </button>
                          <button
                            type="button"
                            className="button-secondary-action"
                            onClick={() => setCancelTarget(item)}
                            style={{ borderColor: "rgba(179, 36, 69, 0.35)", color: "#b32445" }}
                          >
                            Anular
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {showEntryModal ? (
          <div className="modal-overlay">
            <section className="modal-card glass">
              <h3>{editingId ? "Editar lançamento" : "Novo lançamento"}</h3>
              <p className="hint" style={{ marginBottom: 12 }}>
                <strong>Categoria</strong> e <strong>fonte de entrada</strong> vêm dos cadastros: podem ser poucos e
                genéricos (ex. despesas “Fornecedores” / “Folha”; entradas com fonte “Cartão” ou “Delivery”). O
                pormenor fica em <strong>descrição</strong>, fornecedor ou funcionário.
              </p>
              <form className="auth-form form-compact" onSubmit={handleSubmit}>
                <label>
                  Tipo
                  <select value={type} onChange={(e) => setType(e.target.value as CategoryType)}>
                    <option value="expense">Despesa</option>
                    <option value="income">Entrada</option>
                  </select>
                </label>
                <label>
                  Valor
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0,00"
                    value={amountInput}
                    onChange={(e) => setAmountInput(sanitizeMoneyDraft(e.target.value))}
                  />
                </label>
                <label>
                  Categoria
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                    {filteredCategories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Método de pagamento
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  >
                    <option value="cash">Dinheiro</option>
                    <option value="transfer">Transferência</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </label>
                <label>
                  Status
                  <select value={status} onChange={(e) => setStatus(e.target.value as TransactionStatus)}>
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </label>
                <label>
                  Data da transação
                  <input
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    required
                  />
                </label>
                {type === "expense" ? (
                  <>
                    <label>
                      Funcionário (opcional)
                      <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                        <option value="">Nenhum</option>
                        {employees.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Fornecedor (opcional)
                      <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                        <option value="">Nenhum</option>
                        {suppliers.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                ) : (
                  <label>
                    Fonte de entrada
                    <select
                      value={incomeSourceId}
                      onChange={(e) => setIncomeSourceId(e.target.value)}
                      required
                    >
                      <option value="">Selecione</option>
                      {incomeSources.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label>
                  Descrição
                  <input value={description} onChange={(e) => setDescription(e.target.value)} />
                </label>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="button-cancel"
                    onClick={() => {
                      setShowEntryModal(false);
                      setEditingId(null);
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="button-confirm"
                    disabled={loading || !lancamentoAmountValid}
                  >
                    {loading ? "Salvando..." : editingId ? "Salvar alterações" : "Incluir lançamento"}
                  </button>
                </div>
              </form>
              {error ? <p className="hint danger">{error}</p> : null}
            </section>
          </div>
        ) : null}

        {cancelTarget ? (
          <div className="modal-overlay" onClick={() => !cancelling && setCancelTarget(null)}>
            <section className="modal-card glass" onClick={(e) => e.stopPropagation()}>
              <h3>Anular lançamento?</h3>
              <p className="hint" style={{ marginBottom: 12 }}>
                O lançamento será marcado como <strong>cancelado</strong> e deixa de entrar nos totais. Esta ação pode ser
                revertida editando o lançamento e alterando o status.
              </p>
              <p className="hint" style={{ marginBottom: 16 }}>
                {cancelTarget.transaction_date} · {cancelTarget.category?.name ?? "—"} ·{" "}
                {Number(cancelTarget.amount).toFixed(2)}
              </p>
              <div className="modal-actions">
                <button type="button" className="button-cancel" onClick={() => setCancelTarget(null)} disabled={cancelling}>
                  Voltar
                </button>
                <button type="button" className="button-confirm" onClick={() => void confirmCancelTransaction()} disabled={cancelling}>
                  {cancelling ? "Anulando..." : "Confirmar anulação"}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {showFilterModal ? (
          <div className="modal-overlay" onClick={() => setShowFilterModal(false)}>
            <section className="modal-card glass" onClick={(e) => e.stopPropagation()}>
              <h3>Filtros de lançamentos</h3>
              <div className="auth-form form-compact">
                <label>
                  De
                  <input type="date" value={draftFilterFrom} onChange={(e) => setDraftFilterFrom(e.target.value)} />
                </label>
                <label>
                  Até
                  <input type="date" value={draftFilterTo} onChange={(e) => setDraftFilterTo(e.target.value)} />
                </label>
                <label>
                  Tipo
                  <select value={draftFilterType} onChange={(e) => setDraftFilterType(e.target.value as "" | CategoryType)}>
                    <option value="">Todos</option>
                    <option value="income">Entrada</option>
                    <option value="expense">Despesa</option>
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={draftFilterStatus}
                    onChange={(e) => setDraftFilterStatus(e.target.value as "" | TransactionStatus)}
                  >
                    <option value="">Todos</option>
                    <option value="pending">Pendente</option>
                    <option value="paid">Pago</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </label>
                <div className="modal-actions modal-actions--filters">
                  <button type="button" className="button-cancel" onClick={() => setShowFilterModal(false)}>
                    Fechar
                  </button>
                  <button type="button" className="button-secondary-action button-secondary-action--filters" onClick={clearFilters}>
                    Limpar filtros
                  </button>
                  <button type="button" className="button-confirm" onClick={applyFilters}>
                    Aplicar filtros
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
