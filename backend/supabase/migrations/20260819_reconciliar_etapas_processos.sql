-- Move processos sem uma etapa ativa da nova pipeline para a porta de entrada administrativa.
update processos p
set stage_id = destino.id,
    categoria = coalesce(nullif(p.categoria, ''), 'administrativo')
from workflow_stages destino
where destino.module = 'processos'
  and destino.categoria = 'administrativo'
  and destino.stage_key = 'administrativo_contrato_fechado'
  and destino.active = true
  and (
    p.stage_id is null
    or not exists (
      select 1 from workflow_stages atual
      where atual.id = p.stage_id and atual.module = 'processos' and atual.active = true
    )
  );
