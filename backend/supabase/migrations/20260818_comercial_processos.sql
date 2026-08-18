-- Execute este arquivo no SQL Editor do projeto Supabase antes de usar os novos módulos.
create table if not exists workflow_stages (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('comercial', 'processos')),
  name text not null,
  stage_key text not null,
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (module, stage_key)
);

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default '#2563eb',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists atendimentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id text not null,
  stage_id uuid references workflow_stages(id),
  responsavel text,
  assunto text not null,
  descricao text,
  origem text,
  status_conversao text not null default 'aberto' check (status_conversao in ('aberto', 'convertido', 'encerrado')),
  processo_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists processos (
  id uuid primary key default gen_random_uuid(),
  cliente_id text not null,
  atendimento_id uuid references atendimentos(id),
  stage_id uuid references workflow_stages(id),
  tipo_beneficio text,
  responsavel text,
  numero_requerimento text,
  numero_beneficio text,
  numero_cnj text,
  pasta_nextcloud_url text,
  numero_protocolo text,
  resultado text check (resultado in ('deferido', 'indeferido')),
  destino_resultado text check (destino_resultado in ('financeiro', 'juridico')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'atendimentos_processo_id_fkey'
  ) then
    alter table atendimentos
      add constraint atendimentos_processo_id_fkey foreign key (processo_id) references processos(id);
  end if;
end $$;

create table if not exists tarefas (
  id uuid primary key default gen_random_uuid(),
  cliente_id text not null,
  atendimento_id uuid references atendimentos(id) on delete cascade,
  processo_id uuid references processos(id) on delete cascade,
  titulo text not null,
  descricao text,
  responsavel text,
  prazo date,
  prioridade text not null default 'normal' check (prioridade in ('baixa', 'normal', 'alta')),
  status text not null default 'pendente' check (status in ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  created_at timestamptz not null default now()
);

create table if not exists atendimento_tags (
  atendimento_id uuid not null references atendimentos(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (atendimento_id, tag_id)
);

create table if not exists processo_tags (
  processo_id uuid not null references processos(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (processo_id, tag_id)
);

insert into workflow_stages (module, name, stage_key, position) values
  ('comercial', 'Em atendimento', 'em_atendimento', 10),
  ('comercial', 'Aguardando retorno', 'aguardando_retorno', 20),
  ('comercial', 'Encerrado', 'encerrado', 30),
  ('processos', 'Contrato fechado / Em cadastro', 'contrato_fechado', 10),
  ('processos', 'Documentação', 'documentacao', 20),
  ('processos', 'Protocolo pendente', 'protocolo_pendente', 30),
  ('processos', 'Perícia / Avaliação', 'pericia_avaliacao', 40),
  ('processos', 'Aguardando resultado', 'aguardando_resultado', 50),
  ('processos', 'Resultado do processo', 'resultado', 60),
  ('processos', 'Financeiro', 'financeiro', 70),
  ('processos', 'Jurídico', 'juridico', 80),
  ('processos', 'Fim do processo', 'fim_processo', 90),
  ('processos', 'Arquivo', 'arquivo', 100)
on conflict (module, stage_key) do nothing;

create index if not exists atendimentos_cliente_id_idx on atendimentos(cliente_id);
create index if not exists processos_cliente_id_idx on processos(cliente_id);
create index if not exists tarefas_atendimento_id_idx on tarefas(atendimento_id);
create index if not exists tarefas_processo_id_idx on tarefas(processo_id);
