export const usdFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export const weeklyCashFlow = [
  { semana: "Sem 1", entradas: 8450, saidas: 6900 },
  { semana: "Sem 2", entradas: 7400, saidas: 8120 },
  { semana: "Sem 3", entradas: 9300, saidas: 7710 },
  { semana: "Sem 4", entradas: 10120, saidas: 8350 },
];

export const expenseByCategory = [
  { name: "Fornecedores", value: 13200 },
  { name: "Equipe", value: 9800 },
  { name: "Impostos", value: 4100 },
  { name: "Operacao", value: 2900 },
];

export const pagamentos = [
  { nome: "Mariana Silva", valor: 1250, status: "Pago", semana: "07/04" },
  { nome: "Ricardo Gomes", valor: 850, status: "Pendente", semana: "07/04" },
  { nome: "Ana Paula", valor: 1100, status: "Pago", semana: "07/04" },
  { nome: "Pedro Santos", valor: 1000, status: "Pago", semana: "07/04" },
  { nome: "Luiza Costa", valor: 900, status: "Pendente", semana: "07/04" },
];

export const eventosCalendario = [
  { dia: "Seg", tipo: "Receita", descricao: "Vendas loja", valor: 1800 },
  { dia: "Ter", tipo: "Despesa", descricao: "Fornecedor farinha", valor: 1200 },
  { dia: "Qua", tipo: "Pagamento", descricao: "Equipe semanal", valor: 2100 },
  { dia: "Qui", tipo: "Conta", descricao: "Energia", valor: 520 },
  { dia: "Sex", tipo: "Cheque", descricao: "Desconto no banco", valor: 760 },
];

export const weeklyChequeUsage = [
  { semana: "07-13 Abr", usados: 3, limite: 5 },
  { semana: "14-20 Abr", usados: 5, limite: 5 },
  { semana: "21-27 Abr", usados: 2, limite: 5 },
  { semana: "28 Abr-04 Mai", usados: 1, limite: 5 },
];

export function buildInsights() {
  const totalReceitas = weeklyCashFlow.reduce((acc, item) => acc + item.entradas, 0);
  const totalDespesas = weeklyCashFlow.reduce((acc, item) => acc + item.saidas, 0);
  const saldoMensal = totalReceitas - totalDespesas;
  const margem = totalReceitas > 0 ? (saldoMensal / totalReceitas) * 100 : 0;
  const semanasNegativas = weeklyCashFlow.filter((item) => item.entradas - item.saidas < 0);

  const piorSemana = weeklyCashFlow.reduce((worst, current) => {
    const currentSaldo = current.entradas - current.saidas;
    const worstSaldo = worst.entradas - worst.saidas;
    return currentSaldo < worstSaldo ? current : worst;
  }, weeklyCashFlow[0]);

  const totalDespesasCategorias = expenseByCategory.reduce((acc, cat) => acc + cat.value, 0);
  const maiorCategoria = expenseByCategory.reduce((max, cat) => (cat.value > max.value ? cat : max), expenseByCategory[0]);
  const shareMaiorCategoria =
    totalDespesasCategorias > 0 ? (maiorCategoria.value / totalDespesasCategorias) * 100 : 0;

  const totalFolha = pagamentos.reduce((acc, pg) => acc + pg.valor, 0);
  const folhaPendente = pagamentos
    .filter((pg) => pg.status === "Pendente")
    .reduce((acc, pg) => acc + pg.valor, 0);

  const pressaoChequesMax = weeklyChequeUsage.reduce(
    (max, week) => Math.max(max, (week.usados / week.limite) * 100),
    0,
  );

  return {
    totalReceitas,
    totalDespesas,
    saldoMensal,
    margem,
    semanasNegativas: semanasNegativas.length,
    piorSemana: {
      nome: piorSemana.semana,
      saldo: piorSemana.entradas - piorSemana.saidas,
    },
    maiorCategoria: {
      nome: maiorCategoria.name,
      valor: maiorCategoria.value,
      share: shareMaiorCategoria,
    },
    totalFolha,
    folhaPendente,
    pressaoChequesMax,
  };
}
