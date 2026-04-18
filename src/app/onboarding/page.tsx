"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BrandedFullPageLoader } from "@/components/branded-full-page-loader";
import { parseDigitsInt, sanitizeDigitsDraft } from "@/lib/amount-input";
import { createClient } from "@/lib/supabase/client";

type StartOfWeek = "sunday" | "monday";

export const dynamic = "force-dynamic";

export default function OnboardingPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [weeklyChequeLimitInput, setWeeklyChequeLimitInput] = useState("5");
  const [currency, setCurrency] = useState("USD");
  const [startOfWeek, setStartOfWeek] = useState<StartOfWeek>("sunday");
  const [loading, setLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCompany() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("companies")
          .select("company_name, weekly_cheque_limit, currency, start_of_week")
          .eq("user_id", user.id)
          .maybeSingle();

        if (data) {
          setCompanyName(data.company_name);
          setWeeklyChequeLimitInput(String(data.weekly_cheque_limit ?? 5));
          setCurrency(data.currency);
          setStartOfWeek(data.start_of_week as StartOfWeek);
        }
      } finally {
        if (!cancelled) setPageReady(true);
      }
    }

    void loadCompany();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Sessão inválida. Faça login novamente.");

      const weeklyChequeLimit = parseDigitsInt(weeklyChequeLimitInput);
      if (weeklyChequeLimit === null || weeklyChequeLimit < 1 || weeklyChequeLimit > 30) {
        throw new Error("Limite semanal de cheques deve ser um número entre 1 e 30.");
      }

      const { error } = await supabase.from("companies").upsert({
        user_id: user.id,
        company_name: companyName.trim(),
        weekly_cheque_limit: weeklyChequeLimit,
        currency,
        start_of_week: startOfWeek,
      });

      if (error) throw error;

      router.push("/");
      router.refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Erro ao salvar configuração.";
      setMessage(text);
    } finally {
      setLoading(false);
    }
  }

  if (!pageReady) {
    return <BrandedFullPageLoader />;
  }

  return (
    <main className="auth-page">
      <section className="auth-card glass">
        <h1>Configuração inicial da empresa</h1>
        <p className="hint">Preencha os dados base para habilitar os módulos financeiros.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            Nome da empresa
            <input
              type="text"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              required
              placeholder="Cadu Cakes & Lanches"
            />
          </label>

          <label>
            Limite semanal de cheques
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="5"
              value={weeklyChequeLimitInput}
              onChange={(event) => setWeeklyChequeLimitInput(sanitizeDigitsDraft(event.target.value, 2))}
            />
          </label>

          <label>
            Moeda
            <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
              <option value="USD">USD</option>
              <option value="BRL">BRL</option>
            </select>
          </label>

          <label>
            Inicio da semana
            <select
              value={startOfWeek}
              onChange={(event) => setStartOfWeek(event.target.value as StartOfWeek)}
            >
              <option value="sunday">Domingo</option>
              <option value="monday">Segunda-feira</option>
            </select>
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Salvando..." : "Salvar e continuar"}
          </button>
        </form>

        {message ? <p className="hint">{message}</p> : null}
      </section>
    </main>
  );
}
