"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BrandedFullPageLoader } from "@/components/branded-full-page-loader";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import type { IncomeSource } from "@/lib/finance/types";
import { createClient } from "@/lib/supabase/client";
import { cadastroDeleteErrorMessage, financeRepository } from "@/lib/supabase/finance-repository";

export default function FontesEntradaPage() {
  const router = useRouter();
  const [items, setItems] = useState<IncomeSource[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const data = await financeRepository.listIncomeSources(supabase);
      setItems(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao carregar fontes de entrada.";
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

  function closeModal() {
    setShowModal(false);
    setEditId(null);
    setName("");
    setDescription("");
    setActive(true);
  }

  function openCreate() {
    setError(null);
    setEditId(null);
    setName("");
    setDescription("");
    setActive(true);
    setShowModal(true);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      if (editId) {
        await financeRepository.updateIncomeSource(supabase, editId, {
          name,
          description: description || null,
          active,
        });
      } else {
        await financeRepository.createIncomeSource(supabase, {
          name,
          description: description || null,
          active: true,
        });
      }
      closeModal();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar fonte de entrada.");
    } finally {
      setLoading(false);
    }
  }

  async function removeRow(item: IncomeSource) {
    if (
      !window.confirm(
        `Excluir permanentemente a fonte de entrada "${item.name}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      await financeRepository.deleteIncomeSource(supabase, item.id);
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
          title="Fontes de Entrada"
          subtitle="Agrupe as receitas do modo que preferir — poucos nomes genéricos bastam"
        />

        <section className="card glass table-card">
          <p className="hint" style={{ margin: 0, padding: "16px 22px 0" }}>
            Exemplos práticos: <strong>Dinheiro</strong>, <strong>Cartão</strong>, <strong>Delivery</strong>,{" "}
            <strong>Salão</strong>. Não precisa de uma fonte por produto: use a <strong>descrição</strong> do lançamento
            para o pormenor.
          </p>
          <div className="cadastro-table-toolbar">
            <h3>Fontes cadastradas</h3>
            <button type="button" className="button-primary-action" onClick={openCreate}>
              + Nova fonte
            </button>
          </div>
          <table className="table table-cadastro">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Descrição</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.description || "-"}</td>
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
                          setDescription(item.description ?? "");
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
              <h3>{editId ? "Editar fonte de entrada" : "Nova fonte de entrada"}</h3>
              <p className="hint" style={{ marginBottom: 12 }}>
                Cada fonte é só um rótulo para agrupar entradas no relatório. No lançamento continua a haver{" "}
                <strong>método de pagamento</strong> (dinheiro, transferência, cheque) para o fluxo de caixa.
              </p>
              <form className="auth-form form-compact" onSubmit={onSubmit}>
                <label>
                  Nome
                  <input value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label>
                  Descrição
                  <input value={description} onChange={(e) => setDescription(e.target.value)} />
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
                  <button type="submit" className="button-confirm" disabled={loading}>
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
