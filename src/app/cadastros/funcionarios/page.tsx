"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BrandedFullPageLoader } from "@/components/branded-full-page-loader";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { moneyDraftFromNumber, parseMoneyInput, sanitizeMoneyDraft } from "@/lib/amount-input";
import type { Employee } from "@/lib/finance/types";
import { createClient } from "@/lib/supabase/client";
import { cadastroDeleteErrorMessage, financeRepository } from "@/lib/supabase/finance-repository";

export default function FuncionariosPage() {
  const router = useRouter();
  const [items, setItems] = useState<Employee[]>([]);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [weeklySalaryInput, setWeeklySalaryInput] = useState("");
  const [active, setActive] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const data = await financeRepository.listEmployees(supabase);
      setItems(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao carregar funcionários.";
      if (message.includes("Empresa não encontrada")) {
        router.push("/onboarding");
        return;
      }
      setError(message);
    } finally {
      setPageReady((done) => done || true);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const parsedWeeklySalary = useMemo(() => parseMoneyInput(weeklySalaryInput), [weeklySalaryInput]);
  const weeklySalaryValid = parsedWeeklySalary !== null && parsedWeeklySalary >= 0;

  function closeModal() {
    setShowModal(false);
    setEditId(null);
    setName("");
    setRole("");
    setWeeklySalaryInput("");
    setActive(true);
  }

  function openCreate() {
    setError(null);
    setEditId(null);
    setName("");
    setRole("");
    setWeeklySalaryInput("");
    setActive(true);
    setShowModal(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const weeklySalary = parseMoneyInput(weeklySalaryInput);
      if (weeklySalary === null || weeklySalary < 0) {
        throw new Error("Informe um salário válido (número ≥ 0).");
      }
      const supabase = createClient();
      if (editId) {
        await financeRepository.updateEmployee(supabase, editId, {
          name,
          role: role || null,
          weekly_salary: weeklySalary,
          active,
        });
      } else {
        await financeRepository.createEmployee(supabase, {
          name,
          role: role || null,
          weekly_salary: weeklySalary,
          active: true,
        });
      }
      closeModal();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar funcionário.");
    } finally {
      setLoading(false);
    }
  }

  async function removeRow(item: Employee) {
    if (
      !window.confirm(
        `Excluir permanentemente o funcionário "${item.name}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      await financeRepository.deleteEmployee(supabase, item.id);
      if (editId === item.id) closeModal();
      await load();
    } catch (e) {
      setError(cadastroDeleteErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  if (!pageReady) {
    return <BrandedFullPageLoader />;
  }

  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar
          title="Cadastro de Funcionários"
          subtitle="Base de colaboradores para folha e pagamentos"
        />

        <section className="card glass table-card">
          <div className="cadastro-table-toolbar">
            <h3>Funcionários cadastrados</h3>
            <button type="button" className="button-primary-action" onClick={openCreate}>
              + Novo funcionário
            </button>
          </div>
          <table className="table table-cadastro">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Cargo</th>
                <th>Salário semanal</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.role || "-"}</td>
                  <td>{item.weekly_salary.toFixed(2)}</td>
                  <td>{item.active ? "Ativo" : "Inativo"}</td>
                  <td>
                    <div className="cadastro-row-actions">
                      <button
                        type="button"
                        className="button-secondary-action"
                        onClick={() => {
                          setError(null);
                          setEditId(item.id);
                          setName(item.name);
                          setRole(item.role ?? "");
                          setWeeklySalaryInput(moneyDraftFromNumber(Number(item.weekly_salary)) || "0");
                          setActive(item.active);
                          setShowModal(true);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="button-cadastro-delete"
                        disabled={loading}
                        onClick={() => void removeRow(item)}
                      >
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {error && !showModal ? <p className="hint danger" style={{ marginTop: 12 }}>{error}</p> : null}

        {showModal ? (
          <div className="modal-overlay" onClick={() => !loading && closeModal()}>
            <section className="modal-card glass" onClick={(e) => e.stopPropagation()}>
              <h3>{editId ? "Editar funcionário" : "Novo funcionário"}</h3>
              <form className="auth-form form-compact" onSubmit={onSubmit}>
                <label>
                  Nome
                  <input value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label>
                  Cargo
                  <input value={role} onChange={(e) => setRole(e.target.value)} />
                </label>
                <label>
                  Salário semanal
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0,00"
                    value={weeklySalaryInput}
                    onChange={(e) => setWeeklySalaryInput(sanitizeMoneyDraft(e.target.value))}
                  />
                </label>
                {editId ? (
                  <label className="checkbox-inline">
                    <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                    Ativo no sistema
                  </label>
                ) : null}
                <div className="modal-actions">
                  <button type="button" className="button-cancel" onClick={() => !loading && closeModal()}>
                    Cancelar
                  </button>
                  <button type="submit" className="button-confirm" disabled={loading || !weeklySalaryValid}>
                    {loading ? "Salvando..." : editId ? "Salvar" : "Cadastrar"}
                  </button>
                </div>
              </form>
              {error ? <p className="hint danger">{error}</p> : null}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
