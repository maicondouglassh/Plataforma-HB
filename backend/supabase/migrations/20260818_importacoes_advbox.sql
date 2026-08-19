create table if not exists integracoes_importacao (
  id uuid primary key default gen_random_uuid(), provedor text not null default 'advbox', tipo text not null check (tipo in ('clientes','processos','tarefas','etapas','origens','usuarios','movimentacoes','documentos')),
  nome text not null, ativo boolean not null default true, mapeamento jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), unique (provedor, tipo, nome)
);
create table if not exists importacoes_execucoes (
  id uuid primary key default gen_random_uuid(), integracao_id uuid references integracoes_importacao(id) on delete set null,
  tipo text not null, status text not null default 'pendente' check (status in ('pendente','executando','concluida','erro')),
  total_lido integer not null default 0, total_importado integer not null default 0, total_ignorado integer not null default 0,
  detalhes jsonb, iniciado_em timestamptz not null default now(), finalizado_em timestamptz
);
