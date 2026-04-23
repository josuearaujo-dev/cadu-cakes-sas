import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabaseEnv } from "./env";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /**
           * Em Server Components o `cookies()` do Next é read-only para escrita.
           * O Supabase pode tentar refrescar a sessão e chamar `setAll` aqui — o middleware
           * (`src/lib/supabase/middleware.ts`) é quem deve persistir os cookies na resposta.
           */
        }
      },
    },
  });
}
