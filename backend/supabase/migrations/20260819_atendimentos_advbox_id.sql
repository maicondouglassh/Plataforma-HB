-- Permite que Marketing e Negociação do ADVBOX sejam tratados como atendimentos,
-- sempre pelo mesmo identificador de origem.
alter table atendimentos add column if not exists advbox_id text;

create unique index if not exists atendimentos_advbox_id_key
  on atendimentos (advbox_id)
  where advbox_id is not null;

-- Mantém apenas uma cópia caso existam processos repetidos de uma importação antiga.
-- A cópia mais recente é preservada.
with repetidos as (
  select id, row_number() over (partition by advbox_id order by updated_at desc nulls last, created_at desc) as posicao
  from processos
  where advbox_id is not null
)
update atendimentos
set processo_id = null
where processo_id in (select id from repetidos where posicao > 1);

with repetidos as (
  select id, row_number() over (partition by advbox_id order by updated_at desc nulls last, created_at desc) as posicao
  from processos
  where advbox_id is not null
)
delete from processos
where id in (select id from repetidos where posicao > 1);
