alter table public.empresa add column if not exists bairro text;
alter table public.empresa add column if not exists cidade text;
alter table public.empresa add column if not exists uf text;
alter table public.empresa add column if not exists cep text;
alter table public.empresa add column if not exists mensagem_rodape text;

insert into public.empresa (nome_fantasia)
select ''
where not exists (select 1 from public.empresa);
