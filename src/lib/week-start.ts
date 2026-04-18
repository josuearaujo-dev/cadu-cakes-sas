/** Igual ao painel (`page.tsx`): início da semana que contém `base`. */
export type CompanyStartOfWeek = "sunday" | "monday";

export function getWeekStartContainingDate(base: Date, startOfWeek: CompanyStartOfWeek): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const offset = startOfWeek === "monday" ? (d.getDay() + 6) % 7 : d.getDay();
  d.setDate(d.getDate() - offset);
  return d;
}

/** Data local YYYY-MM-DD (evita desvio de fuso de `toISOString().slice(0, 10)`). */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(iso: string): Date {
  const [y, mo, da] = iso.split("-").map(Number);
  return new Date(y, (mo ?? 1) - 1, da ?? 1, 12, 0, 0, 0);
}

export function weekStartLabel(startOfWeek: CompanyStartOfWeek): string {
  return startOfWeek === "monday" ? "segunda-feira" : "domingo";
}
