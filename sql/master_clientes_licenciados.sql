-- ============================================================
-- Tabela de clientes licenciados — Supabase MASTER (Jean)
--
-- NOVA versão: usa empresa_id em vez de sb_url/sb_key.
-- Todos os clientes ficam no MESMO Supabase (multi-tenant).
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS empresa_id_seq START 1 INCREMENT 1;

CREATE TABLE IF NOT EXISTS clientes_licenciados (
  id           SERIAL PRIMARY KEY,
  codigo       TEXT NOT NULL UNIQUE,    -- código de ativação: ex: JOAO2025
  nome_cliente TEXT,                    -- para sua referência
  empresa_id   INTEGER NOT NULL UNIQUE, -- ID que isola os dados do cliente
  ativo        BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: clientes só leem pelo próprio código; painel /master pode gerenciar tudo
ALTER TABLE clientes_licenciados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_por_codigo" ON clientes_licenciados;
DROP POLICY IF EXISTS "master_insert"       ON clientes_licenciados;
DROP POLICY IF EXISTS "master_update"       ON clientes_licenciados;
DROP POLICY IF EXISTS "master_delete"       ON clientes_licenciados;
DROP POLICY IF EXISTS "master_select_all"   ON clientes_licenciados;

-- Clientes PDV: leem apenas registros ativos (para ativar pelo código)
CREATE POLICY "leitura_por_codigo" ON clientes_licenciados
  FOR SELECT USING (ativo = true);

-- Painel /master: pode inserir, atualizar e excluir (acesso protegido por senha no app)
CREATE POLICY "master_insert"     ON clientes_licenciados FOR INSERT WITH CHECK (true);
CREATE POLICY "master_update"     ON clientes_licenciados FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "master_delete"     ON clientes_licenciados FOR DELETE USING (true);

-- ── Cadastro pelo painel /master ─────────────────────────────
-- Acesse horti-gestao.vercel.app/master → senha master → aba Clientes
-- Preencha o nome e código → clique "Criar cliente" → copie o código
-- ─────────────────────────────────────────────────────────────
