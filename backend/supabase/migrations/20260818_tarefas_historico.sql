-- Execute após as migrações anteriores. Estrutura o histórico e os lembretes como tarefas relacionadas.
alter table tarefas add column if not exists tarefa_pai_id uuid references tarefas(id) on delete cascade;
alter table tarefas add column if not exists concluida_em timestamptz;

create table if not exists tarefa_comentarios (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  autor_id text,
  autor_nome text not null,
  conteudo text not null,
  created_at timestamptz not null default now()
);

create index if not exists tarefas_pai_idx on tarefas(tarefa_pai_id);
create index if not exists tarefa_comentarios_tarefa_idx on tarefa_comentarios(tarefa_id, created_at desc);
