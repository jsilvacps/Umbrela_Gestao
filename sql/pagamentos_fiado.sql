-- ============================================================
-- Tabela pagamentos_fiado — registra recebimentos de fiado
-- Execute no Supabase SQL Editor se a tabela ainda não existir
-- ============================================================

CREATE TABLE IF NOT EXISTS pagamentos_fiado (
  id           SERIAL PRIMARY KEY,
  empresa_id   INTEGER NOT NULL,
  cliente_id   INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT,
  valor        NUMERIC(10,2) NOT NULL DEFAULT 0,
  operador     TEXT,
  observacao   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Desativa RLS (isolamento por empresa_id via código)
ALTER TABLE pagamentos_fiado DISABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX IF NOT EXISTS pagamentos_fiado_empresa_cliente
  ON pagamentos_fiado (empresa_id, cliente_id);

-- Verificação: mostra os dados existentes
SELECT empresa_id, cliente_id, cliente_nome, valor, created_at
FROM pagamentos_fiado
ORDER BY created_at DESC
LIMIT 20;
