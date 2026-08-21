alter table tarefas add column if not exists advbox_id text;
alter table tarefas add column if not exists advbox_criado_em timestamptz;
create unique index if not exists tarefas_advbox_id_key on tarefas (advbox_id) where advbox_id is not null;
