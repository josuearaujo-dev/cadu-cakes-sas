-- Funcionários: troca salário semanal por valor/hora.
-- Pagamentos: registra horas trabalhadas para calcular o total da semana.

alter table public.employees
  rename column weekly_salary to hourly_rate;

alter table public.employees
  add constraint employees_hourly_rate_non_negative check (hourly_rate >= 0);

alter table public.employee_payments
  add column if not exists hours_worked numeric(8, 2);

alter table public.employee_payments
  add constraint employee_payments_hours_worked_positive
  check (hours_worked is null or hours_worked > 0);
