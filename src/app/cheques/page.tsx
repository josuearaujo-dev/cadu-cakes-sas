"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarRange } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AnimatedSection } from "@/components/animated-section";
import { BrandedFullPageLoader } from "@/components/branded-full-page-loader";
import { Sidebar } from "@/components/sidebar";
import { StatCard } from "@/components/stat-card";
import { Topbar } from "@/components/topbar";
import { parseMoneyInput, sanitizeMoneyDraft } from "@/lib/amount-input";
import { formatCurrency } from "@/lib/format-currency";
import type { ChequeStatus, Supplier } from "@/lib/finance/types";
import { createClient } from "@/lib/supabase/client";
import { financeRepository } from "@/lib/supabase/finance-repository";

type ChequeRow = {
  id: string;
  cheque_date: string;
  supplier_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  transaction_id: string | null;
  amount: number;
  status: ChequeStatus;
  notes: string | null;
};

/** Exibe o fornecedor (novo) ou texto legado. */
function chequeFornecedorLabel(row: ChequeRow, supplierNameById: Map<string, string>) {
  if (row.supplier_id && supplierNameById.has(row.supplier_id)) {
    return supplierNameById.get(row.supplier_id)!;
  }
  return row.customer_name ?? "—";
}

const DAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const CHEQUE_STATUS_OPTIONS: { value: ChequeStatus; label: string }[] = [
  { value: "scheduled", label: "Agendado" },
  { value: "compensated", label: "Compensado" },
  { value: "returned", label: "Devolvido" },
  { value: "cancelled", label: "Cancelado" },
];

function statusLabel(s: ChequeStatus) {
  return CHEQUE_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;
}

type ConfirmModalState =
  | { kind: "single"; chequeId: string; fornecedor: string; from: ChequeStatus; to: ChequeStatus }
  | { kind: "bulk"; ids: string[]; totalValor: number }
  | null;

function toISODate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getMonthBounds(baseDate: Date) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  return { start, end };
}

function weekStartSunday(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() - date.getDay());
  return toISODate(date);
}

