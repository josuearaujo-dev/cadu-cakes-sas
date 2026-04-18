/**
 * Rascunho monetário em texto: permite campo vazio e um separador decimal (vírgula ou ponto).
 * Evita `type="number"` com valor 0 que não deixa apagar e gera dígitos à frente do zero.
 */
export function sanitizeMoneyDraft(raw: string): string {
  const s = raw.replace(/\s/g, "").replace(",", ".");
  if (s === "") return "";
  let out = "";
  let dotSeen = false;
  for (const ch of s) {
    if (ch >= "0" && ch <= "9") {
      out += ch;
    } else if (ch === "." && !dotSeen) {
      out += ".";
      dotSeen = true;
    }
  }
  return out;
}

/** Vazio ou só "." → null; caso contrário número finito (pode ser 0). */
export function parseMoneyInput(s: string): number | null {
  const t = s.trim();
  if (t === "" || t === ".") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

/** Valor guardado → texto inicial no campo de edição. */
export function moneyDraftFromNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n === 0) return "";
  return String(n);
}

/** Apenas dígitos, comprimento máximo (ex.: limite 1–30). */
export function sanitizeDigitsDraft(raw: string, maxLen: number): string {
  return raw.replace(/\D/g, "").slice(0, maxLen);
}

export function parseDigitsInt(s: string): number | null {
  const t = s.trim();
  if (t === "") return null;
  const n = parseInt(t, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}
