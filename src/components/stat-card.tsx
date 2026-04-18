import type { ReactNode } from "react";

type Props = {
  label: string;
  value: string;
  hint?: ReactNode;
  danger?: boolean;
  /** Ex.: `stat-card--dashboard` para estilos específicos do painel. */
  className?: string;
};

export function StatCard({ label, value, hint, danger = false, className }: Props) {
  const rootClass = ["card glass", "stat-card", className].filter(Boolean).join(" ");
  return (
    <article className={rootClass}>
      <h3>{label}</h3>
      <p className="value">{value}</p>
      {hint ? <div className={danger ? "hint danger" : "hint"}>{hint}</div> : null}
    </article>
  );
}
