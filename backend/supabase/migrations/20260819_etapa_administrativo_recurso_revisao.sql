insert into workflow_stages (module, categoria, grupo, name, stage_key, position, active)
values ('processos', 'administrativo', 'Administrativo', 'Recurso / Revisão', 'administrativo_recurso_revisao', 70, true)
on conflict (module, stage_key) do update
set name = excluded.name,
    categoria = excluded.categoria,
    grupo = excluded.grupo,
    position = excluded.position,
    active = true;
