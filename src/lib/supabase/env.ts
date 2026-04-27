/**
 * URL do projeto no painel Supabase (Settings → API → Project URL).
 * Deve ser só a origem, ex.: `https://abcdefgh.supabase.co` — sem `/rest/v1` nem `/auth/v1`.
 */
export function normalizeSupabaseProjectUrl(raw: string): string {
  let candidate = raw.trim().replace(/\/+$/, "");
  const lower = candidate.toLowerCase();
  for (const suffix of ["/rest/v1", "/auth/v1", "/graphql/v1", "/storage/v1", "/realtime/v1"]) {
    if (lower.endsWith(suffix)) {
      candidate = candidate.slice(0, -suffix.length).replace(/\/+$/, "");
      break;
    }
  }
  try {
    const parsed = new URL(candidate);
    if (!parsed.protocol.startsWith("http")) {
      throw new Error("protocol");
    }
    return parsed.origin;
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL inválida. Use apenas a URL base do projeto (ex.: https://xxxxx.supabase.co), sem caminhos como /rest/v1.",
    );
  }
}

export function getSupabaseEnv() {
  const urlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKeyRaw = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!urlRaw || !anonKeyRaw) {
    throw new Error(
      "Supabase env vars ausentes. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const url = normalizeSupabaseProjectUrl(urlRaw);
  const anonKey = anonKeyRaw.trim();

  return { url, anonKey };
}
