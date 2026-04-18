import { AnimatedSection } from "@/components/animated-section";
import { CashflowChart } from "@/components/charts/cashflow-chart";
import { ExpensePie } from "@/components/charts/expense-pie";
import { Sidebar } from "@/components/sidebar";
import { StatCard } from "@/components/stat-card";
import { Topbar } from "@/components/topbar";
import { toLocalISODate } from "@/lib/week-start";
import { createClient } from "@/lib/supabase/server";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function getWeekKey(dateValue: string, startOfWeek: "sunday" | "monday") {
  const date = new Date(`${dateValue}T00:00:00`);
  const day = date.getDay();
  const offset = startOfWeek === "monday" ? (day + 6) % 7 : day;
  date.setDate(date.getDate() - offset);
  return toLocalISODate(date);
}

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: company } = user
    ? await supabase
        .from("companies")
        .select("currency, weekly_cheque_limit, start_of_week")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  const currency = company?.currency ?? "USD";
  const startOfWeek = company?.start_of_week === "monday" ? "monday" : "sunday";
  const weeklyChequeLimit = company?.weekly_cheque_limit ?? 5;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthISOStart = toLocalISODate(monthStart);
  const monthISOEnd = toLocalISODate(monthEnd);
  const companyId = user?.id;

  const folhaMonthFilter = `and(week_start.gte.${monthISOStart},week_start.lte.${monthISOEnd}),and(status.eq.paid,payment_date.gte.${monthISOStart},payment_date.lte.${monthISOEnd})`;

  const [transactionsResult, payrollResult, chequesResult] = companyId
    ? await Promise.all([
        supabase
          .from("transactions")
          .select("amount, type, category:categories(name), transaction_date")
          .eq("company_id", companyId)
          .neq("status", "cancelled")
          .gte("transaction_date", monthISOStart)
          .lte("transaction_date", monthISOEnd),
        supabase
          .from("employee_payments")
          .select("amount, status, week_start, payment_date, transaction_id")
          .eq("company_id", companyId)
          .neq("status", "cancelled")
          .or(folhaMonthFilter),
        supabase
          .from("cheques")
          .select("cheque_date, status")
          .eq("company_id", companyId)
          .neq("status", "cancelled")
          .gte("cheque_date", monthISOStart)
          .lte("cheque_date", monthISOEnd),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const transactions = transactionsResult.data ?? [];
  const payroll = payrollResult.data ?? [];
  const cheques = chequesResult.data ?? [];

  const totalReceitas = transactions
    .filter((item) => item.type === "income")
    .reduce((acc, item) => acc + Number(item.amount), 0);
  const totalDespesasTransacoes = transactions
    .filter((item) => item.type === "expense")
    .reduce((acc, item) => acc + Number(item.amount), 0);
  /** Folha paga sem `transaction_id`: antes do lançamento automático (evita duplicar com `transactions`). */
  const folhaPagaLegacyNoMes = payroll
    .filter((item) => item.status === "paid" && item.payment_date && item.transaction_id == null)
    .reduce((acc, item) => acc + Number(item.amount), 0);
  const totalDespesas = totalDespesasTransacoes + folhaPagaLegacyNoMes;
  const saldoMensal = totalReceitas - totalDespesas;
  const margem = totalReceitas > 0 ? (saldoMensal / totalReceitas) * 100 : 0;

  const weekTotals = new Map<string, { entradas: number; saidas: number; cheques: number }>();
  for (const item of transactions) {
    if (!item.transaction_date) continue;
    const key = getWeekKey(item.transaction_date, startOfWeek);
    const current = weekTotals.get(key) ?? { entradas: 0, saidas: 0, cheques: 0 };
    if (item.type === "income") current.entradas += Number(item.amount);
    if (item.type === "expense") current.saidas += Number(item.amount);
    weekTotals.set(key, current);
  }
  for (const item of cheques) {
    const key = getWeekKey(item.cheque_date, startOfWeek);
    const current = weekTotals.get(key) ?? { entradas: 0, saidas: 0, cheques: 0 };
    current.cheques += 1;
    weekTotals.set(key, current);
  }
  for (const item of payroll) {
    if (item.status !== "paid" || !item.payment_date || item.transaction_id != null) continue;
    const key = getWeekKey(item.payment_date, startOfWeek);
    const current = weekTotals.get(key) ?? { entradas: 0, saidas: 0, cheques: 0 };
    current.saidas += Number(item.amount);
    weekTotals.set(key, current);
  }

  const weekRows = Array.from(weekTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStartDate, values]) => ({
      semana: weekStartDate,
      saldo: values.entradas - values.saidas,
      usados: values.cheques,
      limite: weeklyChequeLimit,
    }));

  const semanasNegativas = weekRows.filter((item) => item.saldo < 0).length;
  const piorSemana = weekRows.reduce(
    (worst, current) => (current.saldo < worst.saldo ? current : worst),
    weekRows[0] ?? { semana: "-", saldo: 0, usados: 0, limite: weeklyChequeLimit },
  );

  const expenseByCategoryMap = new Map<string, number>();
  for (const item of transactions) {
    if (item.type !== "expense") continue;
    const categoryName =
      item.category && typeof item.category === "object" && "name" in item.category
        ? String(item.category.name)
        : "Sem categoria";
    expenseByCategoryMap.set(categoryName, (expenseByCategoryMap.get(categoryName) ?? 0) + Number(item.amount));
  }
  if (folhaPagaLegacyNoMes > 0) {
    expenseByCategoryMap.set(
      "Folha (funcionários)",
      (expenseByCategoryMap.get("Folha (funcionários)") ?? 0) + folhaPagaLegacyNoMes,
    );
  }
  const categoryRows = Array.from(expenseByCategoryMap.entries()).map(([nome, valor]) => ({ nome, valor }));
  const maiorCategoria = categoryRows.reduce(
    (max, current) => (current.valor > max.valor ? current : max),
    categoryRows[0] ?? { nome: "Sem dados", valor: 0 },
  );
  const totalCategoriaDespesas = categoryRows.reduce((acc, item) => acc + item.valor, 0);
  const shareMaiorCategoria =
    totalCategoriaDespesas > 0 ? (maiorCategoria.valor / totalCategoriaDespesas) * 100 : 0;

  const totalFolha = payroll.reduce((acc, item) => acc + Number(item.amount), 0);
  const folhaPendente = payroll
    .filter((item) => item.status === "pending")
    .reduce((acc, item) => acc + Number(item.amount), 0);

  const pressaoChequesMax = weekRows.reduce(
    (max, week) => Math.max(max, week.limite > 0 ? (week.usados / week.limite) * 100 : 0),
    0,
  );

  const cashflowChartRows = Array.from(weekTotals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, v]) => ({
      semana: `Sem ${new Date(`${weekStart}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`,
      entradas: v.entradas,
      saidas: v.saidas,
    }));

  const expensePieData = categoryRows
    .filter((row) => row.valor > 0)
    .map((row) => ({ name: row.nome, value: row.valor }));

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar
          title="Insights Financeiros"
          subtitle="Mês corrente: lançamentos (inclui folha gerada automaticamente) + folha legada sem lançamento; anulados não entram"
        />

        <AnimatedSection className="grid-4">
          <StatCard
            label="Saldo consolidado"
            value={money(saldoMensal, currency)}
            hint={`Margem ${margem.toFixed(1)}% no periodo`}
            danger={margem < 10}
          />
          <StatCard
            label="Semanas negativas"
            value={String(semanasNegativas)}
            hint={`${piorSemana.semana}: ${money(piorSemana.saldo, currency)}`}
            danger={semanasNegativas > 0}
          />
          <StatCard
            label="Maior centro de custo"
            value={maiorCategoria.nome}
            hint={`${money(maiorCategoria.valor, currency)} (${shareMaiorCategoria.toFixed(1)}%)`}
            danger={shareMaiorCategoria > 40}
          />
          <StatCard
            label="Folha pendente"
            value={money(folhaPendente, currency)}
            hint={`Folha total ${money(totalFolha, currency)}`}
            danger={folhaPendente > 0}
          />
        </AnimatedSection>

        <AnimatedSection className="grid-2" delay={0.06}>
          <CashflowChart data={cashflowChartRows} currency={currency} />
          <ExpensePie data={expensePieData} currency={currency} />
        </AnimatedSection>

        <AnimatedSection className="grid-2" delay={0.1}>
          <article className="card glass">
            <h3>Alertas priorizados</h3>
            <p className="hint">
              1) <strong>Capital de giro:</strong> houve {semanasNegativas} semana(s)
              negativa(s); revisar vencimentos fixos na primeira quinzena.
            </p>
            <p className="hint">
              2) <strong>Pressao de cheques:</strong> pico de uso em{" "}
              {pressaoChequesMax.toFixed(0)}% do limite semanal.
            </p>
            <p className="hint">
              3) <strong>Custo dominante:</strong> {maiorCategoria.nome} representa{" "}
              {shareMaiorCategoria.toFixed(1)}% das despesas por categoria.
            </p>
            <p className="hint">
              4) <strong>Risco operacional:</strong> {money(folhaPendente, currency)}{" "}
              ainda pendente de pagamento.
            </p>
          </article>

          <article className="card glass table-card">
            <h3>Uso de cheques por semana</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Semana</th>
                  <th>Usados</th>
                  <th>Limite</th>
                  <th>Pressao</th>
                </tr>
              </thead>
              <tbody>
                {weekRows.map((week) => {
                  const pressao = (week.usados / week.limite) * 100;
                  return (
                    <tr key={week.semana}>
                      <td>{week.semana}</td>
                      <td>{week.usados}</td>
                      <td>{week.limite}</td>
                      <td className={pressao >= 80 ? "status-pendente" : "status-pago"}>
                        {pressao.toFixed(0)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </article>
        </AnimatedSection>
      </main>
    </div>
  );
}
