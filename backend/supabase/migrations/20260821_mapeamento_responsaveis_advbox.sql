create table if not exists public.advbox_user_mappings (
  advbox_user_id text primary key,
  advbox_user_name text not null,
  user_id text references public.usuario_perfis(user_id) on delete cascade,
  ignorado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.advbox_user_mappings
  add column if not exists ignorado boolean not null default false;

alter table public.advbox_user_mappings
  alter column user_id drop not null;
