alter table vendas add column if not exists status text default 'finalizada';
alter table itens_venda add column if not exists status text default 'ativo';

alter table caixa_movimentos add column if not exists tipo text;
alter table caixa_movimentos add column if not exists valor numeric default 0;
alter table caixa_movimentos add column if not exists observacao text;
alter table caixa_movimentos add column if not exists created_at timestamp default now();

alter publication supabase_realtime add table vendas;
alter publication supabase_realtime add table itens_venda;
alter publication supabase_realtime add table caixa_movimentos;
