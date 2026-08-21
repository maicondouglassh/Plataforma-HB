alter table configuracoes_operacionais add column if not exists esferas text[] not null default '{}';
