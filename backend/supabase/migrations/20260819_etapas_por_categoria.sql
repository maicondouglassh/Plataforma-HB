alter table workflow_stages add column if not exists categoria text not null default 'administrativo';

update workflow_stages set active = false where module = 'processos';

insert into workflow_stages (module, categoria, grupo, name, stage_key, position, active) values
  ('processos', 'administrativo', 'Administrativo', 'Contrato Fechado', 'administrativo_contrato_fechado', 10, true),
  ('processos', 'administrativo', 'Administrativo', 'Documentação', 'administrativo_documentacao', 20, true),
  ('processos', 'administrativo', 'Administrativo', 'Protocolo', 'administrativo_protocolo', 30, true),
  ('processos', 'administrativo', 'Administrativo', 'Perícia / Avaliação', 'administrativo_pericia_avaliacao', 40, true),
  ('processos', 'administrativo', 'Administrativo', 'Aguardando Resultado', 'administrativo_aguardando_resultado', 50, true),
  ('processos', 'administrativo', 'Administrativo', 'Resultado do Processo', 'administrativo_resultado', 60, true),
  ('processos', 'judicial', 'Judicial', 'Documentação', 'judicial_documentacao', 10, true),
  ('processos', 'judicial', 'Judicial', 'Protocolo', 'judicial_protocolo', 20, true),
  ('processos', 'judicial', 'Judicial', 'Em Andamento', 'judicial_em_andamento', 30, true),
  ('processos', 'judicial', 'Judicial', 'Perícia / Avaliação / Audiência', 'judicial_pericia_avaliacao_audiencia', 40, true),
  ('processos', 'judicial', 'Judicial', 'Aguardando Julgamento', 'judicial_aguardando_julgamento', 50, true),
  ('processos', 'judicial', 'Judicial', 'Resultado', 'judicial_resultado', 60, true),
  ('processos', 'judicial', 'Judicial', 'Preparação de Recurso', 'judicial_preparacao_recurso', 70, true),
  ('processos', 'judicial', 'Judicial', 'Aguardando Julgamento Recurso', 'judicial_aguardando_julgamento_recurso', 80, true),
  ('processos', 'judicial', 'Judicial', 'Resultado do Recurso', 'judicial_resultado_recurso', 90, true),
  ('processos', 'financeiro', 'Financeiro', 'Recebimentos Administrativos', 'financeiro_recebimentos_administrativos', 10, true),
  ('processos', 'financeiro', 'Financeiro', 'Parcelas Administrativo', 'financeiro_parcelas_administrativo', 20, true),
  ('processos', 'financeiro', 'Financeiro', 'Recebimentos Judicial', 'financeiro_recebimentos_judicial', 30, true),
  ('processos', 'financeiro', 'Financeiro', 'Quitação RPV', 'financeiro_quitacao_rpv', 40, true)
on conflict (module, stage_key) do update set name = excluded.name, categoria = excluded.categoria, grupo = excluded.grupo, position = excluded.position, active = true;
