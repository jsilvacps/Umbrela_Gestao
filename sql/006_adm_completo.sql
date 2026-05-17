create table if not exists empresa (
  id uuid primary key default gen_random_uuid(),
  nome_fantasia text,
  logo_url text,
  cnpj text,
  telefone text,
  endereco text,
  created_at timestamp default now()
);

create table if not exists operadores (
  id uuid primary key default gen_random_uuid(),
  nome text,
  username text unique,
  password text,
  blocked boolean default false,
  created_at timestamp default now()
);

create table if not exists senhas_operacionais (
  id uuid primary key default gen_random_uuid(),
  adm_password text default '1234',
  senha_cancelar_item text,
  senha_cancelar_venda text,
  senha_sangria text,
  senha_suprimento text,
  senha_alterar_preco text,
  senha_reabrir_caixa text,
  created_at timestamp default now()
);

create table if not exists itens_cancelados (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid,
  produto_nome text,
  quantidade numeric default 0,
  motivo text,
  operador text,
  created_at timestamp default now()
);

create table if not exists cupons_cancelados (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid,
  total numeric default 0,
  motivo text,
  operador text,
  created_at timestamp default now()
);

alter table empresa enable row level security;
alter table operadores enable row level security;
alter table senhas_operacionais enable row level security;
alter table itens_cancelados enable row level security;
alter table cupons_cancelados enable row level security;

drop policy if exists "liberar tudo empresa" on empresa;
create policy "liberar tudo empresa" on empresa for all using (true) with check (true);

drop policy if exists "liberar tudo operadores" on operadores;
create policy "liberar tudo operadores" on operadores for all using (true) with check (true);

drop policy if exists "liberar tudo senhas_operacionais" on senhas_operacionais;
create policy "liberar tudo senhas_operacionais" on senhas_operacionais for all using (true) with check (true);

drop policy if exists "liberar tudo itens_cancelados" on itens_cancelados;
create policy "liberar tudo itens_cancelados" on itens_cancelados for all using (true) with check (true);

drop policy if exists "liberar tudo cupons_cancelados" on cupons_cancelados;
create policy "liberar tudo cupons_cancelados" on cupons_cancelados for all using (true) with check (true);

alter publication supabase_realtime add table empresa;
alter publication supabase_realtime add table operadores;
alter publication supabase_realtime add table senhas_operacionais;
alter publication supabase_realtime add table itens_cancelados;
alter publication supabase_realtime add table cupons_cancelados;
