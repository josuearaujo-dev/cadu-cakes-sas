-- Cheques de pagamento: destino padrão = fornecedor (quem recebe o cheque).

alter table public.cheques add column if not exists supplier_id uuid references public.suppliers (id) on delete restrict;

create index if not exists idx_cheques_supplier_id on public.cheques (supplier_id);

alter table public.cheques drop constraint if exists cheques_cliente_check;
alter table public.cheques drop constraint if exists cheques_destino_check;

alter table public.cheques add constraint cheques_destino_check
  check (
    supplier_id is not null
    or customer_id is not null
    or (customer_name is not null and length(trim(customer_name)) > 0)
  );
