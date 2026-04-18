"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#531B04", "#7A4A35", "#FB5B77", "#D3B09A", "#9a6b52", "#c49a7c"];

export type ExpensePieSlice = { name: string; value: number };

type Props = {
  data: ExpensePieSlice[];
  currency?: string;
};

export function ExpensePie({ data, currency = "USD" }: Props) {
  const money = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  });

  if (data.length === 0) {
    return (
      <div className="chart card glass">
        <h3>Despesas por Categoria</h3>
        <p className="hint" style={{ padding: "24px 16px" }}>
          Nenhuma despesa efetiva no período (ou só entradas).
        </p>
      </div>
    );
  }

  return (
    <div className="chart card glass">
      <h3>Despesas por Categoria</h3>
      <p className="hint" style={{ margin: "0 0 8px", fontSize: "0.85rem" }}>
        Soma do mês por categoria (lançamentos anulados excluídos).
      </p>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={86}>
            {data.map((entry, idx) => (
              <Cell key={`${entry.name}-${idx}`} fill={COLORS[idx % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => money.format(typeof v === "number" ? v : Number(v ?? 0))}
            labelStyle={{ color: "#531B04" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
