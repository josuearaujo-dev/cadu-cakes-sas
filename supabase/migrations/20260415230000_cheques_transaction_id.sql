-- Vínculo opcional: lançamento gerado automaticamente ao marcar cheque como compensado.

alter table public.cheques add column if not exists transaction_id uuid references public.transactions (id) on delete set null;

create index if not exists idx_cheques_transaction_id on public.cheques (transaction_id);
