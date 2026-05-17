-- ============================================================
-- SCHEMA MULTI-TENANT — Horti Gestão PDV
-- Rodar UMA VEZ no Supabase MASTER (o seu, Jean)
--
-- Todos os clientes ficam neste mesmo banco.
-- Cada tabela de tenant tem empresa_id que separa os dados.
-- ============================================================

-- ── Sequência para empresa_id ────────────────────────────────
-- Cada novo cliente recebe um empresa_id único.
-- Você cria o registro em clientes_licenciados e define empresa_id manualmente,
-- ou use uma sequência:

CREATE SEQUENCE IF NOT EXISTS empresa_id_seq START 1 INCREMENT 1;

-- ── Tabela de clientes licenciados (sua tabela de controle) ──
CREATE TABLE IF NOT EXISTS clientes_licenciados (
  id           SERIAL PRIMARY KEY,
  codigo       TEXT NOT NULL UNIQUE,   -- código de ativação: ex: JOAO2025
  nome_cliente TEXT,                   -- para sua referência
  empresa_id   INTEGER NOT NULL UNIQUE, -- ID que separa os dados no banco
  ativo        BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: app pode ler pelo código de ativação
ALTER TABLE clientes_licenciados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leitura_por_codigo" ON clientes_licenciados;
CREATE POLICY "leitura_por_codigo" ON clientes_licenciados
  FOR SELECT USING (ativo = true);

-- ── empresa ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresa (
  empresa_id    INTEGER PRIMARY KEY,   -- = clientes_licenciados.empresa_id
  nome_fantasia TEXT NOT NULL,
  cnpj          TEXT,
  telefone      TEXT,
  endereco      TEXT,
  cupom_largura INTEGER DEFAULT 80,
  cupom_cabecalho TEXT,
  cupom_rodape  TEXT,
  logo_url      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE empresa DISABLE ROW LEVEL SECURITY;

-- ── senhas_operacionais ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS senhas_operacionais (
  id              SERIAL PRIMARY KEY,
  empresa_id      INTEGER NOT NULL,
  adm_password    TEXT DEFAULT '1234',
  senha_cancelar_item   TEXT DEFAULT '',
  senha_cancelar_venda  TEXT DEFAULT '',
  senha_sangria         TEXT DEFAULT '',
  senha_suprimento      TEXT DEFAULT '',
  senha_alterar_preco   TEXT DEFAULT '',
  senha_reabrir_caixa   TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id)
);
ALTER TABLE senhas_operacionais DISABLE ROW LEVEL SECURITY;

-- ── operadores ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operadores (
  id                  SERIAL PRIMARY KEY,
  empresa_id          INTEGER NOT NULL,
  username            TEXT NOT NULL,
  nome                TEXT,
  password            TEXT,
  blocked             BOOLEAN DEFAULT FALSE,
  perm_finalizar      BOOLEAN DEFAULT TRUE,
  perm_cancelar_item  BOOLEAN DEFAULT TRUE,
  perm_cancelar_venda BOOLEAN DEFAULT TRUE,
  perm_sangria        BOOLEAN DEFAULT TRUE,
  perm_relatorios     BOOLEAN DEFAULT TRUE,
  perm_desconto       BOOLEAN DEFAULT TRUE,
  perm_buscar_cupons  BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (empresa_id, username)
);
ALTER TABLE operadores DISABLE ROW LEVEL SECURITY;

-- ── categorias_produto ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias_produto (
  id         SERIAL PRIMARY KEY,
  empresa_id INTEGER NOT NULL,
  nome       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE categorias_produto DISABLE ROW LEVEL SECURITY;

-- ── produtos ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produtos (
  id           SERIAL PRIMARY KEY,
  empresa_id   INTEGER NOT NULL,
  nome         TEXT NOT NULL,
  codigo       TEXT,
  ean          TEXT,
  preco        NUMERIC(10,2) DEFAULT 0,
  preco_cartao NUMERIC(10,2) DEFAULT 0,
  custo        NUMERIC(10,2) DEFAULT 0,
  estoque      NUMERIC(10,3) DEFAULT 0,
  categoria    TEXT,
  unidade      TEXT DEFAULT 'Unidade',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE produtos DISABLE ROW LEVEL SECURITY;

-- ── clientes ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id          SERIAL PRIMARY KEY,
  empresa_id  INTEGER NOT NULL,
  nome        TEXT NOT NULL,
  telefone    TEXT,
  whatsapp    TEXT,
  cpf         TEXT,
  cep         TEXT,
  endereco    TEXT,
  numero      TEXT,
  complemento TEXT,
  bairro      TEXT,
  cidade      TEXT DEFAULT 'Campinas',
  limite      NUMERIC(10,2) DEFAULT 0,
  saldo       NUMERIC(10,2) DEFAULT 0,
  status      TEXT DEFAULT 'Ativo',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;

-- ── vendas ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendas (
  id              SERIAL PRIMARY KEY,
  empresa_id      INTEGER NOT NULL,
  total           NUMERIC(10,2),
  tipo_pagamento  TEXT,
  cliente_id      INTEGER REFERENCES clientes(id),
  operador_nome   TEXT,
  desconto        NUMERIC(10,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vendas DISABLE ROW LEVEL SECURITY;

-- ── itens_venda ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS itens_venda (
  id            SERIAL PRIMARY KEY,
  empresa_id    INTEGER NOT NULL,
  venda_id      INTEGER REFERENCES vendas(id) ON DELETE CASCADE,
  produto_id    INTEGER REFERENCES produtos(id),
  nome_produto  TEXT,
  quantidade    NUMERIC(10,3),
  preco_unit    NUMERIC(10,2),
  total         NUMERIC(10,2),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE itens_venda DISABLE ROW LEVEL SECURITY;

-- ── sangrias ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sangrias (
  id          SERIAL PRIMARY KEY,
  empresa_id  INTEGER NOT NULL,
  operador    TEXT,
  valor       NUMERIC(10,2),
  observacao  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sangrias DISABLE ROW LEVEL SECURITY;

-- ── itens_cancelados ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS itens_cancelados (
  id            SERIAL PRIMARY KEY,
  empresa_id    INTEGER NOT NULL,
  nome_produto  TEXT,
  quantidade    NUMERIC(10,3),
  preco         NUMERIC(10,2),
  operador      TEXT,
  motivo        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE itens_cancelados DISABLE ROW LEVEL SECURITY;

-- ── cupons_cancelados ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cupons_cancelados (
  id          SERIAL PRIMARY KEY,
  empresa_id  INTEGER NOT NULL,
  total       NUMERIC(10,2),
  itens       JSONB,
  operador    TEXT,
  motivo      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cupons_cancelados DISABLE ROW LEVEL SECURITY;

-- ── fechamentos_caixa ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fechamentos_caixa (
  id              SERIAL PRIMARY KEY,
  empresa_id      INTEGER NOT NULL,
  total_dinheiro  NUMERIC(10,2) DEFAULT 0,
  total_cartao    NUMERIC(10,2) DEFAULT 0,
  total_pix       NUMERIC(10,2) DEFAULT 0,
  total_geral     NUMERIC(10,2) DEFAULT 0,
  total_sangrias  NUMERIC(10,2) DEFAULT 0,
  operador        TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE fechamentos_caixa DISABLE ROW LEVEL SECURITY;

-- ── caixa_movimentos ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS caixa_movimentos (
  id          SERIAL PRIMARY KEY,
  empresa_id  INTEGER NOT NULL,
  tipo        TEXT,    -- 'abertura', 'sangria', 'suprimento', 'cancelamento'
  valor       NUMERIC(10,2),
  observacao  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE caixa_movimentos DISABLE ROW LEVEL SECURITY;

-- ── licencas (tabela global do Jean, sem empresa_id) ──────────
CREATE TABLE IF NOT EXISTS licencas (
  id          SERIAL PRIMARY KEY,
  chave       TEXT NOT NULL UNIQUE,
  cliente     TEXT,
  notas       TEXT,
  ativo       BOOLEAN DEFAULT TRUE,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE licencas DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- Como adicionar um novo cliente:
--
-- 1. Escolha um empresa_id único (ex: nextval('empresa_id_seq'))
-- 2. Insira em clientes_licenciados:
--    INSERT INTO clientes_licenciados (codigo, nome_cliente, empresa_id)
--    VALUES ('JOAO2025', 'João da Silva', 1);
--
-- 3. Envie o código 'JOAO2025' ao cliente.
-- 4. O cliente faz o setup no PDV com esse código.
--    (O app salva empresa_id=1 no localStorage e filtra tudo por ele)
-- ============================================================
