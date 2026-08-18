alter table clientes add column if not exists observacoes text;
alter table atendimentos add column if not exists tipo_beneficio text;
alter table processos add column if not exists categoria text not null default 'administrativo';
alter table processos add column if not exists data_requerimento date;
alter table processos add column if not exists ano_ajuizamento integer;
alter table processos add column if not exists segmento_judiciario text;
alter table processos add column if not exists comarca text;
alter table processos add column if not exists vara text;
alter table processos add column if not exists tribunal text;
alter table processos add column if not exists sistema_eletronico text;
alter table processos add column if not exists valor_causa numeric(14,2);
alter table processos add column if not exists contingenciamento numeric(14,2);
alter table processos add column if not exists data_cadastro date;
alter table processos add column if not exists data_fechamento date;
alter table processos add column if not exists data_transito_julgado date;
alter table processos add column if not exists data_arquivamento date;
alter table processos add column if not exists resultado_processo text check (resultado_processo in ('ganho', 'perdido'));

create table if not exists processo_partes (
  id uuid primary key default gen_random_uuid(), processo_id uuid not null references processos(id) on delete cascade,
  nome text not null, tipo text not null, created_at timestamptz not null default now()
);
create table if not exists processo_andamentos (
  id uuid primary key default gen_random_uuid(), processo_id uuid not null references processos(id) on delete cascade,
  autor_id text, autor_nome text not null, conteudo text not null, tipo text not null default 'manual' check (tipo in ('manual','automatico')),
  segredo boolean not null default false, origem text, ocorrido_em timestamptz not null default now(), created_at timestamptz not null default now()
);
create table if not exists tag_scopes (
  tag_id uuid not null references tags(id) on delete cascade,
  entidade text not null check (entidade in ('cliente','atendimento','processo','tarefa')),
  primary key (tag_id, entidade)
);
