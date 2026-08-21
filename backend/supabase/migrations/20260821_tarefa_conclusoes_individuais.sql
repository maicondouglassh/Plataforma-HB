-- Conclusão de tarefas por responsável. Em tarefas com mais de um responsável,
-- cada pessoa mantém a própria pendência e histórico de conclusão.
create table if not exists public.tarefa_conclusoes (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references public.tarefas(id) on delete cascade,
  user_id text not null,
  concluida_em timestamptz not null default now(),
  unique (tarefa_id, user_id)
);

create index if not exists tarefa_conclusoes_usuario_idx
  on public.tarefa_conclusoes(user_id, tarefa_id);
