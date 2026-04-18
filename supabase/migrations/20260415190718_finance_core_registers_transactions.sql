create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (user_id) on delete cascade,
  name text not null,
  role text,
  weekly_salary numeric(12, 2) not null default 0 check (weekly_salary >= 0),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (user_id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.income_sources (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (user_id) on delete cascade,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (user_id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (company_id, name, type)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (user_id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null check (amount > 0),
  category_id uuid not null references public.categories (id),
  employee_id uuid references public.employees (id),
  supplier_id uuid references public.suppliers (id),
  income_source_id uuid references public.income_sources (id),
  payment_method text not null check (payment_method in ('cash', 'transfer', 'cheque')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  transaction_date date not null,
  due_date date,
  paid_at timestamptz,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check ((payment_method <> 'cheque') or due_date is not null),
  check ((type <> 'income') or income_source_id is not null)
);

create index if not exists idx_employees_company_id on public.employees (company_id);
create index if not exists idx_suppliers_company_id on public.suppliers (company_id);
create index if not exists idx_income_sources_company_id on public.income_sources (company_id);
create index if not exists idx_categories_company_id on public.categories (company_id);
create index if not exists idx_transactions_company_id on public.transactions (company_id);
create index if not exists idx_transactions_transaction_date on public.transactions (transaction_date);
create index if not exists idx_transactions_status on public.transactions (status);

create or replace function public.validate_transaction_links()
returns trigger
language plpgsql
as $$
declare
  category_type text;
begin
  select c.type
  into category_type
  from public.categories c
  where c.id = new.category_id;

  if category_type is null then
    raise exception 'Categoria inválida para transação.';
  end if;

  if category_type <> new.type then
    raise exception 'Tipo da categoria (%) incompatível com tipo da transação (%).', category_type, new.type;
  end if;

  if new.type = 'expense' and new.income_source_id is not null then
    raise exception 'Transação de despesa não pode ter income_source_id.';
  end if;

  if new.type = 'income' and (new.supplier_id is not null or new.employee_id is not null) then
    raise exception 'Transação de entrada não pode vincular fornecedor ou funcionário.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_transaction_links on public.transactions;
create trigger trg_validate_transaction_links
before insert or update on public.transactions
for each row
execute function public.validate_transaction_links();

drop trigger if exists trg_employees_updated_at on public.employees;
create trigger trg_employees_updated_at
before update on public.employees
for each row
execute function public.set_updated_at();

drop trigger if exists trg_suppliers_updated_at on public.suppliers;
create trigger trg_suppliers_updated_at
before update on public.suppliers
for each row
execute function public.set_updated_at();

drop trigger if exists trg_income_sources_updated_at on public.income_sources;
create trigger trg_income_sources_updated_at
before update on public.income_sources
for each row
execute function public.set_updated_at();

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row
execute function public.set_updated_at();

drop trigger if exists trg_transactions_updated_at on public.transactions;
create trigger trg_transactions_updated_at
before update on public.transactions
for each row
execute function public.set_updated_at();

alter table public.employees enable row level security;
alter table public.suppliers enable row level security;
alter table public.income_sources enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create policy "Employees read own company"
on public.employees
for select
to authenticated
using (company_id = auth.uid());

create policy "Employees insert own company"
on public.employees
for insert
to authenticated
with check (company_id = auth.uid());

create policy "Employees update own company"
on public.employees
for update
to authenticated
using (company_id = auth.uid())
with check (company_id = auth.uid());

create policy "Suppliers read own company"
on public.suppliers
for select
to authenticated
using (company_id = auth.uid());

create policy "Suppliers insert own company"
on public.suppliers
for insert
to authenticated
with check (company_id = auth.uid());

create policy "Suppliers update own company"
on public.suppliers
for update
to authenticated
using (company_id = auth.uid())
with check (company_id = auth.uid());

create policy "Income sources read own company"
on public.income_sources
for select
to authenticated
using (company_id = auth.uid());

create policy "Income sources insert own company"
on public.income_sources
for insert
to authenticated
with check (company_id = auth.uid());

create policy "Income sources update own company"
on public.income_sources
for update
to authenticated
using (company_id = auth.uid())
with check (company_id = auth.uid());

create policy "Categories read own company"
on public.categories
for select
to authenticated
using (company_id = auth.uid());

create policy "Categories insert own company"
on public.categories
for insert
to authenticated
with check (company_id = auth.uid());

create policy "Categories update own company"
on public.categories
for update
to authenticated
using (company_id = auth.uid())
with check (company_id = auth.uid());

create policy "Transactions read own company"
on public.transactions
for select
to authenticated
using (company_id = auth.uid());

create policy "Transactions insert own company"
on public.transactions
for insert
to authenticated
with check (company_id = auth.uid());

create policy "Transactions update own company"
on public.transactions
for update
to authenticated
using (company_id = auth.uid())
with check (company_id = auth.uid());
