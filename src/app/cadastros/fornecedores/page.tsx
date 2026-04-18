"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { BrandedFullPageLoader } from "@/components/branded-full-page-loader";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import type { Supplier } from "@/lib/finance/types";
import { createClient } from "@/lib/supabase/client";
import { cadastroDeleteErrorMessage, financeRepository } from "@/lib/supabase/finance-repository";

export default function FornecedoresPage() {
  const router = useRouter();
  const [items, setItems] = useState<Supplier[]>([]);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const data = await financeRepository.listSuppliers(supabase);
      setItems(data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao carregar fornecedores.";
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
    setContactName("");
    setPhone("");
    setNotes("");
    setActive(true);
  }

  function openCreate() {
    setError(null);
    setEditId(null);
    setName("");
    setContactName("");
    setPhone("");
    setNotes("");
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
        await financeRepository.updateSupplier(supabase, editId, {
          name,
          contact_name: contactName || null,
          phone: phone || null,
          notes: notes || null,
          active,
        });
      } else {
        await financeRepository.createSupplier(supabase, {
          name,
          contact_name: contactName || null,
          phone: phone || null,
          notes: notes || null,
          active: true,
        });
      }
      closeModal();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar fornecedor.");
    } finally {
      setLoading(false);
    }
  }

  async function removeRow(item: Supplier) {
    if (
      !window.confirm(
        `Excluir permanentemente o fornecedor "${item.name}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      await financeRepository.deleteSupplier(supabase, item.id);
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
          title="Cadastro de Fornecedores"
          subtitle="Base de parceiros para despesas e compras"
        />

        <section className="card glass table-card">
          <div className="cadastro-table-toolbar">
            <h3>Fornecedores cadastrados</h3>
            <button type="button" className="button-primary-action" onClick={openCreate}>
              + Novo fornecedor
            </button>
          </div>
          <table className="table table-cadastro">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Contato</th>
                <th>Telefone</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.contact_name || "-"}</td>
                  <td>{item.phone || "-"}</td>
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
                          setContactName(item.contact_name ?? "");
                          setPhone(item.phone ?? "");
                          setNotes(item.notes ?? "");
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
              <h3>{editId ? "Editar fornecedor" : "Novo fornecedor"}</h3>
              <p className="hint" style={{ marginBottom: 10 }}>
                Os cheques emitidos para pagamento são vinculados a este cadastro (fornecedor que recebe o cheque).
              </p>
              <form className="auth-form form-compact" onSubmit={onSubmit}>
                <label>
                  Nome
                  <input value={name} onChange={(e) => setName(e.target.value)} required />
                </label>
                <label>
                  Contato
                  <input value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </label>
                <label>
                  Telefone
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} />
                </label>
                <label>
                  Observações
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} />
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
