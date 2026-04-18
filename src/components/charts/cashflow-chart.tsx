"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type CashflowChartRow = { semana: string; entradas: number; saidas: number };

type Props = {
  /** Semanas com totais de entradas e saídas (já filtrados, ex. sem cancelados). */
  data: CashflowChartRow[];
  currency?: string;
};

function axisTickFormatter(values: number[]) {
  const maxVal = Math.max(1, ...values);
  if (maxVal < 5000) {
    return (v: number) => String(Math.round(v));
  }
  return (v: number) => `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k`;
}

export function CashflowChart({ data, currency = "USD" }: Props) {
  const flatValues = data.flatMap((d) => [d.entradas, d.saidas]);
  const tickFmt = axisTickFormatter(flatValues);
  const money = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });

  if (data.length === 0) {
    return (
      <div className="chart card glass">
        <h3>Fluxo de Caixa Semanal</h3>
        <p className="hint" style={{ padding: "24px 16px" }}>
          Sem lançamentos efetivos no período para montar o gráfico.
        </p>
      </div>
    );
  }

  return (
    <div className="chart card glass">
      <h3>Fluxo de Caixa Semanal</h3>
      <p className="hint" style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
        Barras com base nas transações do mês (anuladas excluídas).
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <XAxis dataKey="semana" stroke="#6f5243" />
          <YAxis stroke="#6f5243" tickFormatter={tickFmt} width={44} />
          <Tooltip
            formatter={(v) => money.format(typeof v === "number" ? v : Number(v ?? 0))}
            labelStyle={{ color: "#531B04" }}
          />
          <Bar dataKey="entradas" fill="#531B04" radius={[8, 8, 0, 0]} />
          <Bar dataKey="saidas" fill="#FB5B77" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