function getWeekRangesForMonth(baseDate: Date) {
  const { start: monthStart, end: monthEnd } = getMonthBounds(baseDate);
  const firstSunday = new Date(monthStart);
  firstSunday.setDate(monthStart.getDate() - monthStart.getDay());

  const weeks: { id: string; label: string; from: string; to: string }[] = [];
  const cursor = new Date(firstSunday);
  while (cursor <= monthEnd) {
    const start = new Date(cursor);
    const end = new Date(cursor);
    end.setDate(start.getDate() + 6);
    const from = toISODate(start);
    const to = toISODate(end);
    const label = `${start.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} - ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
    weeks.push({ id: `${from}_${to}`, label, from, to });
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

/** Data de hoje no fuso local (YYYY-MM-DD), alinhada ao calendário do usuário. */
function todayLocalISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Semana inicial: a que contém hoje, se o mês exibido for o do dia atual; senão a primeira semana do mês. */
function getDefaultWeekId(
  weekRanges: { id: string; from: string; to: string }[],
  monthDate: Date,
) {
  if (weekRanges.length === 0) return "";
  const today = todayLocalISODate();
  const { start, end } = getMonthBounds(monthDate);
  const monthStart = toISODate(start);
  const monthEnd = toISODate(end);
  if (today >= monthStart && today <= monthEnd) {
    const found = weekRanges.find((w) => today >= w.from && today <= w.to);
    if (found) return found.id;
  }
  return weekRanges[0].id;
}

export default function ChequesPage() {
  const router = useRouter();
  const [monthOffset, setMonthOffset] = useState(0);
  const [weeklyLimit, setWeeklyLimit] = useState(5);
  const [currency, setCurrency] = useState("USD");
  const [cheques, setCheques] = useState<ChequeRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedWeekId, setSelectedWeekId] = useState<string>("");
  const [chequeDate, setChequeDate] = useState(toISODate(new Date()));
  const [supplierId, setSupplierId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [status, setStatus] = useState<ChequeStatus>("scheduled");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingChequeId, setUpdatingChequeId] = useState<string | null>(null);
  const [compensatingBulk, setCompensatingBulk] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(null);
  const [showNewChequeModal, setShowNewChequeModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [draftMonthOffset, setDraftMonthOffset] = useState(0);

  const monthDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const weekRanges = useMemo(() => getWeekRangesForMonth(monthDate), [monthDate]);

  const supplierNameById = useMemo(() => {
    const m = new Map<string, string>();
    suppliers.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [suppliers]);

  const loadCheques = useCallback(async () => {
    try {
      setError(null);
      const supabase = createClient();
      const { start, end } = getMonthBounds(monthDate);
      const [settings, chequesData, supplierData] = await Promise.all([
        financeRepository.getCompanySettings(supabase),
        financeRepository.listCheques(supabase, toISODate(start), toISODate(end)),
        financeRepository.listSuppliers(supabase),
      ]);
      setWeeklyLimit(settings.weekly_cheque_limit ?? 5);
      setCurrency(String(settings.currency ?? "USD"));
      setCheques(chequesData as unknown as ChequeRow[]);
      setSuppliers(supplierData.filter((s) => s.active));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao carregar cheques.";
      if (message.includes("Empresa não encontrada")) {
        router.push("/onboarding");
        return;
      }
      setError(message);
    } finally {
      setPageReady((done) => done || true);
    }
  }, [monthDate, router]);

  useEffect(() => {
    void loadCheques();
  }, [loadCheques]);

  useEffect(() => {
    if (suppliers.length === 0) {
      setSupplierId("");
      return;
    }
    setSupplierId((prev) =>
      prev && suppliers.some((s) => s.id === prev) ? prev : suppliers[0].id,
    );
  }, [suppliers]);

  useEffect(() => {
    if (weekRanges.length === 0) return;
    const defaultId = getDefaultWeekId(weekRanges, monthDate);
    if (!selectedWeekId) {
      setSelectedWeekId(defaultId);
      return;
    }
    if (!weekRanges.some((item) => item.id === selectedWeekId)) {
      setSelectedWeekId(defaultId);
    }
  }, [selectedWeekId, weekRanges, monthDate]);

  const weeklyChecks = useMemo(() => {
    return weekRanges.map((week) => {
      const items = cheques.filter((item) => item.cheque_date >= week.from && item.cheque_date <= week.to);
      return {
        id: week.id,
        label: week.label,
        limite: weeklyLimit,
        usados: items.filter((item) => item.status !== "cancelled").length,
        cheques: items,
      };
    });
  }, [cheques, weekRanges, weeklyLimit]);

  const selectedWeek = useMemo(
    () => weeklyChecks.find((item) => item.id === selectedWeekId) ?? weeklyChecks[0],
    [selectedWeekId, weeklyChecks],
  );
  const selectedWeekData = useMemo(
    () =>
      selectedWeek ?? {
        id: "",
        label: "Sem semana selecionada",
        limite: weeklyLimit,
        usados: 0,
        cheques: [] as ChequeRow[],
      },
    [selectedWeek, weeklyLimit],
  );

  const totalSemana = useMemo(
    () =>
      selectedWeekData.cheques
        .filter((c) => c.status !== "cancelled")
        .reduce((acc, cheque) => acc + Number(cheque.amount), 0),
    [selectedWeekData],
  );

  const disponiveisSemana = Math.max(selectedWeekData.limite - selectedWeekData.usados, 0);

  /** Apenas agendados podem ir para “Compensar todos” em lote. */
  const pendientesCompensar = useMemo(
    () => selectedWeekData.cheques.filter((c) => c.status === "scheduled"),
    [selectedWeekData.cheques],
  );

  function openNewChequeModal() {
    setError(null);
    setChequeDate(todayLocalISODate());
    setAmountInput("");
    setStatus("scheduled");
    setNotes("");
    setShowNewChequeModal(true);
  }

  function openFilterModal() {
    setDraftMonthOffset(monthOffset);
    setShowFilterModal(true);
  }

  function applyMonthFilter() {
    setMonthOffset(draftMonthOffset);
    setShowFilterModal(false);
  }

  async function handleCreateCheque(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!supplierId) throw new Error("Cadastre um fornecedor em Cadastros ou selecione um fornecedor.");
      const amountValue = parseMoneyInput(amountInput);
      if (amountValue === null || amountValue <= 0) {
        throw new Error("Valor do cheque precisa ser maior que zero.");
      }

      const supabase = createClient();
      await financeRepository.createCheque(supabase, {
        cheque_date: chequeDate,
        supplier_id: supplierId,
        customer_id: null,
        customer_name: null,
        transaction_id: null,
        amount: amountValue,
        status,
        notes: notes.trim() || null,
      });
      setShowNewChequeModal(false);
      setAmountInput("");
      setStatus("scheduled");
      setNotes("");
      await loadCheques();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao registrar cheque.");
    } finally {
      setLoading(false);
    }
  }

  async function applyChequeStatusChange(chequeId: string, newStatus: ChequeStatus) {
    setUpdatingChequeId(chequeId);
    setError(null);
    try {
      const supabase = createClient();
      await financeRepository.setChequeStatus(supabase, chequeId, newStatus);
      await loadCheques();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar o status do cheque.");
    } finally {
      setUpdatingChequeId(null);
    }
  }

  function requestStatusChange(
    cheque: ChequeRow,
    next: ChequeStatus,
    fornecedorLabel: string,
  ) {
    if (next === cheque.status) return;
    setConfirmModal({
      kind: "single",
      chequeId: cheque.id,
      fornecedor: fornecedorLabel,
      from: cheque.status,
      to: next,
    });
  }

  function confirmSingleStatus() {
    if (!confirmModal || confirmModal.kind !== "single") return;
    const { chequeId, to } = confirmModal;
    setConfirmModal(null);
    void applyChequeStatusChange(chequeId, to);
  }

  async function confirmBulkCompensate() {
    if (!confirmModal || confirmModal.kind !== "bulk") return;
    const ids = [...confirmModal.ids];
    setConfirmModal(null);
    setCompensatingBulk(true);
    setError(null);
    try {
      const supabase = createClient();
      for (const id of ids) {
        await financeRepository.setChequeStatus(supabase, id, "compensated");
      }
      await loadCheques();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao compensar cheques em lote.");
    } finally {
      setCompensatingBulk(false);
    }
  }

  const selectDisabled = updatingChequeId !== null || compensatingBulk;

  const parsedChequeAmount = useMemo(() => parseMoneyInput(amountInput), [amountInput]);
  const chequeAmountValid = parsedChequeAmount !== null && parsedChequeAmount > 0;

  const resumoMes = useMemo(() => {
    const totalAtivos = cheques
      .filter((c) => c.status !== "cancelled")
      .reduce((acc, c) => acc + Number(c.amount), 0);
    const compensados = cheques
      .filter((c) => c.status === "compensated")
      .reduce((acc, c) => acc + Number(c.amount), 0);
    const pendentes = cheques
      .filter((c) => c.status === "scheduled")
      .reduce((acc, c) => acc + Number(c.amount), 0);
    const nAtivos = cheques.filter((c) => c.status !== "cancelled").length;
    return { totalAtivos, compensados, pendentes, nAtivos };
  }, [cheques]);

  const mesTitulo = useMemo(
    () =>
      monthDate.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
      }),
    [monthDate],
  );

  if (!pageReady) {
    return <BrandedFullPageLoader />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar title="Gestão de Cheques" subtitle="Limite semanal e prevenção de bloqueios no banco" />
        <AnimatedSection className="grid-4">
          <StatCard label="Limite semanal" value={String(selectedWeekData.limite)} hint="Definido nos dados da empresa" />
          <StatCard
            label="Usados na semana"
            value={String(selectedWeekData.usados)}
            hint={
              `${Math.round((selectedWeekData.usados / Math.max(selectedWeekData.limite, 1)) * 100)}% do limite`
            }
            danger={selectedWeekData.usados / Math.max(selectedWeekData.limite, 1) >= 0.8}
          />
          <StatCard label="Disponíveis" value={String(disponiveisSemana)} hint="Cheques não cancelados nesta semana" />
          <StatCard
            label="Total da semana"
            value={formatCurrency(totalSemana, currency)}
            hint={`${selectedWeekData.label} · soma pela data do cheque (cancelados não entram no valor)`}
          />
        </AnimatedSection>

        <section className="card glass lancamentos-actions" style={{ marginBottom: 14 }}>
          <button type="button" className="button-primary-action" onClick={openNewChequeModal}>
            + Novo cheque
          </button>
          <button type="button" className="button-secondary-action" onClick={openFilterModal}>
            Filtros
          </button>
        </section>

        {error && !showNewChequeModal && !showFilterModal ? <p className="hint danger">{error}</p> : null}

        <AnimatedSection className="card glass cheques-resumo-card" delay={0.04}>
          <h3 style={{ margin: "0 0 4px", fontSize: "1.14rem", color: "var(--brown)" }}>Resumo do mês</h3>
          <p className="cheques-resumo-period">{mesTitulo}</p>
          <div className="cheques-resumo-grid">
            <div className="cheques-resumo-tile cheques-resumo-tile--accent">
              <span className="cheques-resumo-tile__label">Total ativo</span>
              <span className="cheques-resumo-tile__value">{formatCurrency(resumoMes.totalAtivos, currency)}</span>
            </div>
            <div className="cheques-resumo-tile">
              <span className="cheques-resumo-tile__label">Compensados</span>
              <span className="cheques-resumo-tile__value">{formatCurrency(resumoMes.compensados, currency)}</span>
            </div>
            <div className="cheques-resumo-tile">
              <span className="cheques-resumo-tile__label">Pendentes / agendados</span>
              <span className="cheques-resumo-tile__value">{formatCurrency(resumoMes.pendentes, currency)}</span>
            </div>
            <div className="cheques-resumo-tile cheques-resumo-tile--quiet">
              <span className="cheques-resumo-tile__label">Cheques no mês</span>
              <span className="cheques-resumo-tile__value">{String(resumoMes.nAtivos)}</span>
            </div>
          </div>
        </AnimatedSection>
        <AnimatedSection className="card glass cheques-cronograma-card" delay={0.08}>
          <div className="cheques-header-row">
            <h3>Cronograma de compensação</h3>
            <div className="cheques-controls">
              <button type="button" className="month-nav" onClick={() => setMonthOffset((v) => v - 1)}>
                {"<"}
              </button>
              <span className="hint">{monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
              <button type="button" className="month-nav" onClick={() => setMonthOffset((v) => v + 1)}>
                {">"}
              </button>
            </div>
          </div>

          <div className="week-strip weekly">
                {weeklyChecks.map((week) => {
                  const total = week.cheques
                    .filter((item) => item.status !== "cancelled")
                    .reduce((acc, item) => acc + Number(item.amount), 0);
                  return (
                    <motion.button
                      key={week.id}
                      type="button"
                      className={`week-day-card ${selectedWeekId === week.id ? "active" : ""}`}
                      onClick={() => setSelectedWeekId(week.id)}
                      whileHover={{ y: -3, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.18 }}
                    >
                      <strong>Semana {week.label}</strong>
                      <span className="week-day-card__usage">
                        {week.usados}/{week.limite} cheques usados
                      </span>
                      <span className="week-day-card__amount">{formatCurrency(total, currency)}</span>
                    </motion.button>
                  );
                })}
          </div>
          <div className="card table-card cheques-week-details">
                <div className="cheques-header-row" style={{ alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--brown)" }}>
                      Detalhes da semana
                    </h3>
                    <p className="hint" style={{ margin: "6px 0 0", fontSize: "0.88rem" }}>
                      {selectedWeekData.label}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="button-secondary-action"
                    disabled={pendientesCompensar.length === 0 || selectDisabled}
                    onClick={() =>
                      setConfirmModal({
                        kind: "bulk",
                        ids: pendientesCompensar.map((c) => c.id),
                        totalValor: pendientesCompensar.reduce((acc, c) => acc + Number(c.amount), 0),
                      })
                    }
                  >
                    Compensar todos da semana ({pendientesCompensar.length})
                  </button>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Dia da semana</th>
                      <th>Fornecedor</th>
                      <th>Valor</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedWeekData.cheques.length > 0 ? (
                      selectedWeekData.cheques.map((cheque) => (
                        <tr key={cheque.id}>
                          <td>{DAY_LABELS[new Date(`${cheque.cheque_date}T00:00:00`).getDay()]}</td>
                          <td>{chequeFornecedorLabel(cheque, supplierNameById)}</td>
                          <td>{formatCurrency(Number(cheque.amount), currency)}</td>
                          <td>
                            <select
                              className="cheques-status-select"
                              value={cheque.status}
                              disabled={selectDisabled || updatingChequeId === cheque.id}
                              onChange={(e) =>
                                requestStatusChange(
                                  cheque,
                                  e.target.value as ChequeStatus,
                                  chequeFornecedorLabel(cheque, supplierNameById),
                                )
                              }
                              aria-label="Status do cheque"
                            >
                              {CHEQUE_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ padding: 0, border: 0, verticalAlign: "top" }}>
                          <div className="cheques-empty-state">
                            <CalendarRange size={42} strokeWidth={1.35} aria-hidden />
                            <p>
                              <strong style={{ color: "var(--brown)" }}>Nenhum cheque nesta semana</strong>
                            </p>
                            <p className="hint">
                              Escolha outro intervalo no cronograma ou registe um novo cheque com data dentro desta
                              semana.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
          </div>
        </AnimatedSection>

        {confirmModal?.kind === "single" ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-status-title">
            <section className="modal-card glass">
              <h3 id="confirm-status-title">Confirmar alteração de status?</h3>
              <p className="hint">
                <strong>Fornecedor:</strong> {confirmModal.fornecedor}
              </p>
              <p className="hint">
                Alterar de <strong>{statusLabel(confirmModal.from)}</strong> para{" "}
                <strong>{statusLabel(confirmModal.to)}</strong>.
              </p>
              {confirmModal.to === "compensated" ? (
                <p className="hint">Será gerado um lançamento no livro caixa (Lançamentos).</p>
              ) : null}
              {confirmModal.from === "compensated" && confirmModal.to !== "compensated" ? (
                <p className="hint">O lançamento vinculado será cancelado.</p>
              ) : null}
              <div className="modal-actions">
                <button type="button" className="button-cancel" onClick={() => setConfirmModal(null)}>
                  Cancelar
                </button>
                <button type="button" className="button-confirm" onClick={() => confirmSingleStatus()}>
                  Confirmar
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {confirmModal?.kind === "bulk" ? (
          <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-bulk-title">
            <section className="modal-card glass">
              <h3 id="confirm-bulk-title">Compensar todos os cheques da semana?</h3>
              <p className="hint">
                Serão marcados como <strong>Compensado</strong> <strong>{confirmModal.ids.length}</strong> cheque(s)
                com status <strong>Agendado</strong>.
              </p>
              <p className="hint">
                Total previsto: <strong>{formatCurrency(confirmModal.totalValor, currency)}</strong> — será
                gerado um lançamento para cada um.
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="button-cancel"
                  disabled={compensatingBulk}
                  onClick={() => setConfirmModal(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="button-confirm"
                  disabled={compensatingBulk}
                  onClick={() => void confirmBulkCompensate()}
                >
                  {compensatingBulk ? "Processando..." : "Confirmar e compensar todos"}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {showNewChequeModal ? (
          <div className="modal-overlay" onClick={() => !loading && setShowNewChequeModal(false)}>
            <section className="modal-card glass" onClick={(e) => e.stopPropagation()}>
              <h3>Novo cheque</h3>
              <form className="auth-form form-compact" onSubmit={handleCreateCheque}>
                <label>
                  Data do cheque
                  <input type="date" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} required />
                </label>
                <label>
                  Fornecedor (quem recebe o cheque)
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    required
                    disabled={suppliers.length === 0}
                  >
                    {suppliers.length === 0 ? (
                      <option value="">Nenhum fornecedor cadastrado</option>
                    ) : (
                      suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                {suppliers.length === 0 ? (
                  <p className="hint">
                    Cadastre fornecedores em{" "}
                    <Link href="/cadastros" className="status-pendente" style={{ fontWeight: 700 }}>
                      Cadastros & Config.
                    </Link>{" "}
                    (aba Fornecedores) para habilitar o lançamento.
                  </p>
                ) : null}
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
                  Status
                  <select value={status} onChange={(e) => setStatus(e.target.value as ChequeStatus)}>
                    <option value="scheduled">Agendado</option>
                    <option value="compensated">Compensado</option>
                    <option value="returned">Devolvido</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </label>
                <label>
                  Observações
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} />
                </label>
                <p className="hint">
                  O limite semanal é validado na base de dados. Ao marcar <strong>Compensado</strong>, é criada uma
                  despesa paga em <strong>Lançamentos</strong>; ao reverter o status, o lançamento vinculado é
                  cancelado.
                </p>
                <div className="modal-actions">
                  <button type="button" className="button-cancel" onClick={() => !loading && setShowNewChequeModal(false)}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="button-confirm"
                    disabled={
                      loading ||
                      !chequeAmountValid ||
                      suppliers.length === 0 ||
                      !supplierId ||
                      (selectedWeekData.id !== "" &&
                        weekStartSunday(chequeDate) === selectedWeekData.id.split("_")[0] &&
                        disponiveisSemana <= 0)
                    }
                  >
                    {loading ? "Salvando..." : "Registrar cheque"}
                  </button>
                </div>
              </form>
              {error ? <p className="hint danger">{error}</p> : null}
            </section>
          </div>
        ) : null}

        {showFilterModal ? (
          <div className="modal-overlay" onClick={() => setShowFilterModal(false)}>
            <section className="modal-card glass" onClick={(e) => e.stopPropagation()}>
              <h3>Filtros</h3>
              <p className="hint" style={{ marginBottom: 12 }}>
                Ajuste o <strong>mês</strong> dos dados carregados (cheques e resumo). Os botões &lt; &gt; no cronograma
                fazem o mesmo; aqui pode saltar vários meses de uma vez.
              </p>
              <div className="auth-form form-compact">
                <label>
                  Deslocamento em meses (0 = mês atual)
                  <input
                    type="number"
                    min={-60}
                    max={60}
                    value={draftMonthOffset}
                    onChange={(e) => setDraftMonthOffset(Number(e.target.value))}
                  />
                </label>
                <div className="modal-actions">
                  <button type="button" className="button-cancel" onClick={() => setShowFilterModal(false)}>
                    Fechar
                  </button>
                  <button type="button" className="button-secondary-action" onClick={() => setDraftMonthOffset(0)}>
                    Este mês
                  </button>
                  <button type="button" className="button-confirm" onClick={applyMonthFilter}>
                    Aplicar
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
