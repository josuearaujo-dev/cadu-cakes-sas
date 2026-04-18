import Link from "next/link";

import { AnimatedSection } from "@/components/animated-section";
import { Sidebar } from "@/components/sidebar";
import { StatCard } from "@/components/stat-card";
import { Topbar } from "@/components/topbar";
import { toLocalISODate } from "@/lib/week-start";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateLongPt(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateShortPt(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function transactionStatusPt(status: string) {
  if (status === "paid") return "Pago";
  if (status === "pending") return "Pendente";
  if (status === "cancelled") return "Cancelado";
  return status;
}

type DueSoonSource = "transaction" | "cheque" | "folha";

type DueSoonRow = {
  id: string;
  description: string | null;
  amount: number;
  due_date: string | null;
  transaction_date: string;
  status: string;
  type?: string;
  source: DueSoonSource;
};

function effectiveDueDate(row: Pick<DueSoonRow, "due_date" | "transaction_date">): string {
  return row.due_date ?? row.transaction_date ?? "";
}

/** Junta lançamentos pendentes, cheques em aberto e folha a pagar (chaves compostas para não colidir). */
function mergeDueSoonLists(todayStr: string, ...lists: (DueSoonRow[] | undefined)[]): DueSoonRow[] {
  const map = new Map<string, DueSoonRow>();
  for (const list of lists) {
    for (const row of list ?? []) {
      map.set(`${row.source}:${row.id}`, row);
    }
  }
  return [...map.values()].sort((a, b) => {
    const ka = effectiveDueDate(a);
    const kb = effectiveDueDate(b);
    const overA = ka < todayStr;
    const overB = kb < todayStr;
    if (overA !== overB) return overA ? -1 : 1;
    return ka.localeCompare(kb);
  });
}

function withTransactionSource(rows: Omit<DueSoonRow, "source">[] | undefined): DueSoonRow[] {
  return (rows ?? []).map((r) => ({ ...r, source: "transaction" as const }));
}

function pendingHighlightStatusPt(item: DueSoonRow): string {
  if (item.source === "folha") return "Pendente (folha)";
  if (item.source === "cheque") {
    if (item.status === "returned") return "Devolvido";
    if (item.status === "scheduled") return "Agendado";
    return item.status;
  }
  return transactionStatusPt(item.status);
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: company } = user
    ? await supabase
        .from("companies")
        .select("company_name, weekly_cheque_limit, currency, start_of_week")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const currency = company?.currency ?? "USD";
  const companyId = user?.id;
  const now = new Date();
  const today = toLocalISODate(now);
  const plus48h = new Date(now);
  plus48h.setDate(now.getDate() + 2);

  const startWeek = new Date(now);
  const startOffset = company?.start_of_week === "monday" ? (now.getDay() + 6) % 7 : now.getDay();
  startWeek.setDate(now.getDate() - startOffset);
  const endWeek = new Date(startWeek);
  endWeek.setDate(startWeek.getDate() + 6);
  const startWeekStr = toLocalISODate(startWeek);
  const endWeekStr = toLocalISODate(endWeek);

  const plus48Str = toLocalISODate(plus48h);

  const [
    pendingPaymentsResult,
    weekChequeResult,
    weekEntriesResult,
    folhaPaidWeekResult,
    dueSoonByDueDateResult,
    dueSoonByTxDateResult,
    overdueByDueDateResult,
    overdueByTxDateResult,
    chequesDueSoonResult,
    chequesOverdueResult,
    todayEntriesResult,
    folhaPaidTodayResult,
  ] = companyId
    ? await Promise.all([
        supabase
          .from("employee_payments")
          .select("id, amount, week_start, employee:employees(name)")
          .eq("company_id", companyId)
          .eq("status", "pending"),
        supabase
          .from("cheques")
          .select("id")
          .eq("company_id", companyId)
          .neq("status", "cancelled")
          .gte("cheque_date", startWeekStr)
          .lte("cheque_date", endWeekStr),
        supabase
          .from("transactions")
          .select("type, amount, status, transaction_date")
          .eq("company_id", companyId)
          .gte("transaction_date", startWeekStr)
          .lte("transaction_date", endWeekStr)
          .neq("status", "cancelled"),
        supabase
          .from("employee_payments")
          .select("amount, payment_date, transaction_id")
          .eq("company_id", companyId)
          .eq("status", "paid")
          .gte("payment_date", startWeekStr)
          .lte("payment_date", endWeekStr)
          .is("transaction_id", null),
        supabase
          .from("transactions")
          .select("id, description, amount, due_date, transaction_date, status, type")
          .eq("company_id", companyId)
          .eq("status", "pending")
          .not("due_date", "is", null)
          .gte("due_date", today)
          .lte("due_date", plus48Str)
          .order("due_date", { ascending: true }),
        supabase
          .from("transactions")
          .select("id, description, amount, due_date, transaction_date, status, type")
          .eq("company_id", companyId)
          .eq("status", "pending")
          .is("due_date", null)
          .gte("transaction_date", today)
          .lte("transaction_date", plus48Str)
          .order("transaction_date", { ascending: true }),
        supabase
          .from("transactions")
          .select("id, description, amount, due_date, transaction_date, status, type")
          .eq("company_id", companyId)
          .eq("status", "pending")
          .not("due_date", "is", null)
          .lt("due_date", today)
          .order("due_date", { ascending: true })
          .limit(40),
        supabase
          .from("transactions")
          .select("id, description, amount, due_date, transaction_date, status, type")
          .eq("company_id", companyId)
          .eq("status", "pending")
          .is("due_date", null)
          .lt("transaction_date", today)
          .order("transaction_date", { ascending: true })
          .limit(40),
        supabase
          .from("cheques")
          .select("id, cheque_date, amount, status, notes, supplier:suppliers(name)")
          .eq("company_id", companyId)
          .in("status", ["scheduled", "returned"])
          .gte("cheque_date", today)
          .lte("cheque_date", plus48Str)
          .order("cheque_date", { ascending: true })
          .limit(40),
        supabase
          .from("cheques")
          .select("id, cheque_date, amount, status, notes, supplier:suppliers(name)")
          .eq("company_id", companyId)
          .in("status", ["scheduled", "returned"])
          .lt("cheque_date", today)
          .order("cheque_date", { ascending: false })
          .limit(30),
        supabase
          .from("transactions")
          .select("id, type, amount, description, status, transaction_date")
          .eq("company_id", companyId)
          .eq("transaction_date", today)
          .order("created_at", { ascending: false }),
        supabase
          .from("employee_payments")
          .select("id, amount, status, payment_date, transaction_id, employee:employees(name)")
          .eq("company_id", companyId)
          .eq("status", "paid")
          .eq("payment_date", today)
          .is("transaction_id", null),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
      ];

  const pendingPayments =
    (pendingPaymentsResult.data as {
      id: string;
      amount: number;
      week_start: string;
      employee?: { name?: string };
    }[]) ?? [];
  const folhaPendente = pendingPayments.reduce((acc, item) => acc + Number(item.amount), 0);
  const folhaPaidTodayRows =
    (folhaPaidTodayResult.data as {
      id: string;
      amount: number;
      status: string;
      payment_date: string | null;
      employee?: { name?: string };
    }[]) ?? [];
  const folhaPaidTodayTotal = folhaPaidTodayRows.reduce((acc, item) => acc + Number(item.amount), 0);
  const weekEntries =
    (weekEntriesResult.data as { type: string; amount: number; status: string; transaction_date: string }[]) ?? [];
  const folhaPaidWeekLegacy =
    (folhaPaidWeekResult.data as { amount: number; payment_date: string | null; transaction_id: string | null }[]) ??
    [];
  const usedCheques = weekChequeResult.data?.length ?? 0;
  const limiteCheques = company?.weekly_cheque_limit ?? 5;
  const chequesDisponiveis = Math.max(limiteCheques - usedCheques, 0);
  const folhaDueRows: DueSoonRow[] = pendingPayments.map((ep) => ({
    id: ep.id,
    description: `Folha · ${ep.employee?.name ?? "Funcionário"} (sem. ref. ${ep.week_start})`,
    amount: Number(ep.amount),
    due_date: ep.week_start,
    transaction_date: ep.week_start,
    status: "pending",
    type: "expense",
    source: "folha",
  }));

  type ChequeDueRow = {
    id: string;
    cheque_date: string;
    amount: number;
    status: string;
    notes: string | null;
    supplier?: { name?: string };
  };

  const mapChequeToDueSoon = (c: ChequeDueRow): DueSoonRow => ({
    id: c.id,
    description: `Cheque ${c.status === "returned" ? "devolvido" : "agendado"} · ${c.supplier && typeof c.supplier === "object" && "name" in c.supplier ? String(c.supplier.name) : "Fornecedor"}`,
    amount: Number(c.amount),
    due_date: c.cheque_date,
    transaction_date: c.cheque_date,
    status: c.status,
    type: "expense",
    source: "cheque",
  });

  const chequeDueRows: DueSoonRow[] = [
    ...((chequesDueSoonResult.data ?? []) as ChequeDueRow[]).map(mapChequeToDueSoon),
    ...((chequesOverdueResult.data ?? []) as ChequeDueRow[]).map(mapChequeToDueSoon),
  ];

  const dueSoon = companyId
    ? mergeDueSoonLists(
        today,
        withTransactionSource(dueSoonByDueDateResult.data as Omit<DueSoonRow, "source">[] | undefined),
        withTransactionSource(dueSoonByTxDateResult.data as Omit<DueSoonRow, "source">[] | undefined),
        withTransactionSource(overdueByDueDateResult.data as Omit<DueSoonRow, "source">[] | undefined),
        withTransactionSource(overdueByTxDateResult.data as Omit<DueSoonRow, "source">[] | undefined),
        chequeDueRows,
        folhaDueRows,
      )
    : [];
  const todayEntries = todayEntriesResult.data ?? [];
  const todayActive = todayEntries.filter((item) => item.status !== "cancelled");
  const totalTodayEntries = todayActive
    .filter((item) => item.type === "income")
    .reduce((acc, item) => acc + Number(item.amount), 0);
  const totalTodayExpensesTx = todayActive
    .filter((item) => item.type === "expense")
    .reduce((acc, item) => acc + Number(item.amount), 0);
  const totalTodayExpenses = totalTodayExpensesTx + folhaPaidTodayTotal;
  const projectedCash = totalTodayEntries - totalTodayExpenses;
  const totalWeekEntries = weekEntries
    .filter((item) => item.type === "income")
    .reduce((acc, item) => acc + Number(item.amount), 0);
  const totalWeekExpensesTx = weekEntries
    .filter((item) => item.type === "expense")
    .reduce((acc, item) => acc + Number(item.amount), 0);
  const totalWeekExpensesLegacy = folhaPaidWeekLegacy.reduce((acc, item) => acc + Number(item.amount), 0);
  const totalWeekExpenses = totalWeekExpensesTx + totalWeekExpensesLegacy;
  const projectedWeekCash = totalWeekEntries - totalWeekExpenses;
  const weekRangeLabel = `${formatDateShortPt(startWeekStr)} a ${formatDateShortPt(endWeekStr)}`;
  const hojeLegivel = formatDateLongPt(today);
  const caixaPositivo = projectedWeekCash >= 0;

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar
          title={company?.company_name ? `Painel Financeiro — ${company.company_name}` : "Painel Financeiro"}
          subtitle=""
        />

        <div className="painel-dashboard">
          <div className="painel-quick-bar">
            <span className="painel-quick-bar__label">Atalhos</span>
            <Link href="/lancamentos" className="painel-link-pill painel-link-pill--primary">
              Lançamentos
            </Link>
            <Link href="/pagamentos" className="painel-link-pill">
              Pagamentos
            </Link>
            <Link href="/cheques" className="painel-link-pill">
              Cheques
            </Link>
            <Link href="/insights" className="painel-link-pill">
              Insights
            </Link>
          </div>

          <AnimatedSection className="grid-4">
            <StatCard label="Caixa previsto hoje" value={money(projectedCash, currency)} />
            <StatCard
              label="Pagamentos pendentes"
              value={String(pendingPayments.length)}
              hint={
                <>
                  <span className="stat-card__hint-line">
                    <strong>{money(folhaPendente, currency)}</strong> em folha a quitar.
                  </span>
                  <span className="stat-card__hint-line">Todas as semanas de referência.</span>
                </>
              }
              danger={pendingPayments.length > 0}
            />
            <StatCard
              label="Cheques disponíveis (semana)"
              value={String(chequesDisponiveis)}
              hint={
                <>
                  <span className="stat-card__hint-line">
                    <strong>
                      {usedCheques} de {limiteCheques}
                    </strong>{" "}
                    utilizados na semana corrente.
                  </span>
                </>
              }
              danger={chequesDisponiveis <= 1}
            />
            <StatCard
              label="Pendentes & vencimentos"
              value={String(dueSoon.length)}
              danger={dueSoon.length > 0}
            />
          </AnimatedSection>

          <AnimatedSection className="grid-2" delay={0.08}>
            <article className="card glass painel-card painel-radar">
              <header className="painel-card__head">
                <h3>Radar da semana</h3>
                <span className="painel-card__meta">{weekRangeLabel}</span>
              </header>
              <div className="radar-metrics">
                <div className="radar-metric radar-metric--highlight">
                  <div>
                    <span className="radar-metric__label">Pressão de caixa (cenário da semana)</span>
                    <p className="radar-metric__value">{money(projectedWeekCash, currency)}</p>
                  </div>
                  <span className={caixaPositivo ? "radar-chip radar-chip--ok" : "radar-chip radar-chip--risk"}>
                    {caixaPositivo ? "Sob controle" : "Atenção: saldo negativo"}
                  </span>
                </div>
                <div className="radar-metric">
                  <span className="radar-metric__label">Entradas</span>
                  <p className="radar-metric__value">{money(totalWeekEntries, currency)}</p>
                </div>
                <div className="radar-metric">
                  <span className="radar-metric__label">Saídas</span>
                  <p className="radar-metric__value">{money(totalWeekExpenses, currency)}</p>
                </div>
              </div>
              <p className="radar-footnote">
                <strong>Risco de curto prazo:</strong>{" "}
                {dueSoon.length > 0
                  ? `${dueSoon.length} item(ns) em destaque: lançamentos, folha a pagar ou cheques em aberto.`
                  : "Nenhum item neste recorte: lançamentos pendentes, folha ou cheques agendados/devolvidos nas regras acima."}
                {folhaPaidTodayTotal > 0 ? (
                  <>
                    {" "}
                    <strong>Folha legada:</strong> inclui {money(folhaPaidTodayTotal, currency)} pago hoje ainda sem
                    lançamento automático no livro.
                  </>
                ) : null}
                {todayEntries.length > todayActive.length && folhaPaidTodayTotal === 0 ? (
                  <> Há lançamentos de hoje anulados na lista abaixo; os totais acima já os excluem.</>
                ) : null}
              </p>
            </article>
            <article className="card glass painel-card painel-vencimentos table-card">
              <header className="painel-card__head painel-vencimentos__head">
                <h3>Pendentes e vencimentos</h3>
                <span className="painel-card__meta">48 h · atraso</span>
              </header>
              {dueSoon.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Referência</th>
                      <th>Descrição</th>
                      <th className="table-num">Valor</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dueSoon.map((item) => {
                      const ref = effectiveDueDate(item);
                      const atraso = ref < today;
                      return (
                        <tr key={`${item.source}-${item.id}`}>
                          <td>
                            <span className="painel-venc-data">{ref || "—"}</span>
                            {atraso ? (
                              <span className="painel-venc-badge painel-venc-badge--late">Atraso</span>
                            ) : null}
                            {item.source === "folha" ? (
                              <span className="painel-venc-sub">Semana de referência</span>
                            ) : item.source === "cheque" ? (
                              <span className="painel-venc-sub">Data do cheque</span>
                            ) : !item.due_date && item.transaction_date ? (
                              <span className="painel-venc-sub">Data do lançamento</span>
                            ) : null}
                          </td>
                          <td className="cell-desc">{item.description || "Sem descrição"}</td>
                          <td className="table-num">{money(Number(item.amount), currency)}</td>
                          <td className="status-pendente">{pendingHighlightStatusPt(item)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div className="painel-empty">
                  <span className="painel-empty__title">Sem pendentes neste recorte</span>
                  Não há lançamentos pendentes neste recorte, nem folha a quitar, nem cheques agendados/devolvidos
                  com data do cheque neste intervalo. Consulte{" "}
                  <Link href="/lancamentos" style={{ fontWeight: 800, color: "var(--brown)" }}>
                    Lançamentos
                  </Link>
                  ,{" "}
                  <Link href="/pagamentos" style={{ fontWeight: 800, color: "var(--brown)" }}>
                    Pagamentos
                  </Link>{" "}
                  ou <Link href="/cheques">Cheques</Link>.
                </div>
              )}
            </article>
          </AnimatedSection>

          <AnimatedSection className="card glass table-card painel-lancamentos-dia" delay={0.15}>
            <header className="painel-card__head">
              <h3>Movimentos de hoje</h3>
              <span className="painel-card__meta">{hojeLegivel}</span>
            </header>
            <p className="hint">
              Lista do dia por data de lançamento. Itens cancelados podem aparecer na tabela, mas{" "}
              <strong>não entram</strong> nos totais do topo.
            </p>
            <table className="table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th className="table-num">Valor ({currency})</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {todayEntries.length === 0 && folhaPaidTodayRows.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="painel-empty" style={{ textAlign: "left", padding: "20px 0" }}>
                        <span className="painel-empty__title">Sem movimentos nesta data</span>
                        <p style={{ marginTop: 10, marginBottom: 0 }}>
                          Ainda não há lançamentos nem folha (legada) registada para hoje. Use{" "}
                          <Link href="/lancamentos" style={{ fontWeight: 800, color: "var(--brown)" }}>
                            Lançamentos
                          </Link>{" "}
                          ou{" "}
                          <Link href="/pagamentos" style={{ fontWeight: 800, color: "var(--brown)" }}>
                            Pagamentos
                          </Link>
                          .
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <>
                    {todayEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          {entry.type === "income" ? (
                            <span className="type-pill type-pill--income">Receita</span>
                          ) : (
                            <span className="type-pill type-pill--expense">Despesa</span>
                          )}
                        </td>
                        <td className="cell-desc">{entry.description || "Sem descrição"}</td>
                        <td className="table-num">{money(Number(entry.amount), currency)}</td>
                        <td
                          className={
                            entry.status === "paid"
                              ? "status-pago"
                              : entry.status === "cancelled"
                                ? "status-cancelado"
                                : "status-pendente"
                          }
                        >
                          {transactionStatusPt(entry.status)}
                        </td>
                      </tr>
                    ))}
                    {folhaPaidTodayRows.map((row) => (
                      <tr key={`folha-${row.id}`}>
                        <td>
                          <span className="type-pill type-pill--folha">Folha</span>
                        </td>
                        <td className="cell-desc">Funcionário · {row.employee?.name ?? "—"}</td>
                        <td className="table-num">{money(Number(row.amount), currency)}</td>
                        <td className="status-pago">{transactionStatusPt("paid")}</td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
            <p className="hint painel-lancamentos-footer">
              <Link href="/lancamentos" className="painel-link-pill painel-link-pill--primary">
                Abrir Lançamentos
              </Link>
              <span>Filtrar por período ou editar movimentos.</span>
            </p>
          </AnimatedSection>
        </div>
      </main>
    </div>
  );
}
