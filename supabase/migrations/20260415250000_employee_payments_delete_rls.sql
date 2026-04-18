-- Permite eliminar registos de folha da própria empresa (RLS).

create policy "Employee payments delete own company"
on public.employee_payments
for delete
to authenticated
using (company_id = auth.uid());
