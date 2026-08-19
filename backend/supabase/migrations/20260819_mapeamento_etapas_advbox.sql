create table if not exists advbox_stage_mappings (
  advbox_stage_key text primary key,
  advbox_stage_name text not null,
  destino text not null check (destino in ('processo', 'atendimento', 'arquivado')),
  stage_id uuid references workflow_stages(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
