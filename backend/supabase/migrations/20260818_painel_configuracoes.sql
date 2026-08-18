create table if not exists unidades (
  id uuid primary key default gen_random_uuid(), titulo text not null unique, endereco text, inicio_unidade date,
  ativo boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists usuario_perfis (
  user_id text primary key, nome text not null, cpf text, tipo_acesso text not null default 'colaborador' check (tipo_acesso in ('administrador','programador','colaborador')),
  cargo text, telefone text, data_nascimento date, foto_url text, unidade_id uuid references unidades(id), ativo boolean not null default true, updated_at timestamptz not null default now()
);
create table if not exists unidade_colaboradores (
  unidade_id uuid not null references unidades(id) on delete cascade, user_id text not null references usuario_perfis(user_id) on delete cascade,
  primary key (unidade_id, user_id)
);
create table if not exists tipos_processo (id uuid primary key default gen_random_uuid(), titulo text not null unique, ativo boolean not null default true, created_at timestamptz not null default now());
create table if not exists origens (id uuid primary key default gen_random_uuid(), nome text not null unique, ativo boolean not null default true, created_at timestamptz not null default now());
alter table origens add column if not exists telefones text[] not null default '{}';
alter table usuario_perfis add column if not exists email text;
alter table usuario_perfis add column if not exists foto_data text;
alter table workflow_stages add column if not exists grupo text not null default 'Administrativo';
alter table workflow_stages add column if not exists limite_dias integer;
alter table tags add column if not exists uso text[] not null default array['processo','atendimento','tarefa','cliente','documento'];
alter table processos add column if not exists tipo_processo_id uuid references tipos_processo(id);
