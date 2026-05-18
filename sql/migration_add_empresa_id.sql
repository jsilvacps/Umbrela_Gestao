-- ============================================================
-- MIGRAÇÃO: adiciona empresa_id nas tabelas existentes
-- Execute este script no Supabase SQL Editor (uma vez só)
--
-- Se você está começando do zero, use schema_multitenant.sql
-- Se já tem tabelas com dados, use ESTE arquivo
-- ============================================================

-- ── 1. Cria a sequência para empresa_id ──────────────────────
CREATE SEQUENCE IF NOT EXISTS empresa_id_seq START 2 INCREMENT 1;
-- Começa em 2 porque o cliente já existente receberá empresa_id = 1

-- ── 2. Tabela de clientes licenciados (nova) ──────────────────
CREATE TABLE IF NOT EXISTS clientes_licenciados (
  id           SERIAL PRIMARY KEY,
  codigo       TEXT NOT NULL UNIQUE,
  nome_cliente TEXT,
  empresa_id   INTEGER NOT NULL UNIQUE,
  ativo        BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clientes_licenciados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leitura_por_codigo" ON clientes_licenciados;
DROP POLICY IF EXISTS "master_insert"      ON clientes_licenciados;
DROP POLICY IF EXISTS "master_update"      ON clientes_licenciados;
DROP POLICY IF EXISTS "master_delete"      ON clientes_licenciados;
CREATE POLICY "leitura_por_codigo" ON clientes_licenciados FOR SELECT  USING (ativo = true);
CREATE POLICY "master_insert"      ON clientes_licenciados FOR INSERT  WITH CHECK (true);
CREATE POLICY "master_update"      ON clientes_licenciados FOR UPDATE  USING (true) WITH CHECK (true);
CREATE POLICY "master_delete"      ON clientes_licenciados FOR DELETE  USING (true);

-- ── 3. Adiciona empresa_id em cada tabela ─────────────────────
-- Tabelas que já existem recebem empresa_id = 1 nos dados atuais

ALTER TABLE empresa             ADD COLUMN IF NOT EXISTS empresa_id INTEGER;
ALTER TABLE senhas_operacionais ADD COLUMN IF NOT EXISTS empresa_id INTEGER;
ALTER TABLE operadores          ADD COLUMN IF NOT EXISTS empresa_id INTEGER;
ALTER TABLE categorias_produto  ADD COLUMN IF NOT EXISTS empresa_id INTEGER;
ALTER TABLE produtos            ADD COLUMN IF NOT EXISTS empresa_id INTEGER;
ALTER TABLE clientes            ADD COLUMN IF NOT EXISTS empresa_id INTEGER;
ALTER TABLE vendas              ADD COLUMN IF NOT EXISTS empresa_id INTEGER;
ALTER TABLE itens_venda         ADD COLUMN IF NOT EXISTS empresa_id INTEGER;
ALTER TABLE sangrias            ADD COLUMN IF NOT EXISTS empresa_id INTEGER;
ALTER TABLE itens_cancelados    ADD COLUMN IF NOT EXISTS empresa_id INTEGER;
ALTER TABLE cupons_cancelados   ADD COLUMN IF NOT EXISTS empresa_id INTEGER;
ALTER TABLE fechamentos_caixa   ADD COLUMN IF NOT EXISTS empresa_id INTEGER;

-- Tenta adicionar em tabelas opcionais (ignora erro se não existirem)
ALTER TABLE caixa_movimentos    ADD COLUMN IF NOT EXISTS empresa_id INTEGER;

-- ── 4. Preenche empresa_id = 1 em todos os dados existentes ───
UPDATE empresa             SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE senhas_operacionais SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE operadores          SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE categorias_produto  SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE produtos            SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE clientes            SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE vendas              SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE itens_venda         SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE sangrias            SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE itens_cancelados    SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE cupons_cancelados   SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE fechamentos_caixa   SET empresa_id = 1 WHERE empresa_id IS NULL;
UPDATE caixa_movimentos    SET empresa_id = 1 WHERE empresa_id IS NULL;

-- ── 5. Torna empresa_id NOT NULL após preencher ───────────────
ALTER TABLE empresa             ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE senhas_operacionais ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE operadores          ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE categorias_produto  ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE produtos            ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE clientes            ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE vendas              ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE itens_venda         ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE sangrias            ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE itens_cancelados    ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE cupons_cancelados   ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE fechamentos_caixa   ALTER COLUMN empresa_id SET NOT NULL;

-- ── 6. Desativa RLS em todas as tabelas de tenant ─────────────
ALTER TABLE empresa             DISABLE ROW LEVEL SECURITY;
ALTER TABLE senhas_operacionais DISABLE ROW LEVEL SECURITY;
ALTER TABLE operadores          DISABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_produto  DISABLE ROW LEVEL SECURITY;
ALTER TABLE produtos            DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes            DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendas              DISABLE ROW LEVEL SECURITY;
ALTER TABLE itens_venda         DISABLE ROW LEVEL SECURITY;
ALTER TABLE sangrias            DISABLE ROW LEVEL SECURITY;
ALTER TABLE itens_cancelados    DISABLE ROW LEVEL SECURITY;
ALTER TABLE cupons_cancelados   DISABLE ROW LEVEL SECURITY;
ALTER TABLE fechamentos_caixa   DISABLE ROW LEVEL SECURITY;

-- ── 7. Cadastra você mesmo como cliente_id = 1 ───────────────
-- Substitua 'SEU_CODIGO' pelo código que quiser usar
INSERT INTO clientes_licenciados (codigo, nome_cliente, empresa_id)
VALUES ('MASTER2025', 'Jean Silva', 1)
ON CONFLICT (empresa_id) DO NOTHING;

-- ── 8. Cria tabela licencas se não existir ────────────────────
CREATE TABLE IF NOT EXISTS licencas (
  id        SERIAL PRIMARY KEY,
  chave     TEXT NOT NULL UNIQUE,
  plano     TEXT DEFAULT 'pro',
  cliente   TEXT,
  notas     TEXT,
  ativo     BOOLEAN DEFAULT TRUE,
  ativado_em TIMESTAMPTZ,
  validade  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE licencas DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- PRONTO! Após rodar este script:
-- 1. Todos os dados existentes ficam com empresa_id = 1
-- 2. Seu código de ativação é: MASTER2025
-- 3. Novos clientes criados em /master terão empresa_id 2, 3, 4...
-- ============================================================
