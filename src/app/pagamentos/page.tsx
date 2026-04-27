"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";

import { AnimatedSection } from "@/components/animated-section";
import { BrandedFullPageLoader } from "@/components/branded-full-page-loader";
import { Sidebar } from "@/components/sidebar";
import { StatCard } from "@/components/stat-card";
import { Topbar } from "@/components/topbar";
import type { Employee, EmployeePaymentStatus } from "@/lib/finance/types";
import { moneyDraftFromNumber, parseMoneyInput, sanitizeMoneyDraft } from "@/lib/amount-input";
import { formatCurrency } from "@/lib/format-currency";
import type { CompanyStartOfWeek } from "@/lib/week-start";
import {
  getWeekStartContainingDate,
  parseLocalDate,
  toLocalISODate,
  weekStartLabel,
} from "@/lib/week-start";
import { createClient } from "@/lib/supabase/client";
import { supabaseUserMessage } from "@/lib/supabase/error-message";
import { cadastroDeleteErrorMessage, financeRepository } from "@/lib/supabase/finance-repository";

type EmployeePaymentRow = {
  id: string;
  employee_id: string;
  week_start: string;
  hours_worked: number | null;
  amount: number;
  status: EmployeePaymentStatus;
  payment_date: string | null;
  notes: string | null;
  employee?: { name?: string };
};

const STATUS_LABEL: Record<EmployeePaymentStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  cancelled: "Cancelado",
};

