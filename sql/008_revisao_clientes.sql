-- Rode este SQL no Supabase para alinhar a tabela clientes com a tela
alter table clientes add column if not exists cpf text;
alter table clientes add column if not exists whatsapp text;
alter table clientes add column if not exists cep text;
alter table clientes add column if not exists endereco text;
alter table clientes add column if not exists bairro text;
alter table clientes add column if not exists cidade text;
alter table clientes add column if not exists status text default 'Ativo';
