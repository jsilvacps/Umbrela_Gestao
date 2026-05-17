create table if not exists caixa_movimentos (
  id uuid primary key default gen_random_uuid(),
  valor_inicial numeric default 0,
  valor_final numeric default 0,
  status text default 'aberto',
  opened_at timestamp default now(),
  closed_at timestamp null
);

alter table caixa_movimentos enable row level security;

drop policy if exists "liberar tudo caixa_movimentos" on caixa_movimentos;
create policy "liberar tudo caixa_movimentos"
on caixa_movimentos
for all
using (true)
with check (true);

alter publication supabase_realtime add table caixa_movimentos;