export default function PagamentosPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<EmployeePaymentRow[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [startOfWeek, setStartOfWeek] = useState<CompanyStartOfWeek>("sunday");
  const [weekStartFilter, setWeekStartFilter] = useState("");
  const [draftWeekStartFilter, setDraftWeekStartFilter] = useState("");
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [weekStart, setWeekStart] = useState(() =>
    toLocalISODate(getWeekStartContainingDate(new Date(), "sunday")),
  );
  const [hoursWorkedInput, setHoursWorkedInput] = useState("");
  const [status, setStatus] = useState<EmployeePaymentStatus>("pending");
  const [paymentDate, setPaymentDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [pageReady, setPageReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Evita repetir o preenchimento do valor quando só a lista `employees` é recarregada (mesmo funcionário). */
  const lastHourlyPrefillEmployeeId = useRef<string | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const [settings, employeeData, paymentData] = await Promise.all([
        financeRepository.getCompanySettings(supabase),
        financeRepository.listEmployees(supabase),
        financeRepository.listEmployeePayments(supabase, weekStartFilter || undefined),
      ]);
      setCurrency(String(settings.currency ?? "USD"));
      setStartOfWeek(settings.start_of_week === "monday" ? "monday" : "sunday");
      setEmployees(employeeData);
      setPayments(paymentData as unknown as EmployeePaymentRow[]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao carregar pagamentos.";
      if (message.includes("Empresa não encontrada")) {
        router.push("/onboarding");
        return;
      }
      setError(message);
    } finally {
      setPageReady((done) => done || true);
    }
  }, [router, weekStartFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (employees.length === 0) {
      setEmployeeId("");
      return;
    }
    setEmployeeId((prev) => (prev && employees.some((e) => e.id === prev) ? prev : employees[0].id));
  }, [employees]);

  /** Novo pagamento: evita re-preenchimento de horas ao recarregar lista de funcionários. */
  useEffect(() => {
    if (!showEntryModal || editingPaymentId || !employeeId) return;
    if (lastHourlyPrefillEmployeeId.current === employeeId) return;
    lastHourlyPrefillEmployeeId.current = employeeId;
    setHoursWorkedInput("");
  }, [showEntryModal, editingPaymentId, employeeId, employees]);

  function closeEntryModal() {
    if (loading) return;
    setError(null);
    lastHourlyPrefillEmployeeId.current = undefined;
    setShowEntryModal(false);
    setEditingPaymentId(null);
    setHoursWorkedInput("");
    setStatus("pending");
    setPaymentDate("");
    setNotes("");
  }

  function openNewPaymentModal() {
    setError(null);
    setEditingPaymentId(null);
    lastHourlyPrefillEmployeeId.current = undefined;
    setEmployeeId("");
    setWeekStart(toLocalISODate(getWeekStartContainingDate(new Date(), startOfWeek)));
    setHoursWorkedInput("");
    setStatus("pending");
    setPaymentDate("");
    setNotes("");
    setShowEntryModal(true);
  }

  function snapWeekStartToConfiguredWeek(isoDate: string): string {
    const d = parseLocalDate(isoDate);
    if (Number.isNaN(d.getTime())) return isoDate;
    return toLocalISODate(getWeekStartContainingDate(d, startOfWeek));
  }

  function snapFormWeekStart() {
    setWeekStart((prev) => snapWeekStartToConfiguredWeek(prev));
  }

  function snapDraftFilterWeekStart() {
    setDraftWeekStartFilter((prev) => (prev ? snapWeekStartToConfiguredWeek(prev) : prev));
  }

  function onEmployeeSelectChange(newId: string) {
    setEmployeeId(newId);
    lastHourlyPrefillEmployeeId.current = newId;
    setHoursWorkedInput("");
  }

  function openEditPaymentModal(item: EmployeePaymentRow) {
    setError(null);
    lastHourlyPrefillEmployeeId.current = item.employee_id;
    setEditingPaymentId(item.id);
    setEmployeeId(item.employee_id);
    setWeekStart(item.week_start);
    setHoursWorkedInput(
      item.hours_worked !== null && Number.isFinite(Number(item.hours_worked))
        ? moneyDraftFromNumber(Number(item.hours_worked)) || ""
        : "",
    );
    setStatus(item.status);
    setPaymentDate(item.payment_date ?? "");
    setNotes(item.notes ?? "");
    setShowEntryModal(true);
  }

  async function markAsPaid(item: EmployeePaymentRow) {
    if (item.status !== "pending") return;
    setMarkingPaidId(item.id);
    setError(null);
    try {
      const supabase = createClient();
      await financeRepository.updateEmployeePayment(supabase, item.id, {
        status: "paid",
        payment_date: toLocalISODate(new Date()),
      });
      await load();
    } catch (e) {
      setError(supabaseUserMessage(e) || "Erro ao marcar como pago.");
    } finally {
      setMarkingPaidId(null);
    }
  }

  async function removePayment(item: EmployeePaymentRow) {
    const label = item.employee?.name ?? "este pagamento";
    if (
      !window.confirm(
        `Eliminar o pagamento de ${label} (${item.week_start} · ${formatCurrency(Number(item.amount), currency)})? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      await financeRepository.deleteEmployeePayment(supabase, item.id);
      if (editingPaymentId === item.id) {
        setShowEntryModal(false);
        setEditingPaymentId(null);
        setHoursWorkedInput("");
        setStatus("pending");
        setPaymentDate("");
        setNotes("");
        setError(null);
      }
      await load();
    } catch (e) {
      setError(cadastroDeleteErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function openFilterModal() {
    setDraftWeekStartFilter(weekStartFilter);
    setShowFilterModal(true);
  }

  function applyFilters() {
    setWeekStartFilter(draftWeekStartFilter);
    setShowFilterModal(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (!employeeId) throw new Error("Selecione um funcionário.");
      const hoursWorked = parseMoneyInput(hoursWorkedInput);
      if (hoursWorked === null || hoursWorked <= 0) {
        throw new Error("Informe as horas trabalhadas (valor maior que zero).");
      }
      const employee = employees.find((e) => e.id === employeeId);
      if (!employee) throw new Error("Funcionário inválido.");
      const hourlyRate = Number(employee.hourly_rate);
      if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
        throw new Error("O funcionário selecionado precisa ter valor da hora maior que zero.");
      }
      const amountValue = Number((hoursWorked * hourlyRate).toFixed(2));
      const supabase = createClient();
      const payload = {
        employee_id: employeeId,
        week_start: weekStart,
        hours_worked: hoursWorked,
        amount: amountValue,
        status,
        payment_date: paymentDate || null,
        notes: notes.trim() || null,
      };
      if (editingPaymentId) {
        await financeRepository.updateEmployeePayment(supabase, editingPaymentId, payload);
      } else {
        await financeRepository.createEmployeePayment(supabase, payload);
      }
      closeEntryModal();
      await load();
    } catch (e) {
      setError(supabaseUserMessage(e) || "Erro ao registrar pagamento.");
    } finally {
      setLoading(false);
    }
  }

  const totalWeek = useMemo(
    () => payments.reduce((acc, item) => acc + Number(item.amount), 0),
    [payments],
  );
  const paidCount = useMemo(() => payments.filter((item) => item.status === "paid").length, [payments]);
  const pendingCount = useMemo(
    () => payments.filter((item) => item.status === "pending").length,
    [payments],
  );
  const avg = payments.length > 0 ? totalWeek / payments.length : 0;

  const parsedHoursWorked = parseMoneyInput(hoursWorkedInput);
  const hoursWorkedValid = parsedHoursWorked !== null && parsedHoursWorked > 0;
  const selectedEmployee = employees.find((e) => e.id === employeeId);
  const selectedHourlyRate = Number(selectedEmployee?.hourly_rate ?? 0);
  const previewAmount =
    hoursWorkedValid && selectedHourlyRate > 0 ? Number((Number(parsedHoursWorked) * selectedHourlyRate).toFixed(2)) : 0;

  if (!pageReady) {
    return <BrandedFullPageLoader />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar
          title="Gestão de Pagamentos"
          subtitle="Registe a folha por semana de referência e filtre para conferir o que falta pagar"
        />
        <AnimatedSection className="grid-4">
          <StatCard
            label="Folha filtrada"
            value={formatCurrency(totalWeek, currency)}
            hint={weekStartFilter ? "Só a semana selecionada no filtro" : "Todas as semanas listadas"}
          />
          <StatCard label="Pagos" value={String(paidCount)} hint="Marcados como pagos" />
          <StatCard
            label="Pendentes"
            value={String(pendingCount)}
            hint="Ainda a quitar nesta lista"
            danger={pendingCount > 0}
          />
          <StatCard label="Média por pagamento" value={formatCurrency(avg, currency)} />
        </AnimatedSection>

        <section className="card glass lancamentos-actions" style={{ marginBottom: 14 }}>
          <button type="button" className="button-primary-action" onClick={openNewPaymentModal}>
            + Novo pagamento
          </button>
          <button type="button" className="button-secondary-action" onClick={openFilterModal}>
            Filtros
          </button>
        </section>

        {error && !showEntryModal && !showFilterModal ? <p className="hint danger">{error}</p> : null}

        <AnimatedSection className="card glass table-card" delay={0.12}>
          <h3>Lista de pagamentos</h3>
          <table className="table table-cadastro">
            <thead>
              <tr>
                <th>Funcionário</th>
                <th>Semana</th>
                <th>Horas</th>
                <th>Valor</th>
                <th>Status</th>
                <th>Data pgto</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="hint">
                    Nenhum registo nesta vista. Use <strong>+ Novo pagamento</strong> ou ajuste os filtros.
                  </td>
                </tr>
              ) : (
                payments.map((item) => (
                  <tr key={item.id}>
                    <td>{item.employee?.name || "—"}</td>
                    <td>{item.week_start}</td>
                    <td>{item.hours_worked !== null ? Number(item.hours_worked).toFixed(2) : "—"}</td>
                    <td>{formatCurrency(Number(item.amount), currency)}</td>
                    <td
                      className={
                        item.status === "paid"
                          ? "status-pago"
                          : item.status === "pending"
                            ? "status-pendente"
                            : "status-cancelado"
                      }
                    >
                      {STATUS_LABEL[item.status]}
                    </td>
                    <td>{item.payment_date || "—"}</td>
                    <td>
                      <div className="pagamentos-list-actions">
                        {item.status === "pending" ? (
                          <button
                            type="button"
                            className="pagamentos-action-pagar"
                            disabled={loading || markingPaidId === item.id}
                            onClick={() => void markAsPaid(item)}
                          >
                            Pagar
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="pagamentos-action-icon"
                          title="Editar"
                          aria-label="Editar pagamento"
                          disabled={loading || markingPaidId === item.id}
                          onClick={() => openEditPaymentModal(item)}
                        >
                          <Pencil size={18} strokeWidth={2} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="pagamentos-action-icon pagamentos-action-icon--danger"
                          title="Excluir"
                          aria-label="Excluir pagamento"
                          disabled={loading || markingPaidId === item.id}
                          onClick={() => void removePayment(item)}
                        >
                          <Trash2 size={18} strokeWidth={2} aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </AnimatedSection>

        {showEntryModal ? (
          <div className="modal-overlay" onClick={() => closeEntryModal()}>
            <section
              className="modal-card glass pagamentos-entry-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="pagamentos-entry-modal__title">
                {editingPaymentId ? "Editar pagamento" : "Novo pagamento de funcionário"}
              </h3>
              {error ? <p className="hint danger pagamentos-entry-modal__error">{error}</p> : null}
              <form
                className="auth-form form-compact pagamentos-entry-form"
                autoComplete="off"
                onSubmit={handleSubmit}
                key={editingPaymentId ?? "new"}
              >
                <div className="pagamentos-entry-modal__section">
                  <label>
                    Funcionário
                    <select value={employeeId} onChange={(e) => onEmployeeSelectChange(e.target.value)} required>
                      <option value="">Selecione</option>
                      {employees.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="pagamentos-week-field">
                    Início da semana
                    <span className="pagamentos-week-field__row">
                      <input
                        type="date"
                        value={weekStart}
                        onChange={(e) => setWeekStart(e.target.value)}
                        required
                      />
                      <button type="button" className="button-secondary-action" onClick={snapFormWeekStart}>
                        Alinhar semana
                      </button>
                    </span>
                  </label>
                </div>
                <div className="pagamentos-entry-modal__section pagamentos-entry-modal__section--grid">
                  <label>
                    Horas trabalhadas
                    <input
                      type="text"
                      name="employee_payment_hours"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="Ex.: 40,00"
                      value={hoursWorkedInput}
                      onChange={(e) => setHoursWorkedInput(sanitizeMoneyDraft(e.target.value))}
                    />
                  </label>
                  <label>
                    Status
                    <select value={status} onChange={(e) => setStatus(e.target.value as EmployeePaymentStatus)}>
                      <option value="pending">Pendente</option>
                      <option value="paid">Pago</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </label>
                </div>
                <div className="pagamentos-entry-modal__section pagamentos-entry-modal__section--grid">
                  <label>
                    Valor/hora (cadastro)
                    <input type="text" value={formatCurrency(selectedHourlyRate, currency)} disabled />
                  </label>
                  <label>
                    Valor calculado da semana
                    <input type="text" value={formatCurrency(previewAmount, currency)} disabled />
                  </label>
                </div>
                <div className="pagamentos-entry-modal__section pagamentos-entry-modal__section--grid">
                  <label>
                    Data de pagamento
                    <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                  </label>
                  <label>
                    Observações
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      placeholder="Opcional"
                    />
                  </label>
                </div>
                <div className="modal-actions modal-actions--pagamentos-entry">
                  <button type="button" className="button-cancel" onClick={() => closeEntryModal()}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="button-confirm"
                    disabled={loading || !hoursWorkedValid || selectedHourlyRate <= 0}
                  >
                    {loading ? "Salvando..." : editingPaymentId ? "Guardar alterações" : "Registrar pagamento"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}

        {showFilterModal ? (
          <div className="modal-overlay" onClick={() => setShowFilterModal(false)}>
            <section className="modal-card glass" onClick={(e) => e.stopPropagation()}>
              <h3>Filtros</h3>
              <p className="hint" style={{ marginBottom: 12 }}>
                Deixe a data vazia para listar <strong>todos</strong> os pagamentos. Com data, filtra pelo{" "}
                <strong>mesmo dia</strong> guardado como início da semana nos registos (igualdade exata).
              </p>
              <div className="auth-form form-compact">
                <label>
                  Semana (início)
                  <input
                    type="date"
                    value={draftWeekStartFilter}
                    onChange={(e) => setDraftWeekStartFilter(e.target.value)}
                  />
                </label>
                <p style={{ margin: "0 0 12px" }}>
                  <button
                    type="button"
                    className="button-secondary-action"
                    onClick={snapDraftFilterWeekStart}
                    disabled={!draftWeekStartFilter}
                  >
                    Alinhar ao início da semana ({weekStartLabel(startOfWeek)})
                  </button>
                </p>
                <div className="modal-actions">
                  <button type="button" className="button-cancel" onClick={() => setShowFilterModal(false)}>
                    Fechar
                  </button>
                  <button type="button" className="button-secondary-action" onClick={() => setDraftWeekStartFilter("")}>
                    Limpar data
                  </button>
                  <button type="button" className="button-confirm" onClick={applyFilters}>
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
