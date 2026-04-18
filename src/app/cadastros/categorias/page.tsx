"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BrandedFullPageLoader } from "@/components/branded-full-page-loader";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import type { Category, CategoryType } from "@/lib/finance/types";
import { createClient } from "@/lib/supabase/client";
import { cadastroDeleteErrorMessage, financeRepository } from "@/lib/supabase/finance-repository";

export default function CategoriasPage() {
  const router = useRouter();
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [active, setActive] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const data = await financeRepository.listCategories(supabase);
      setItems(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao carregar categorias.";
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
    setType("expense");
    setActive(true);
  }

  function openCreate() {
    setError(null);
    setEditId(null);
    setName("");
    setType("expense");
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
        await financeRepository.updateCategory(supabase, editId, {
          name,
          active,
        });
      } else {
        await financeRepository.createCategory(supabase, {
          name,
          type,
          active: true,
        });
      }
      closeModal();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar categoria.");
    } finally {
      setLoading(false);
    }
  }

  async function removeRow(item: Category) {
    if (
      !window.confirm(
        `Excluir permanentemente a categoria "${item.name}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      await financeRepository.deleteCategory(supabase, item.id);
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
          title="Categorias Financeiras"
          subtitle="Poucas categorias largas costumam chegar — não precisa micro‑classificar tudo"
        />

        <section className="card glass table-card">
          <p className="hint" style={{ margin: 0, padding: "16px 22px 0" }}>
            Para <strong>despesas</strong>, exemplos simples: <strong>Fornecedores</strong>,{" "}
            <strong>Pagamento de funcionários</strong>, <strong>Contas da casa</strong>. Para{" "}
            <strong>entradas</strong> (tipo Entrada), pode alinhar às mesmas ideias das fontes ou usar uma categoria
            genérica “Vendas”.
          </p>
          <div className="cadastro-table-toolbar">
            <h3>Categorias cadastradas</h3>
            <button type="button" className="button-primary-action" onClick={openCreate}>
              + Nova categoria
            </button>
          </div>
          <table className="table table-cadastro">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.type === "income" ? "Entrada" : "Despesa"}</td>
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
                          setType(item.type);
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
              <h3>{editId ? "Editar categoria" : "Nova categoria"}</h3>
              {editId ? (
                <p className="hint" style={{ marginBottom: 10 }}>
                  O tipo (entrada/despesa) não pode ser alterado aqui para não conflitar com lançamentos já
                  classificados. Crie outra categoria se precisar de outro tipo.
                </p>
              ) : (
                <p className="hint" style={{ marginBottom: 10 }}>
                  Prefira nomes curtos e genéricos; o detalhe (fornecedor, funcionário, nota) fica no lançamento e nos
                  cadastros vinculados.
                </p>
              )}
              <form className="auth-form form-compact" onSubmit={onSubmit}>
                <label>
                  Nome
                  <input value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label>
                  Tipo
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as CategoryType)}
                    disabled={Boolean(editId)}
                  >
                    <option value="expense">Despesa</option>
                    <option value="income">Entrada</option>
                  </select>
                </label>
                {editId ? (
                  <label className="checkbox-inline">
                    <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                    Ativa no sistema
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
