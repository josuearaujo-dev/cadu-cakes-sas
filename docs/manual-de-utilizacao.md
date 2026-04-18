# Manual de Utilização do Sistema - Cadu Cakes Financeiro

Este manual foi feito para ensinar o cliente a usar o sistema no dia a dia, de forma simples e prática.

## 1. Para que serve este sistema

O sistema ajuda a organizar a rotina financeira da empresa em um só lugar.

Com ele, você consegue:

- registrar entradas e saídas;
- controlar cheques por semana;
- acompanhar pagamentos de funcionários;
- visualizar compromissos no calendário;
- analisar resultados e riscos na tela de insights.

## 2. Primeiro acesso (passo a passo)

### 2.1 Entrar no sistema

1. Abra a tela de login em `/auth`.
2. Digite seu e-mail e senha.
3. Clique em `Entrar`.

### 2.2 Cadastro inicial da empresa

Se for o primeiro acesso, o sistema leva você para `/onboarding`.

1. Preencha os dados da empresa.
2. Confirme o cadastro.
3. Após isso, os módulos financeiros serão liberados.

## 3. Como navegar no menu lateral

O menu lateral é retrátil e funciona bem em dispositivos de toque (como iPad).

- quando aberto: mostra nome e ícones dos módulos;
- quando fechado: mostra apenas os ícones.

Módulos principais:

- `Dashboard` (`/`)
- `Insights` (`/insights`)
- `Calendário` (`/calendario`)
- `Cheques` (`/cheques`)
- `Lançamentos` (`/lancamentos`)
- `Pagamentos` (`/pagamentos`)
- `Cadastros & Config.` (`/cadastros`)

## 4. Como usar cada módulo

## 4.1 Dashboard (visão do dia)

Use esta tela para acompanhar a operação diária.

Veja principalmente:

- indicadores rápidos;
- pagamentos pendentes da folha semanal (módulo separado de funcionários);
- contas e compromissos mais próximos;
- movimentações recentes;
- sinais de alerta operacional.

## 4.2 Insights (análise financeira)

Use esta tela para tomar decisão com base em dados.

Acompanhe:

- tendência de resultado;
- pressão de custos;
- pontos de risco financeiro;
- prioridades para correção;
- leitura da folha pendente usando a base separada de `Pagamentos`.

## 4.3 Calendário financeiro

Use para enxergar por dia no mês o que está no **livro caixa** (lançamentos), além de **cheques** e registros da **folha** que caiam naquele dia.

- Use **&lt;** e **&gt;** para mudar o mês; os dados vêm da base (moeda da empresa).
- Nos quadrados do mês: entradas e saídas são somas dos **lançamentos** (cancelados não entram). Se só houver cheques na data, aparece a indicação **Cheques**.
- No detalhe do dia: lista de lançamentos, cheques e pagamentos de funcionário; o **saldo do dia** considera só lançamentos. O botão abre **Lançamentos** já filtrado para aquele dia.

Passo a passo:

1. Clique no dia desejado.
2. O card de detalhe abre sobre o calendário.
3. Para fechar, clique fora do card ou no botão `X`.

## 4.4 Gestão de cheques

Use para controlar cheques por semana (domingo a sábado).

**Fornecedor x cliente:** neste sistema, **fornecedor** é quem você **paga** (compra de insumos, serviços). **Cliente** seria quem **compra de você** (venda). Os cheques de **saída** (pagamento) ficam ligados ao cadastro de **fornecedores**, que é o caso típico da padaria ao pagar fornecedores com cheque.

Passo a passo:

1. Ao abrir a tela no **mês atual**, a **semana de hoje** já vem selecionada (domingo a sábado). Em outros meses, a seleção inicial é a primeira semana daquele mês.
2. Selecione outra semana se quiser.
3. Veja os indicadores da semana:
   - total de cheques;
   - limite semanal (atual: 5);
   - quantidade utilizada.
4. Clique na semana para abrir os detalhes.

### Cadastro de novo cheque

1. Cadastre os **fornecedores** em `Cadastros & Config.` → aba **Fornecedores** (quem recebe o cheque é quem você paga — matéria-prima, serviços, etc.).
2. Na tela de `Cheques`, escolha o **fornecedor** na lista, preencha data e valor.
3. Escolha o status do cheque.
4. Clique em `Registrar cheque`.

Importante:

- O sistema valida automaticamente o limite semanal da empresa.
- Se já houver 5 cheques ativos na semana, o sistema bloqueia novo cadastro.
- A tela sempre mostra quantos cheques ainda estão disponíveis na semana atual.
- **Alterar o status:** na tabela da semana, use o campo **Status** em cada linha; o sistema pede **confirmação** antes de aplicar.
- **Compensar todos:** botão na mesma semana para marcar **Compensado** para todos os cheques ainda **Agendados** (com confirmação).

