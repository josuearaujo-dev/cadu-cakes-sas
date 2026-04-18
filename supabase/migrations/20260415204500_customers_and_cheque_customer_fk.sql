create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (user_id) on delete cascade,
  name text not null,
  phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_customers_company_id on public.customers (company_id);

alter table public.cheques add column if not exists customer_id uuid references public.customers (id) on delete restrict;

alter table public.cheques alter column customer_name drop not null;

alter table public.cheques drop constraint if exists cheques_cliente_check;
alter table public.cheques add constraint cheques_cliente_check
  check (
    customer_id is not null
    or (customer_name is not null and length(trim(customer_name)) > 0)
  );

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

alter table public.customers enable row level security;

create policy "Customers read own company"
on public.customers
for select
to authenticated
using (company_id = auth.uid());

create policy "Customers insert own company"
on public.customers
for insert
to authenticated
with check (company_id = auth.uid());

create policy "Customers update own company"
on public.customers
for update
to authenticated
using (company_id = auth.uid())
with check (company_id = auth.uid());
