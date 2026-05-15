-- ============================================================
-- Horti Gestão PDV — Script de criação de tabelas
-- Execute este script no SQL Editor do Supabase do cliente
-- ============================================================

-- ── EMPRESA ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS empresa (
  id              SERIAL PRIMARY KEY,
  nome_fantasia   TEXT NOT NULL,
  cnpj            TEXT,
  telefone        TEXT,
  endereco        TEXT,
  logo_url        TEXT,
  cupom_largura   INTEGER DEFAULT 80,
  cupom_cabecalho TEXT,
  cupom_rodape    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── SENHAS OPERACIONAIS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS senhas_operacionais (
  id                   SERIAL PRIMARY KEY,
  adm_password         TEXT DEFAULT '1234',
  senha_cancelar_item  TEXT DEFAULT '',
  senha_cancelar_venda TEXT DEFAULT '',
  senha_sangria        TEXT DEFAULT '',
  senha_suprimento     TEXT DEFAULT '',
  senha_alterar_preco  TEXT DEFAULT '',
  senha_reabrir_caixa  TEXT DEFAULT '',
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── OPERADORES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operadores (
  id                  SERIAL PRIMARY KEY,
  nome                TEXT NOT NULL,
  username            TEXT NOT NULL UNIQUE,
  password            TEXT NOT NULL,
  blocked             BOOLEAN DEFAULT FALSE,
  perm_finalizar      BOOLEAN DEFAULT TRUE,
  perm_cancelar_item  BOOLEAN DEFAULT FALSE,
  perm_cancelar_venda BOOLEAN DEFAULT FALSE,
  perm_sangria        BOOLEAN DEFAULT FALSE,
  perm_relatorios     BOOLEAN DEFAULT FALSE,
  perm_desconto       BOOLEAN DEFAULT FALSE,
  perm_buscar_cupons  BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── CATEGORIAS DE PRODUTO ────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias_produto (
  id         SERIAL PRIMARY KEY,
  nome       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── PRODUTOS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produtos (
  id         SERIAL PRIMARY KEY,
  nome       TEXT NOT NULL,
  codigo     TEXT,
  ean        TEXT,
  preco      NUMERIC(10,2) DEFAULT 0,
  preco_cartao NUMERIC(10,2),
  unidade    TEXT DEFAULT 'un',
  estoque    NUMERIC(10,3),
  categoria  TEXT,
  custo      NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CLIENTES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clientes (
  id          SERIAL PRIMARY KEY,
  nome        TEXT NOT NULL,
  telefone    TEXT,
  whatsapp    TEXT,
  cpf         TEXT,
  cep         TEXT,
  endereco    TEXT,
  numero      TEXT,
  complemento TEXT,
  bairro      TEXT,
  cidade      TEXT,
  saldo_fiado NUMERIC(10,2) DEFAULT 0,
  limite      NUMERIC(10,2) DEFAULT 0,
  status      TEXT DEFAULT 'ativo',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── VENDAS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendas (
  id              SERIAL PRIMARY KEY,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  tipo_pagamento  TEXT,
  operador_nome   TEXT,
  cliente_id      INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  cliente_cpf     TEXT,
  desconto        NUMERIC(10,2) DEFAULT 0,
  valor_recebido  NUMERIC(10,2),
  troco           NUMERIC(10,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── ITENS DA VENDA ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS itens_venda (
  id           SERIAL PRIMARY KEY,
  venda_id     INTEGER NOT NULL REFERENCES vendas(id) ON DELETE CASCADE,
  produto_nome TEXT NOT NULL,
  quantidade   NUMERIC(10,3) NOT NULL DEFAULT 1,
  preco        NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── SANGRIAS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sangrias (
  id         SERIAL PRIMARY KEY,
  operador   TEXT,
  valor      NUMERIC(10,2) NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ITENS CANCELADOS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS itens_cancelados (
  id           SERIAL PRIMARY KEY,
  operador     TEXT,
  produto_nome TEXT,
  quantidade   NUMERIC(10,3),
  preco        NUMERIC(10,2),
  motivo       TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── CUPONS CANCELADOS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cupons_cancelados (
  id         SERIAL PRIMARY KEY,
  operador   TEXT,
  total      NUMERIC(10,2),
  motivo     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── FECHAMENTOS DE CAIXA ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS fechamentos_caixa (
  id               SERIAL PRIMARY KEY,
  operador         TEXT,
  total_vendas     NUMERIC(10,2) DEFAULT 0,
  total_dinheiro   NUMERIC(10,2) DEFAULT 0,
  total_pix        NUMERIC(10,2) DEFAULT 0,
  total_cartao     NUMERIC(10,2) DEFAULT 0,
  total_sangrias   NUMERIC(10,2) DEFAULT 0,
  saldo_final      NUMERIC(10,2) DEFAULT 0,
  qtd_vendas       INTEGER DEFAULT 0,
  valor_gaveta     NUMERIC(10,2),
  diferenca_gaveta NUMERIC(10,2),
  obs              TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── LICENÇAS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS licencas (
  id         SERIAL PRIMARY KEY,
  chave      TEXT NOT NULL UNIQUE,
  plano      TEXT DEFAULT 'trial',
  cliente    TEXT,
  ativo      BOOLEAN DEFAULT FALSE,
  ativado_em TIMESTAMPTZ,
  validade   TIMESTAMPTZ,
  criado_em  TIMESTAMPTZ DEFAULT NOW(),
  notas      TEXT
);

-- ── DESABILITAR RLS (necessário para o PDV funcionar) ────────
ALTER TABLE empresa              DISABLE ROW LEVEL SECURITY;
ALTER TABLE senhas_operacionais  DISABLE ROW LEVEL SECURITY;
ALTER TABLE operadores           DISABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_produto   DISABLE ROW LEVEL SECURITY;
ALTER TABLE produtos             DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes             DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendas               DISABLE ROW LEVEL SECURITY;
ALTER TABLE itens_venda          DISABLE ROW LEVEL SECURITY;
ALTER TABLE sangrias             DISABLE ROW LEVEL SECURITY;
ALTER TABLE itens_cancelados     DISABLE ROW LEVEL SECURITY;
ALTER TABLE cupons_cancelados    DISABLE ROW LEVEL SECURITY;
ALTER TABLE fechamentos_caixa    DISABLE ROW LEVEL SECURITY;
ALTER TABLE licencas             DISABLE ROW LEVEL SECURITY;

-- ── SENHA ADM PADRÃO ─────────────────────────────────────────
-- Inserida automaticamente — o cliente troca no ADM após o primeiro acesso
INSERT INTO senhas_operacionais (adm_password) VALUES ('1234')
ON CONFLICT DO NOTHING;
