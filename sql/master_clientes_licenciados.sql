-- ============================================================
-- Rodar UMA VEZ no Supabase MASTER (o seu, Jean)
-- ============================================================

CREATE TABLE IF NOT EXISTS clientes_licenciados (
  id           SERIAL PRIMARY KEY,
  codigo       TEXT NOT NULL UNIQUE,   -- ex: JOAO2025
  nome_cliente TEXT,                   -- para sua referência
  sb_url       TEXT NOT NULL,          -- URL do Supabase do cliente
  sb_key       TEXT NOT NULL,          -- anon key do Supabase do cliente
  ativo        BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Permite que o app leia os registros ativos pelo código (sem expor os demais)
ALTER TABLE clientes_licenciados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leitura_por_codigo" ON clientes_licenciados
  FOR SELECT USING (ativo = true);
