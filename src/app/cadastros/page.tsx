"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { BrandedFullPageLoader } from "@/components/branded-full-page-loader";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { moneyDraftFromNumber, parseMoneyInput, sanitizeMoneyDraft } from "@/lib/amount-input";
import type { Category, CategoryType, Employee, IncomeSource, Supplier } from "@/lib/finance/types";
import { createClient } from "@/lib/supabase/client";
import { cadastroDeleteErrorMessage, financeRepository } from "@/lib/supabase/finance-repository";

type TabId = "funcionarios" | "fornecedores" | "fontes" | "categorias";

export default function CadastrosPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("funcionarios");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageReady, setPageReady] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [employeeName, setEmployeeName] = useState("");
  const [employeeRole, setEmployeeRole] = useState("");
  const [employeeHourlyRateInput, setEmployeeHourlyRateInput] = useState("");

  const [supplierName, setSupplierName] = useState("");
  const [supplierContact, setSupplierContact] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierNotes, setSupplierNotes] = useState("");

  const [sourceName, setSourceName] = useState("");
  const [sourceDescription, setSourceDescription] = useState("");

  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<CategoryType>("expense");

  const [employeeEditId, setEmployeeEditId] = useState<string | null>(null);
  const [employeeActive, setEmployeeActive] = useState(true);
  const [supplierEditId, setSupplierEditId] = useState<string | null>(null);
  const [supplierActive, setSupplierActive] = useState(true);
  const [sourceEditId, setSourceEditId] = useState<string | null>(null);
  const [sourceActive, setSourceActive] = useState(true);
  const [categoryEditId, setCategoryEditId] = useState<string | null>(null);
  const [categoryActive, setCategoryActive] = useState(true);

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const parsedEmployeeHourlyRate = useMemo(
    () => parseMoneyInput(employeeHourlyRateInput),
    [employeeHourlyRateInput],
  );
  const employeeHourlyRateValid = parsedEmployeeHourlyRate !== null && parsedEmployeeHourlyRate >= 0;

  const tabs = useMemo(
    () => [
      { id: "funcionarios" as const, label: "Funcionários" },
      { id: "fornecedores" as const, label: "Fornecedores" },
      { id: "fontes" as const, label: "Fontes de Entrada" },
      { id: "categorias" as const, label: "Categorias" },
    ],
    [],
  );

  const loadAll = useCallback(async () => {
    try {
      const supabase = createClient();
      const [employeeData, supplierData, sourceData, categoryData] = await Promise.all([
        financeRepository.listEmployees(supabase),
        financeRepository.listSuppliers(supabase),
        financeRepository.listIncomeSources(supabase),
        financeRepository.listCategories(supabase),
      ]);
      setEmployees(employeeData);
      setSuppliers(supplierData);
      setIncomeSources(sourceData);
      setCategories(categoryData);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao carregar cadastros.";
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
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    setError(null);
    setShowEmployeeModal(false);
    setShowSupplierModal(false);
    setShowSourceModal(false);
    setShowCategoryModal(false);
  }, [activeTab]);

  function resetEmployeeForm() {
    setShowEmployeeModal(false);
    setEmployeeEditId(null);
    setEmployeeName("");
    setEmployeeRole("");
    setEmployeeHourlyRateInput("");
    setEmployeeActive(true);
  }

  function openEmployeeCreate() {
    setError(null);
    setEmployeeEditId(null);
    setEmployeeName("");
    setEmployeeRole("");
    setEmployeeHourlyRateInput("");
    setEmployeeActive(true);
    setShowEmployeeModal(true);
  }

  function resetSupplierForm() {
    setShowSupplierModal(false);
    setSupplierEditId(null);
    setSupplierName("");
    setSupplierContact("");
    setSupplierPhone("");
    setSupplierNotes("");
    setSupplierActive(true);
  }

  function openSupplierCreate() {
    setError(null);
    setSupplierEditId(null);
    setSupplierName("");
    setSupplierContact("");
    setSupplierPhone("");
    setSupplierNotes("");
    setSupplierActive(true);
    setShowSupplierModal(true);
  }

  function resetSourceForm() {
    setShowSourceModal(false);
    setSourceEditId(null);
    setSourceName("");
    setSourceDescription("");
    setSourceActive(true);
  }

  function openSourceCreate() {
    setError(null);
    setSourceEditId(null);
    setSourceName("");
    setSourceDescription("");
    setSourceActive(true);
    setShowSourceModal(true);
  }

  function resetCategoryForm() {
    setShowCategoryModal(false);
    setCategoryEditId(null);
    setCategoryName("");
    setCategoryType("expense");
    setCategoryActive(true);
  }

  function openCategoryCreate() {
    setError(null);
    setCategoryEditId(null);
    setCategoryName("");
    setCategoryType("expense");
    setCategoryActive(true);
    setShowCategoryModal(true);
  }

  async function submitEmployee(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const hourlyRate = parseMoneyInput(employeeHourlyRateInput);
      if (hourlyRate === null || hourlyRate < 0) {
        throw new Error("Informe um valor/hora válido (número ≥ 0).");
      }
      const supabase = createClient();
      if (employeeEditId) {
        await financeRepository.updateEmployee(supabase, employeeEditId, {
          name: employeeName,
          role: employeeRole || null,
          hourly_rate: hourlyRate,
          active: employeeActive,
        });
      } else {
        await financeRepository.createEmployee(supabase, {
          name: employeeName,
          role: employeeRole || null,
          hourly_rate: hourlyRate,
          active: true,
        });
      }
      resetEmployeeForm();
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar funcionário.");
    } finally {
      setLoading(false);
    }
  }

  async function submitSupplier(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      if (supplierEditId) {
        await financeRepository.updateSupplier(supabase, supplierEditId, {
          name: supplierName,
          contact_name: supplierContact || null,
          phone: supplierPhone || null,
          notes: supplierNotes || null,
          active: supplierActive,
        });
      } else {
        await financeRepository.createSupplier(supabase, {
          name: supplierName,
          contact_name: supplierContact || null,
          phone: supplierPhone || null,
          notes: supplierNotes || null,
          active: true,
        });
      }
      resetSupplierForm();
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar fornecedor.");
    } finally {
      setLoading(false);
    }
  }

  async function submitSource(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      if (sourceEditId) {
        await financeRepository.updateIncomeSource(supabase, sourceEditId, {
          name: sourceName,
          description: sourceDescription || null,
          active: sourceActive,
        });
      } else {
        await financeRepository.createIncomeSource(supabase, {
          name: sourceName,
          description: sourceDescription || null,
          active: true,
        });
      }
      resetSourceForm();
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar fonte.");
    } finally {
      setLoading(false);
    }
  }

  async function submitCategory(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      if (categoryEditId) {
        await financeRepository.updateCategory(supabase, categoryEditId, {
          name: categoryName,
          active: categoryActive,
        });
      } else {
        await financeRepository.createCategory(supabase, {
          name: categoryName,
          type: categoryType,
          active: true,
        });
      }
      resetCategoryForm();
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar categoria.");
    } finally {
      setLoading(false);
    }
  }

  async function removeEmployee(item: Employee) {
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
      if (employeeEditId === item.id) resetEmployeeForm();
      await loadAll();
    } catch (e) {
      setError(cadastroDeleteErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function removeSupplier(item: Supplier) {
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
      if (supplierEditId === item.id) resetSupplierForm();
      await loadAll();
    } catch (e) {
      setError(cadastroDeleteErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function removeIncomeSource(item: IncomeSource) {
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
      if (sourceEditId === item.id) resetSourceForm();
      await loadAll();
    } catch (e) {
      setError(cadastroDeleteErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  async function removeCategory(item: Category) {
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
      if (categoryEditId === item.id) resetCategoryForm();
      await loadAll();
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
          title="Cadastros & Configurações"
          subtitle="Fontes e categorias podem ser poucas e genéricas — o sistema não exige plano de contas detalhado"
        />

        <section className="card glass" style={{ marginBottom: 14 }}>
          <div className="tab-row">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`tab-pill ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {activeTab === "funcionarios" ? (
          <>
            <section className="card glass table-card">
              <div className="cadastro-table-toolbar">
                <h3>Funcionários</h3>
                <button type="button" className="button-primary-action" onClick={openEmployeeCreate}>
                  + Novo funcionário
                </button>
              </div>
              <table className="table table-cadastro">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Cargo</th>
                    <th>Valor/hora</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.role || "-"}</td>
                      <td>{item.hourly_rate.toFixed(2)}</td>
                      <td>{item.active ? "Ativo" : "Inativo"}</td>
                      <td>
                        <div className="cadastro-row-actions">
                          <button
                            type="button"
                            className="button-secondary-action"
                            onClick={() => {
                              setError(null);
                              setEmployeeEditId(item.id);
                              setEmployeeName(item.name);
                              setEmployeeRole(item.role ?? "");
                              setEmployeeHourlyRateInput(
                                moneyDraftFromNumber(Number(item.hourly_rate)) || "0",
                              );
                              setEmployeeActive(item.active);
                              setShowEmployeeModal(true);
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="button-cadastro-delete"
                            disabled={loading}
                            onClick={() => void removeEmployee(item)}
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
          </>
        ) : null}

        {activeTab === "fornecedores" ? (
          <>
            <section className="card glass table-card">
              <div className="cadastro-table-toolbar">
                <h3>Fornecedores</h3>
                <button type="button" className="button-primary-action" onClick={openSupplierCreate}>
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
                  {suppliers.map((item) => (
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
                              setSupplierEditId(item.id);
                              setSupplierName(item.name);
                              setSupplierContact(item.contact_name ?? "");
                              setSupplierPhone(item.phone ?? "");
                              setSupplierNotes(item.notes ?? "");
                              setSupplierActive(item.active);
                              setShowSupplierModal(true);
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="button-cadastro-delete"
                            disabled={loading}
                            onClick={() => void removeSupplier(item)}
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
          </>
        ) : null}

        {activeTab === "fontes" ? (
          <>
            <section className="card glass table-card">
              <p className="hint" style={{ margin: 0, padding: "16px 22px 0" }}>
                Ex.: <strong>Dinheiro</strong>, <strong>Cartão</strong>, <strong>Delivery</strong>, <strong>Salão</strong>
                . Uma linha no livro pode usar a <strong>descrição</strong> para o detalhe.
              </p>
              <div className="cadastro-table-toolbar">
                <h3>Fontes de entrada</h3>
                <button type="button" className="button-primary-action" onClick={openSourceCreate}>
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
                  {incomeSources.map((item) => (
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
                              setSourceEditId(item.id);
                              setSourceName(item.name);
                              setSourceDescription(item.description ?? "");
                              setSourceActive(item.active);
                              setShowSourceModal(true);
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="button-cadastro-delete"
                            disabled={loading}
                            onClick={() => void removeIncomeSource(item)}
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
          </>
        ) : null}

        {activeTab === "categorias" ? (
          <>
            <section className="card glass table-card">
              <p className="hint" style={{ margin: 0, padding: "16px 22px 0" }}>
                Para <strong>saídas</strong>, basta o essencial: ex. <strong>Fornecedores</strong>,{" "}
                <strong>Pagamento de funcionários</strong>. Para <strong>entradas</strong> (tipo Entrada), categorias
                largas como <strong>Vendas</strong> são suficientes se já usar fontes genéricas.
              </p>
              <div className="cadastro-table-toolbar">
                <h3>Categorias</h3>
                <button type="button" className="button-primary-action" onClick={openCategoryCreate}>
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
                  {categories.map((item) => (
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
                              setCategoryEditId(item.id);
                              setCategoryName(item.name);
                              setCategoryType(item.type);
                              setCategoryActive(item.active);
                              setShowCategoryModal(true);
                            }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="button-cadastro-delete"
                            disabled={loading}
                            onClick={() => void removeCategory(item)}
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
          </>
        ) : null}

        {showEmployeeModal ? (
          <div className="modal-overlay" onClick={() => !loading && resetEmployeeForm()}>
            <section className="modal-card glass" onClick={(e) => e.stopPropagation()}>
              <h3>{employeeEditId ? "Editar funcionário" : "Novo funcionário"}</h3>
              <form className="auth-form form-compact" onSubmit={submitEmployee}>
                <label>
                  Nome
                  <input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} required />
                </label>
                <label>
                  Cargo
                  <input value={employeeRole} onChange={(e) => setEmployeeRole(e.target.value)} />
                </label>
                <label>
                  Valor da hora
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0,00"
                    value={employeeHourlyRateInput}
                    onChange={(e) => setEmployeeHourlyRateInput(sanitizeMoneyDraft(e.target.value))}
                  />
                </label>
                {employeeEditId ? (
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={employeeActive}
                      onChange={(e) => setEmployeeActive(e.target.checked)}
                    />
                    Ativo no sistema
                  </label>
                ) : null}
                <div className="modal-actions">
                  <button type="button" className="button-cancel" onClick={() => !loading && resetEmployeeForm()}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="button-confirm"
                    disabled={loading || !employeeHourlyRateValid}
                  >
                    {loading ? "Salvando..." : employeeEditId ? "Salvar" : "Cadastrar"}
                  </button>
                </div>
              </form>
              {error && activeTab === "funcionarios" ? <p className="hint danger">{error}</p> : null}
            </section>
          </div>
        ) : null}

        {showSupplierModal ? (
          <div className="modal-overlay" onClick={() => !loading && resetSupplierForm()}>
            <section className="modal-card glass" onClick={(e) => e.stopPropagation()}>
              <h3>{supplierEditId ? "Editar fornecedor" : "Novo fornecedor"}</h3>
              <p className="hint" style={{ marginBottom: 10 }}>
                Os cheques emitidos para pagamento são vinculados a este cadastro (fornecedor que recebe o cheque).
              </p>
              <form className="auth-form form-compact" onSubmit={submitSupplier}>
                <label>
                  Nome
                  <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
                </label>
                <label>
                  Contato
                  <input value={supplierContact} onChange={(e) => setSupplierContact(e.target.value)} />
                </label>
                <label>
                  Telefone
                  <input value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)} />
                </label>
                <label>
                  Observações
                  <input value={supplierNotes} onChange={(e) => setSupplierNotes(e.target.value)} />
                </label>
                {supplierEditId ? (
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={supplierActive}
                      onChange={(e) => setSupplierActive(e.target.checked)}
                    />
                    Ativo no sistema
                  </label>
                ) : null}
                <div className="modal-actions">
                  <button type="button" className="button-cancel" onClick={() => !loading && resetSupplierForm()}>
                    Cancelar
                  </button>
                  <button type="submit" className="button-confirm" disabled={loading}>
                    {loading ? "Salvando..." : supplierEditId ? "Salvar" : "Cadastrar"}
                  </button>
                </div>
              </form>
              {error && activeTab === "fornecedores" ? <p className="hint danger">{error}</p> : null}
            </section>
          </div>
        ) : null}

        {showSourceModal ? (
          <div className="modal-overlay" onClick={() => !loading && resetSourceForm()}>
            <section className="modal-card glass" onClick={(e) => e.stopPropagation()}>
              <h3>{sourceEditId ? "Editar fonte de entrada" : "Nova fonte de entrada"}</h3>
              <p className="hint" style={{ marginBottom: 12 }}>
                Use poucos nomes amplos (ex. Dinheiro, Cartão, Delivery). No lançamento, o <strong>método de pagamento</strong>{" "}
                continua disponível para caixa e banco.
              </p>
              <form className="auth-form form-compact" onSubmit={submitSource}>
                <label>
                  Nome
                  <input value={sourceName} onChange={(e) => setSourceName(e.target.value)} required />
                </label>
                <label>
                  Descrição
                  <input value={sourceDescription} onChange={(e) => setSourceDescription(e.target.value)} />
                </label>
                {sourceEditId ? (
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={sourceActive}
                      onChange={(e) => setSourceActive(e.target.checked)}
                    />
                    Ativo no sistema
                  </label>
                ) : null}
                <div className="modal-actions">
                  <button type="button" className="button-cancel" onClick={() => !loading && resetSourceForm()}>
                    Cancelar
                  </button>
                  <button type="submit" className="button-confirm" disabled={loading}>
                    {loading ? "Salvando..." : sourceEditId ? "Salvar" : "Cadastrar"}
                  </button>
                </div>
              </form>
              {error && activeTab === "fontes" ? <p className="hint danger">{error}</p> : null}
            </section>
          </div>
        ) : null}

        {showCategoryModal ? (
          <div className="modal-overlay" onClick={() => !loading && resetCategoryForm()}>
            <section className="modal-card glass" onClick={(e) => e.stopPropagation()}>
              <h3>{categoryEditId ? "Editar categoria" : "Nova categoria"}</h3>
              {categoryEditId ? (
                <p className="hint" style={{ marginBottom: 10 }}>
                  O tipo (entrada/despesa) não pode ser alterado aqui para não conflitar com lançamentos já
                  classificados. Crie outra categoria se precisar de outro tipo.
                </p>
              ) : (
                <p className="hint" style={{ marginBottom: 10 }}>
                  Despesas: ex. <strong>Fornecedores</strong>, <strong>Pagamento de funcionários</strong>. Entradas:
                  nomes largos ou alinhados às fontes — sem obrigar micro‑categorias.
                </p>
              )}
              <form className="auth-form form-compact" onSubmit={submitCategory}>
                <label>
                  Nome
                  <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} required />
                </label>
                <label>
                  Tipo
                  <select
                    value={categoryType}
                    onChange={(e) => setCategoryType(e.target.value as CategoryType)}
                    disabled={Boolean(categoryEditId)}
                  >
                    <option value="expense">Despesa</option>
                    <option value="income">Entrada</option>
                  </select>
                </label>
                {categoryEditId ? (
                  <label className="checkbox-inline">
                    <input
                      type="checkbox"
                      checked={categoryActive}
                      onChange={(e) => setCategoryActive(e.target.checked)}
                    />
                    Ativa no sistema
                  </label>
                ) : null}
                <div className="modal-actions">
                  <button type="button" className="button-cancel" onClick={() => !loading && resetCategoryForm()}>
                    Cancelar
                  </button>
                  <button type="submit" className="button-confirm" disabled={loading}>
                    {loading ? "Salvando..." : categoryEditId ? "Salvar" : "Cadastrar"}
                  </button>
                </div>
              </form>
              {error && activeTab === "categorias" ? <p className="hint danger">{error}</p> : null}
            </section>
          </div>
        ) : null}

        {error &&
        !showEmployeeModal &&
        !showSupplierModal &&
        !showSourceModal &&
        !showCategoryModal ? (
          <p className="hint danger" style={{ marginTop: 12 }}>
            {error}
          </p>
        ) : null}
      </main>
    </div>
  );
}
