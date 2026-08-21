create table if not exists advbox_configuration_mappings (
  tipo text not null check (tipo in ('origens', 'tipos_processo', 'tarefas')),
  advbox_id text not null,
  advbox_nome text not null,
  acao text not null check (acao in ('vincular', 'criar', 'ignorar')),
  destino_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tipo, advbox_id)
);
