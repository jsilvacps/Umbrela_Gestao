create table if not exists categorias_produto (
  id uuid primary key default gen_random_uuid(),
  nome text unique not null,
  created_at timestamp default now()
);

alter table categorias_produto enable row level security;

drop policy if exists "liberar tudo categorias_produto" on categorias_produto;
create policy "liberar tudo categorias_produto"
on categorias_produto
for all
using (true)
with check (true);

alter publication supabase_realtime add table categorias_produto;
