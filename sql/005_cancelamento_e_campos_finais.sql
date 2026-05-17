alter table vendas add column if not exists cliente_id uuid null;
alter table caixa_movimentos add column if not exists closed_at timestamp null;
alter publication supabase_realtime add table clientes;
alter publication supabase_realtime add table produtos;
alter publication supabase_realtime add table vendas;
alter publication supabase_realtime add table itens_venda;
alter publication supabase_realtime add table caixa_movimentos;
