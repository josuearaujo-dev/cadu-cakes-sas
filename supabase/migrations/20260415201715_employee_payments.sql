create table if not exists public.employee_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (user_id) on delete cascade,
  employee_id uuid not null references public.employees (id) on delete restrict,
  week_start date not null,
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  payment_date date,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_employee_payments_company_id on public.employee_payments (company_id);
create index if not exists idx_employee_payments_week_start on public.employee_payments (week_start);
create index if not exists idx_employee_payments_status on public.employee_payments (status);

drop trigger if exists trg_employee_payments_updated_at on public.employee_payments;
create trigger trg_employee_payments_updated_at
before update on public.employee_payments
for each row
execute function public.set_updated_at();

alter table public.employee_payments enable row level security;

create policy "Employee payments read own company"
on public.employee_payments
for select
to authenticated
using (company_id = auth.uid());

create policy "Employee payments insert own company"
on public.employee_payments
for insert
to authenticated
with check (company_id = auth.uid());

create policy "Employee payments update own company"
on public.employee_payments
for update
to authenticated
using (company_id = auth.uid())
with check (company_id = auth.uid());
