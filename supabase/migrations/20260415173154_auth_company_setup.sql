create extension if not exists pgcrypto;

create table if not exists public.companies (
  user_id uuid primary key references auth.users (id) on delete cascade,
  company_name text not null,
  weekly_cheque_limit integer not null default 5 check (weekly_cheque_limit > 0),
  currency text not null default 'USD',
  start_of_week text not null default 'sunday' check (start_of_week in ('sunday', 'monday')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.companies enable row level security;

create policy "Users can read own company"
on public.companies
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own company"
on public.companies
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own company"
on public.companies
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_companies_updated_at on public.companies;

create trigger trg_companies_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();
