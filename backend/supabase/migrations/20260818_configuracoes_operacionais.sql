create table if not exists configuracoes_operacionais (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('beneficio', 'tarefa')),
  nome text not null,
  tipo_evento text not null default 'tarefa' check (tipo_evento in ('tarefa', 'evento')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  unique (categoria, nome)
);

create table if not exists acessos_operacionais_usuarios (
  user_id text primary key,
  perfil text not null default 'colaborador' check (perfil in ('administrador', 'colaborador', 'consulta')),
  ativo boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into configuracoes_operacionais (categoria, nome, tipo_evento) values
  ('tarefa', 'Solicitar documentação', 'tarefa'),
  ('tarefa', 'Conferir documentação', 'tarefa'),
  ('tarefa', 'Perícia Médica', 'evento'),
  ('tarefa', 'Avaliação Social', 'evento'),
  ('tarefa', 'Audiência', 'evento')
on conflict (categoria, nome) do nothing;
