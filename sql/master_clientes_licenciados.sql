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

-- App pode ler pelo código (sem expor dados de outros clientes)
ALTER TABLE clientes_licenciados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leitura_por_codigo" ON clientes_licenciados;
CREATE POLICY "leitura_por_codigo" ON clientes_licenciados
  FOR SELECT USING (ativo = true);

-- ── Como cadastrar um novo cliente ───────────────────────────
-- 1. Gere o próximo empresa_id:
--    SELECT nextval('empresa_id_seq');   -- ex: retorna 1
--
-- 2. Insira o cliente:
--    INSERT INTO clientes_licenciados (codigo, nome_cliente, empresa_id)
--    VALUES ('JOAO2025', 'Joao da Silva', 1);
--
-- 3. Envie o código 'JOAO2025' ao cliente.
-- ─────────────────────────────────────────────────────────────
