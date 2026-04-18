create table if not exists public.cheques (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (user_id) on delete cascade,
  cheque_date date not null,
  customer_name text not null,
  amount numeric(12, 2) not null check (amount > 0),
  status text not null default 'scheduled' check (status in ('scheduled', 'compensated', 'returned', 'cancelled')),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_cheques_company_id on public.cheques (company_id);
create index if not exists idx_cheques_cheque_date on public.cheques (cheque_date);
create index if not exists idx_cheques_status on public.cheques (status);

create or replace function public.week_start_sunday(p_date date)
returns date
language sql
immutable
as $$
  select p_date - extract(dow from p_date)::int;
$$;

create or replace function public.validate_weekly_cheque_limit()
returns trigger
language plpgsql
as $$
declare
  v_limit integer := 5;
  v_week_start date;
  v_week_end date;
  v_used integer;
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  select c.weekly_cheque_limit
  into v_limit
  from public.companies c
  where c.user_id = new.company_id;

  v_limit := coalesce(v_limit, 5);
  v_week_start := public.week_start_sunday(new.cheque_date);
  v_week_end := v_week_start + 6;

  select count(*)::int
  into v_used
  from public.cheques ch
  where ch.company_id = new.company_id
    and ch.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
    and ch.status <> 'cancelled'
    and ch.cheque_date between v_week_start and v_week_end;

  if v_used >= v_limit then
    raise exception 'Limite semanal de cheques atingido (%). Semana % até %.', v_limit, v_week_start, v_week_end;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_weekly_cheque_limit on public.cheques;
create trigger trg_validate_weekly_cheque_limit
before insert or update on public.cheques
for each row
execute function public.validate_weekly_cheque_limit();

drop trigger if exists trg_cheques_updated_at on public.cheques;
create trigger trg_cheques_updated_at
before update on public.cheques
for each row
execute function public.set_updated_at();

alter table public.cheques enable row level security;

create policy "Cheques read own company"
on public.cheques
for select
to authenticated
using (company_id = auth.uid());

create policy "Cheques insert own company"
on public.cheques
for insert
to authenticated
with check (company_id = auth.uid());

create policy "Cheques update own company"
on public.cheques
for update
to authenticated
using (company_id = auth.uid())
with check (company_id = auth.uid());
