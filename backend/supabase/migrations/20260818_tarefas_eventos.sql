alter table tarefas add column if not exists hora time;
alter table tarefas add column if not exists prazo_fatal timestamptz;
alter table tarefas add column if not exists tipo text not null default 'tarefa' check (tipo in ('tarefa','evento'));
alter table tarefas add column if not exists local text;
alter table tarefas add column if not exists classificacao text not null default 'normal' check (classificacao in ('urgente','importante','normal','futura'));
alter table tarefas add column if not exists ocultar_ate date;
alter table tarefas add column if not exists instrucao_necessaria boolean not null default false;

create table if not exists lembretes_tarefa (
  id uuid primary key default gen_random_uuid(), tarefa_id uuid not null references tarefas(id) on delete cascade,
  dias_antes integer not null check (dias_antes >= 0), created_at timestamptz not null default now()
);
create table if not exists modelos_tarefa (
  id uuid primary key default gen_random_uuid(), titulo text not null unique, tipo text not null default 'tarefa' check (tipo in ('tarefa','evento')),
  descricao text, ativo boolean not null default true, created_at timestamptz not null default now()
);

insert into modelos_tarefa (titulo, tipo) values
 ('Solicitar documentação', 'tarefa'), ('Conferir documentação', 'tarefa'),
 ('Perícia Médica', 'evento'), ('Avaliação Social', 'evento'), ('Audiência', 'evento')
on conflict (titulo) do nothing;
