create table if not exists cliente_grupo_familiar (
  id uuid primary key default gen_random_uuid(),
  cliente_id text not null references clientes(id) on delete cascade,
  nome text not null,
  data_nascimento date,
  parentesco text not null,
  renda numeric(14,2),
  created_at timestamptz not null default now()
);

alter table tarefas add column if not exists situacao_evento text check (situacao_evento in ('compareceu', 'nao_compareceu', 'cancelado', 'remarcado'));
create index if not exists cliente_grupo_familiar_cliente_id_idx on cliente_grupo_familiar(cliente_id);
create index if not exists tarefas_titulo_tipo_prazo_idx on tarefas(titulo, tipo, prazo);
