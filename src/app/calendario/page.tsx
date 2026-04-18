"use client";

import { AnimatedSection } from "@/components/animated-section";
import { BrandedFullPageLoader } from "@/components/branded-full-page-loader";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import type {
  Cheque,
  ChequeStatus,
  EmployeePayment,
  FinancialTransaction,
  PaymentMethod,
  Supplier,
} from "@/lib/finance/types";
import { createClient } from "@/lib/supabase/client";
import { financeRepository } from "@/lib/supabase/finance-repository";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toISODate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function getMonthBounds(baseDate: Date) {
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
  return { start, end };
}

const CHEQUE_STATUS_LABEL: Record<ChequeStatus, string> = {
  scheduled: "Agendado",
  compensated: "Compensado",
  returned: "Devolvido",
  cancelled: "Cancelado",
};

const PAYMENT_STATUS_LABEL = {
  pending: "Pendente",
  paid: "Pago",
  cancelled: "Cancelado",
} as const;

const TRANS_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  transfer: "Transferência",
  cheque: "Cheque",
};

type TxWithJoins = FinancialTransaction & {
  category?: { name?: string } | null;
  employee?: { name?: string } | null;
  supplier?: { name?: string } | null;
  income_source?: { name?: string } | null;
};

export default function CalendarioPage() {
  const router = useRouter();
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [currency, setCurrency] = useState("USD");
  const [transactions, setTransactions] = useState<TxWithJoins[]>([]);
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [payments, setPayments] = useState<EmployeePayment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const supplierNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of suppliers) {
      if (s.active) m.set(s.id, s.name);
    }
    return m;
  }, [suppliers]);

  const [loading, setLoading] = useState(true);
  const [pageReady, setPageReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthDate = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const { monthFrom, monthTo, monthLabel, daysInMonth, firstWeekdayIndex, todayIso } = useMemo(() => {
    const { start, end } = getMonthBounds(monthDate);
    const from = toISODate(start);
    const to = toISODate(end);
    const label = monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const dim = end.getDate();
    const firstIdx = start.getDay();
    const t = toISODate(new Date());
    return {
      monthFrom: from,
      monthTo: to,
      monthLabel: label.charAt(0).toUpperCase() + label.slice(1),
      daysInMonth: dim,
      firstWeekdayIndex: firstIdx,
      todayIso: t,
    };
  }, [monthDate]);

  const money = useMemo(
    () =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }),
    [currency],
  );

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [settings, txData, chequeData, paymentData, supplierData] = await Promise.all([
        financeRepository.getCompanySettings(supabase),
        financeRepository.listTransactions(supabase, { from: monthFrom, to: monthTo }),
        financeRepository.listCheques(supabase, monthFrom, monthTo),
        financeRepository.listEmployeePayments(supabase, {
          intersectingDateRange: { from: monthFrom, to: monthTo },
        }),
        financeRepository.listSuppliers(supabase),
      ]);
      setCurrency(settings.currency ?? "USD");
      setTransactions(txData as TxWithJoins[]);
      setCheques(chequeData);
      setSuppliers(supplierData);
      setPayments(paymentData as EmployeePayment[]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao carregar calendário.";
      if (message.includes("Empresa não encontrada")) {
        router.push("/onboarding");
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
      setPageReady((done) => done || true);
    }
  }, [monthFrom, monthTo, router]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  function navigateMonth(delta: number) {
    setMonthOffset((m) => m + delta);
    setSelectedIso(null);
  }

  const dayAggregates = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    for (const tx of transactions) {
      if (tx.status === "cancelled") continue;
      const d = tx.transaction_date;
      const cur = map.get(d) ?? { income: 0, expense: 0 };
      if (tx.type === "income") cur.income += Number(tx.amount);
      else cur.expense += Number(tx.amount);
      map.set(d, cur);
    }
    return map;
  }, [transactions]);

  const chequesByDate = useMemo(() => {
    const m = new Map<string, Cheque[]>();
    for (const c of cheques) {
      if (c.status === "cancelled") continue;
      const list = m.get(c.cheque_date) ?? [];
      list.push(c);
      m.set(c.cheque_date, list);
    }
    return m;
  }, [cheques]);

  const { leadingEmpty, dayKeys, trailingEmpty } = useMemo(() => {
    const keys: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      keys.push(toISODate(d));
    }
    const totalUsed = firstWeekdayIndex + daysInMonth;
    const trailing = (7 - (totalUsed % 7)) % 7;
    return {
      leadingEmpty: firstWeekdayIndex,
      dayKeys: keys,
      trailingEmpty: trailing,
    };
  }, [daysInMonth, firstWeekdayIndex, monthDate]);

  const detailTransactions = useMemo(() => {
    if (!selectedIso) return [];
    return transactions.filter((tx) => tx.transaction_date === selectedIso && tx.status !== "cancelled");
  }, [selectedIso, transactions]);

  const detailCheques = useMemo(() => {
    if (!selectedIso) return [];
    return (chequesByDate.get(selectedIso) ?? []).filter((c) => c.status !== "cancelled");
  }, [chequesByDate, selectedIso]);

  const detailPayments = useMemo(() => {
    if (!selectedIso) return [];
    return payments.filter(
      (p) => p.week_start === selectedIso || p.payment_date === selectedIso,
    );
  }, [payments, selectedIso]);

  const selectedSummaries = useMemo(() => {
    if (!selectedIso) return { income: 0, expense: 0 };
    return dayAggregates.get(selectedIso) ?? { income: 0, expense: 0 };
  }, [dayAggregates, selectedIso]);

  const dayBalance = selectedSummaries.income - selectedSummaries.expense;

  function chequeLabel(row: Cheque) {
    if (row.supplier_id && supplierNameById.has(row.supplier_id)) {
      return supplierNameById.get(row.supplier_id)!;
    }
    return row.customer_name ?? "Cheque";
  }

  function transactionTitle(tx: TxWithJoins) {
    const cat = tx.category?.name ?? "Lançamento";
    if (tx.type === "income") {
      const src = tx.income_source?.name;
      return src ? `${cat} — ${src}` : cat;
    }
    const who = tx.supplier?.name ?? tx.employee?.name;
    return who ? `${cat} — ${who}` : cat;
  }

  if (!pageReady) {
    return <BrandedFullPageLoader />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar
          title="Calendário financeiro"
          subtitle="Lançamentos, cheques e folha por dia no mês"
        />

        <div className="calendar-layout" onClick={() => setSelectedIso(null)}>
          <div onClick={(event) => event.stopPropagation()}>
            <AnimatedSection className="glass calendar-board">
              <div className="calendar-month-row">
                <button
                  type="button"
                  className="month-nav"
                  onClick={() => navigateMonth(-1)}
                  disabled={loading}
                  aria-label="Mês anterior"
                >
                  {"<"}
                </button>
                <strong>{monthLabel}</strong>
                <button
                  type="button"
                  className="month-nav"
                  onClick={() => navigateMonth(1)}
                  disabled={loading}
                  aria-label="Próximo mês"
                >
                  {">"}
                </button>
              </div>

              {error ? (
                <p className="hint danger" style={{ textAlign: "center", marginBottom: 10 }}>
                  {error}
                </p>
              ) : null}

              <div className="calendar-grid">
                {weekDays.map((day) => (
                  <div key={day} className="calendar-weekday">
                    {day}
                  </div>
                ))}

                {Array.from({ length: leadingEmpty }).map((_, idx) => (
                  <div key={`lead-${idx}`} className="calendar-cell empty" aria-hidden />
                ))}

                {dayKeys.map((iso) => {
                  const dayNum = Number(iso.slice(8, 10));
                  const agg = dayAggregates.get(iso) ?? { income: 0, expense: 0 };
                  const hasTx = agg.income > 0 || agg.expense > 0;
                  const hasCh = (chequesByDate.get(iso)?.length ?? 0) > 0;
                  const isSelected = selectedIso === iso;
                  const isToday = iso === todayIso;
                  return (
                    <motion.button
                      key={iso}
                      type="button"
                      whileHover={{ y: -2, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ duration: 0.16 }}
                      onClick={() => setSelectedIso(iso)}
                      className={`calendar-cell ${isSelected ? "selected" : ""} ${isToday ? "calendar-cell-today" : ""}`}
                    >
                      <p className="day-number">{String(dayNum).padStart(2, "0")}</p>
                      {hasTx ? (
                        <div className="cell-badges">
                          {agg.income > 0 ? (
                            <span className="income-chip">{money.format(agg.income)}</span>
                          ) : null}
                          {agg.expense > 0 ? (
                            <span className="expense-chip">- {money.format(agg.expense)}</span>
                          ) : null}
                        </div>
                      ) : null}
                      {!hasTx && hasCh ? (
                        <span className="calendar-cheque-hint" title="Cheques neste dia">
                          Cheques
                        </span>
                      ) : null}
                    </motion.button>
                  );
                })}

                {Array.from({ length: trailingEmpty }).map((_, idx) => (
                  <div key={`trail-${idx}`} className="calendar-cell empty" aria-hidden />
                ))}
              </div>
            </AnimatedSection>
          </div>

          <AnimatePresence mode="wait">
            {selectedIso ? (
              <motion.section
                key={selectedIso}
                className="glass day-detail floating"
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="detail-head">
                  <p className="detail-label">Detalhe do dia</p>
                  <button
                    type="button"
                    className="detail-close"
                    onClick={() => setSelectedIso(null)}
                    aria-label="Fechar detalhe do dia"
                  >
                    X
                  </button>
                </div>
                <h3>
                  {new Date(`${selectedIso}T12:00:00`).toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </h3>

                <p className="detail-footnote">
                  Totais abaixo refletem o <strong>livro caixa</strong> (lançamentos). Cheques e folha aparecem para
                  contexto operacional.
                </p>

                <div className="detail-list">
                  {detailTransactions.map((tx) => (
                    <div key={tx.id} className="detail-item">
                      <div>
                        <strong>{transactionTitle(tx)}</strong>
                        <p>
                          {TRANS_METHOD_LABEL[tx.payment_method]} ·{" "}
                          {tx.status === "paid" ? "Pago" : tx.status === "pending" ? "Pendente" : "Cancelado"}
                          {tx.description ? ` · ${tx.description}` : ""}
                        </p>
                      </div>
                      <span className={tx.type === "income" ? "status-pago" : "status-pendente"}>
                        {tx.type === "income" ? "+" : "-"} {money.format(Number(tx.amount))}
                      </span>
                    </div>
                  ))}

                  {detailCheques.map((c) => (
                    <div key={c.id} className="detail-item cheque-row">
                      <div>
                        <strong>Cheque — {chequeLabel(c)}</strong>
                        <p>{CHEQUE_STATUS_LABEL[c.status]}</p>
                      </div>
                      <span>{money.format(Number(c.amount))}</span>
                    </div>
                  ))}

                  {detailPayments.map((p) => {
                    const name = (p as EmployeePayment & { employee?: { name?: string } }).employee?.name ?? "Funcionário";
                    return (
                      <div key={p.id} className="detail-item">
                        <div>
                          <strong>Folha — {name}</strong>
                          <p>
                            {PAYMENT_STATUS_LABEL[p.status]}
                            {p.week_start === selectedIso ? ` · semana início ${p.week_start}` : ""}
                            {p.payment_date ? ` · pago em ${p.payment_date}` : ""}
                          </p>
                        </div>
                        <span className={p.status === "paid" ? "status-pago" : "status-pendente"}>
                          {money.format(Number(p.amount))}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {detailTransactions.length === 0 && detailCheques.length === 0 && detailPayments.length === 0 ? (
                  <p className="hint" style={{ marginTop: 8 }}>
                    Nenhum registro neste dia. Use <strong>Lançamentos</strong> ou os módulos de cheques / folha para
                    criar movimentos.
                  </p>
                ) : null}

                <div className="detail-total">
                  <p>Saldo do dia (livro caixa)</p>
                  <strong>{money.format(dayBalance)}</strong>
                </div>

                <Link href={`/lancamentos?from=${selectedIso}&to=${selectedIso}`} className="detail-button">
                  Ver lançamentos deste dia
                </Link>
              </motion.section>
            ) : null}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
