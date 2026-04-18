-- Permite ao utilizador autenticado eliminar cadastros da própria empresa (respeitando FKs nas tabelas dependentes).

create policy "Employees delete own company"
on public.employees
for delete
to authenticated
using (company_id = auth.uid());

create policy "Suppliers delete own company"
on public.suppliers
for delete
to authenticated
using (company_id = auth.uid());

create policy "Income sources delete own company"
on public.income_sources
for delete
to authenticated
using (company_id = auth.uid());

create policy "Categories delete own company"
on public.categories
for delete
to authenticated
using (company_id = auth.uid());
