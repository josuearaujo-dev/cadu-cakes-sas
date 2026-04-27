/** Lê mensagem de erros do PostgREST/Supabase (nem sempre são `instanceof Error`). */
export function supabaseUserMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (typeof error === "object" && error !== null) {
    const o = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [o.message, o.details, o.hint].filter(
      (v): v is string => typeof v === "string" && v.trim().length > 0,
    );
    if (parts.length) return parts.join(" — ");
    if (o.code !== undefined) return `Código ${String(o.code)}`;
  }
  return "";
}