### Cheques e livro caixa

- O **livro caixa** neste sistema é o módulo **Lançamentos** (e o que o Dashboard consome a partir dele).
- Ao marcar o cheque como **Compensado**, o sistema **cria automaticamente** uma despesa **paga** em Lançamentos (usa a primeira **categoria de despesa ativa**; vale criar uma categoria “Cheques” e ordenar o cadastro se quiser controle fino).
- Se o status sair de **Compensado** para outro, o lançamento gerado é **cancelado** para não duplicar o caixa.

## 4.5 Lançamentos financeiros

Use para registrar entradas e saídas gerais da operação.

### Incluir lançamento

1. Clique em `Novo lançamento`.
2. Preencha os campos no modal.
3. Clique em `Incluir lançamento`.

### Filtrar lançamentos

1. Clique no botão de filtros.
2. Escolha período, tipo e status.
3. Feche o modal para ver a lista atualizada.

### Editar ou anular

- Na tabela, use **Editar** para alterar qualquer campo do lançamento (valor, data, categoria, status, etc.).
- Use **Anular** para marcar o lançamento como **cancelado**; ele deixa de contar nos totais de entradas/despesas/saldo no topo da tela. Na confirmação, o sistema grava o cancelamento; você pode **reabrir com Editar** e mudar o status de volta, se precisar corrigir.

## 4.6 Pagamentos de funcionários

Este módulo é separado dos lançamentos gerais.

Objetivo: controlar folha de pagamento com mais clareza.

Tabela usada no sistema: `employee_payments`.

Passo a passo:

1. Entre em `/pagamentos`.
2. Informe:
   - funcionário;
   - início da semana;
   - valor;
   - status;
   - data de pagamento (opcional);
   - observações (opcional).
3. Clique em `Registrar pagamento`.
4. Confira os totais e a tabela da tela.

### Filtro por semana

Use o campo de semana para listar apenas o período desejado.

## 4.7 Cadastros & Config.

Use este módulo para manter as bases do sistema atualizadas.

Abas disponíveis:

- Funcionários
- Fornecedores (usados também na emissão de cheques — destinatário do pagamento)
- Fontes de Entrada
- Categorias

Recomendação: mantenha os cadastros em dia antes de registrar muitos lançamentos e pagamentos.

Nas tabelas de cada aba (e nas páginas dedicadas em `cadastros/...`), use **+ Novo…** para abrir o **modal** de cadastro (sem campos fixos na página) e **Editar** para o mesmo modal com os dados preenchidos. Em **categorias**, o tipo entrada/despesa não é alterado na edição (evita conflito com lançamentos já feitos).

## 5. Rotina recomendada para o cliente

Para facilitar o uso no dia a dia:

1. começar pelo `Dashboard`;
2. registrar movimentações em `Lançamentos`;
3. atualizar folha em `Pagamentos`;
4. revisar `Cheques` antes de novas emissões;
5. fechar o dia com leitura rápida de `Insights`.

## 6. Dúvidas comuns (soluções rápidas)

- **Não consigo entrar:** verifique e-mail, senha e internet.
- **Fui para onboarding:** sua empresa ainda não foi concluída para este usuário.
- **A lista está vazia:** revise se há filtro ativo.
- **Erro ao salvar:** confira campos obrigatórios e tente novamente.

## 7. Atualizações deste manual

### 2026-04-10

- Manual reescrito em formato didático para treinamento do cliente.
- Inclusão de passo a passo por módulo.
- Reforço do fluxo separado de pagamentos via `employee_payments`.
- Dashboard e Insights atualizados para considerar a folha separada em `Pagamentos`.
- Cheques separados de `Lançamentos` com limite semanal validado no banco.
- Tela de cheques: ao visualizar o mês atual, a semana selecionada por padrão é a semana corrente (a que contém hoje).
- Cheques vinculados a **fornecedores** (pagamentos a quem a empresa compra).
- Migração `cheques` + coluna `supplier_id`: aplicar com `supabase db push` quando atualizar o banco.
- Alteração de status do cheque na tabela; esclarecimento livro caixa vs módulo de cheques.
- Compensação do cheque gera lançamento automático em Lançamentos (e reverte ao mudar o status).

---

## 8. Regra de manutenção do manual

A cada nova implementação funcional no sistema:

1. atualizar o módulo correspondente neste manual;
2. adicionar registro na seção `Atualizações deste manual`;
3. manter os nomes das telas iguais aos nomes mostrados no sistema.
