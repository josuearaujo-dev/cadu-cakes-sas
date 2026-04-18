-- Lançamento em `transactions` gerado ao marcar folha como paga (espelha o fluxo dos cheques).

alter table public.employee_payments
  add column if not exists transaction_id uuid references public.transactions (id) on delete set null;

create index if not exists idx_employee_payments_transaction_id on public.employee_payments (transaction_id);
