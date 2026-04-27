"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { supabaseUserMessage } from "@/lib/supabase/error-message";

export const dynamic = "force-dynamic";

export default function AuthPage() {
  const router = useRouter();
  const redirectTo =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("redirectTo") || "/"
      : "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      setMessage(supabaseUserMessage(error) || "Falha ao autenticar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card glass">
        <h1>Entrar no sistema</h1>
        <p className="hint">Acesso restrito ao sistema financeiro da Cadu Cakes.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="voce@empresa.com"
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              placeholder="Minimo 6 caracteres"
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Processando..." : "Entrar"}
          </button>
        </form>

        {message ? <p className="hint">{message}</p> : null}
        <p className="hint">Cadastro de usuários é realizado apenas por administrador.</p>
      </section>
    </main>
  );
}
