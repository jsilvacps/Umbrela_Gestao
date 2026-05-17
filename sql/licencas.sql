-- ============================================================
-- Tabela de licenças — gerenciada pelo DESENVOLVEDOR
-- Você insere/edita direto no painel do Supabase
-- ============================================================

create table if not exists licencas (
  id              uuid primary key default gen_random_uuid(),
  chave           text not null unique,           -- ex: HORTI-ABCD1-XYZ23-99999
  plano           text not null default 'pro',    -- 'pro' | 'free'
  cliente         text,                           -- nome do estabelecimento
  cnpj            text,                           -- opcional, para controle
  validade        date not null,                  -- data de expiração
  ativo           boolean not null default true,  -- false = chave revogada
  observacao      text,                           -- notas internas
  created_at      timestamptz default now()
);

-- Permite leitura anônima (o app lê para validar)
-- Não permite escrita pelo app (só você via dashboard/service_role)
alter table licencas enable row level security;

create policy "leitura_publica" on licencas
  for select using (true);

-- ============================================================
-- Exemplos de licenças para testar
-- ============================================================

-- Sua licença de desenvolvimento (sem expiração)
insert into licencas (chave, plano, cliente, validade, observacao)
values ('HORTI-DEV00-00000-00000', 'pro', 'Desenvolvimento', '2099-12-31', 'Chave do desenvolvedor')
on conflict (chave) do nothing;

-- Licença trial de demonstração (expira em 90 dias)
insert into licencas (chave, plano, cliente, validade, observacao)
values ('HORTI-DEMO0-00000-00000', 'pro', 'Demonstração', (now() + interval '90 days')::date, 'Chave de demo')
on conflict (chave) do nothing;
