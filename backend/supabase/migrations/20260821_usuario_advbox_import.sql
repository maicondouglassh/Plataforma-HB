alter table public.usuario_perfis
  add column if not exists advbox_id text;

create unique index if not exists usuario_perfis_advbox_id_unique
  on public.usuario_perfis (advbox_id)
  where advbox_id is not null;
