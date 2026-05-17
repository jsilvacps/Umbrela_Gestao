alter table vendas add column if not exists desconto_percentual numeric default 0;
alter table vendas add column if not exists desconto_valor numeric default 0;
alter table vendas add column if not exists cpf_nota text;
