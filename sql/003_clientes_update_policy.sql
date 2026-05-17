alter table clientes enable row level security;
alter table produtos enable row level security;
alter table vendas enable row level security;
alter table itens_venda enable row level security;

drop policy if exists "liberar tudo clientes" on clientes;
create policy "liberar tudo clientes" on clientes for all using (true) with check (true);

drop policy if exists "liberar tudo produtos" on produtos;
create policy "liberar tudo produtos" on produtos for all using (true) with check (true);

drop policy if exists "liberar tudo vendas" on vendas;
create policy "liberar tudo vendas" on vendas for all using (true) with check (true);

drop policy if exists "liberar tudo itens_venda" on itens_venda;
create policy "liberar tudo itens_venda" on itens_venda for all using (true) with check (true);
