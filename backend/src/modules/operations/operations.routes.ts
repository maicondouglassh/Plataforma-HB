import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../../core/auth/auth.middleware';

const operationsRouter = Router();

function required(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function advboxCustomerId(item: any): string {
  const candidates = [item.customer_id, item.customers_id, item.client_id, item.customer, item.customers, item.customer_data, item.customers_data];
  for (const candidate of candidates) {
    let value = candidate;
    if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) { try { value = JSON.parse(value); } catch { /* ignore malformed payload */ } }
    const customer = Array.isArray(value) ? value[0] : value;
    if (customer && typeof customer === 'object') { const id = customer.customer_id || customer.id; if (id) return String(id); }
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function advboxCustomerCpf(item: any, customerId: string): string {
  const sources = [item.customer, item.customers, item.customer_data, item.customers_data];
  for (let value of sources) {
    if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) { try { value = JSON.parse(value); } catch { continue; } }
    const customers = Array.isArray(value) ? value : [value];
    const customer = customers.find((entry: any) => String(entry?.customer_id || entry?.id || '') === customerId) || customers[0];
    if (customer?.identification || customer?.cpf) return String(customer.identification || customer.cpf);
  }
  return '';
}

function advboxProcessCategory(item: any): 'administrativo' | 'judicial' | 'financeiro' | 'arquivado' | 'atendimento' {
  const step = advboxStageIdentity(item).step.toLowerCase();
  if (/arquiv/.test(step)) return 'arquivado';
  if (/negocia|marketing|comercial|atendimento/.test(step)) return 'atendimento';
  if (/recurs|execu[cç][aã]o|judicial|audi[eê]ncia|julgamento/.test(step)) return 'judicial';
  if (/financeir|recebimento|parcela|rpv|quita[cç][aã]o/.test(step)) return 'financeiro';
  return 'administrativo';
}

function advboxStepName(item: any): string {
  const value = item.stage || item.stages || item.stage_name || item.step || item.steps || item.step_name || item.status || '';
  if (Array.isArray(value)) return String(value[0]?.name || value[0]?.title || value[0] || '');
  if (value && typeof value === 'object') return String(value.name || value.title || value.description || '');
  return String(value);
}

function advboxValue(value: any): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return advboxValue(value[0]);
  if (typeof value === 'object') return String(value.name || value.title || value.description || '') || null;
  return String(value);
}

function advboxStageKey(item: any, categoria: ReturnType<typeof advboxProcessCategory>): string | null {
  const step = advboxStepName(item).toLowerCase();
  if (categoria === 'arquivado') return null;
  if (categoria === 'financeiro') {
    if (/parcela/.test(step)) return 'financeiro_parcelas_administrativo';
    if (/judicial/.test(step)) return 'financeiro_recebimentos_judicial';
    if (/rpv|quita/.test(step)) return 'financeiro_quitacao_rpv';
    return 'financeiro_recebimentos_administrativos';
  }
  if (categoria === 'judicial') {
    if (/document/.test(step)) return 'judicial_documentacao';
    if (/protoc/.test(step)) return 'judicial_protocolo';
    if (/per[ií]cia|avalia|audi[eê]ncia/.test(step)) return 'judicial_pericia_avaliacao_audiencia';
    if (/prepara.*recurs|recurso/.test(step) && !/aguard/.test(step)) return 'judicial_preparacao_recurso';
    if (/aguard.*julg.*recurs/.test(step)) return 'judicial_aguardando_julgamento_recurso';
    if (/resultado.*recurs/.test(step)) return 'judicial_resultado_recurso';
    if (/aguard.*julg/.test(step)) return 'judicial_aguardando_julgamento';
    if (/resultado/.test(step)) return 'judicial_resultado';
    return 'judicial_em_andamento';
  }
  if (/contrato|fechad/.test(step)) return 'administrativo_contrato_fechado';
  if (/document/.test(step)) return 'administrativo_documentacao';
  if (/protoc/.test(step)) return 'administrativo_protocolo';
  if (/per[ií]cia|avalia/.test(step)) return 'administrativo_pericia_avaliacao';
  if (/aguard.*resultado/.test(step)) return 'administrativo_aguardando_resultado';
  if (/resultado/.test(step)) return 'administrativo_resultado';
  return 'administrativo_contrato_fechado';
}

function advboxStageIdentity(item: any): { key: string; name: string; step: string; stage: string } {
  const read = (value: any): { id?: string; name: string } => { const current = Array.isArray(value) ? value[0] : value; if (current && typeof current === 'object') return { id: current.id || current.stage_id || current.step_id ? String(current.id || current.stage_id || current.step_id) : undefined, name: String(current.name || current.title || current.description || '') }; return { name: String(current || '') }; };
  const rawStage = Array.isArray(item.stage || item.stages) ? (item.stage || item.stages)[0] : item.stage || item.stages || null;
  const stepData = read(item.step || item.steps || item.step_name || item.step_lawsuit || item.step_lawsuits || rawStage?.step || rawStage?.steps || rawStage?.group || rawStage?.grupo || rawStage?.parent || rawStage?.category || rawStage?.pipeline || '');
  const stageData = read(rawStage || item.stage_name || item.status || '');
  const step = stepData.name.trim() || String(rawStage?.step_name || rawStage?.group_name || rawStage?.category_name || item.step_label || item.step_description || 'STEP não informado pelo ADVBOX'); const stage = stageData.name.trim() || 'Sem STAGE';
  const id = stageData.id || item.stage_id || item.stages_id;
  return { key: id ? `stage:${id}` : `stage:${stage.toLowerCase()}:step:${step.toLowerCase()}`, name: stage !== 'Sem STAGE' ? stage : step, step, stage };
}

function isAdministrator(roleId: unknown): boolean {
  return ['admin', 'administrador', '1'].includes(String(roleId || '').trim().toLowerCase());
}
function canManageConfiguration(roleId: unknown): boolean {
  return isAdministrator(roleId) || ['programador', 'programmer', 'developer', '2', '3'].includes(String(roleId || '').trim().toLowerCase());
}

async function hasConfigurationAccess(supabase: SupabaseClient, user: { id?: string; roleId?: unknown } | undefined): Promise<boolean> {
  if (canManageConfiguration(user?.roleId)) return true;
  if (!user?.id) return false;
  const { data } = await supabase.from('usuario_perfis').select('tipo_acesso').eq('user_id', user.id).maybeSingle();
  return ['administrador', 'programador'].includes(String(data?.tipo_acesso || '').toLowerCase());
}

async function replaceTags(supabase: SupabaseClient, table: 'atendimento_tags' | 'processo_tags', column: 'atendimento_id' | 'processo_id', recordId: string, tagIds: unknown) {
  if (!Array.isArray(tagIds)) return;
  const ids = tagIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
  const { error: deleteError } = await supabase.from(table).delete().eq(column, recordId);
  if (deleteError) throw deleteError;
  if (!ids.length) return;
  const { error: insertError } = await supabase.from(table).insert(ids.map((tagId) => ({ [column]: recordId, tag_id: tagId })));
  if (insertError) throw insertError;
}

export function createOperationsRouter(supabase: SupabaseClient) {
  operationsRouter.use(authenticateToken);

  operationsRouter.get('/stages/:module', async (req, res) => {
    const module = req.params.module;
    if (!['comercial', 'processos'].includes(module)) return res.status(400).json({ error: 'Módulo inválido.' });
    const { data, error } = await supabase.from('workflow_stages').select('*').eq('module', module).eq('active', true).order('position');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  operationsRouter.get('/tags', async (req, res) => {
    let query: any = supabase.from('tags').select('*').eq('active', true).order('name');
    if (req.query.uso) query = query.contains('uso', [String(req.query.uso)]);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  operationsRouter.get('/configuracoes', async (_req, res) => {
    const [tags, options, users, access] = await Promise.all([
      supabase.from('tags').select('*').order('name'), supabase.from('configuracoes_operacionais').select('*').order('categoria').order('nome'),
      supabase.from('users').select('userid, username, useremail, roleid'), supabase.from('acessos_operacionais_usuarios').select('*'),
    ]);
    const error = tags.error || options.error || users.error || access.error;
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ tags: tags.data, opcoes: options.data, usuarios: users.data, acessos: access.data });
  });

  operationsRouter.get('/configuracoes/painel/:tipo', async (req, res) => {
    const tables: Record<string, string> = { usuarios: 'usuario_perfis', unidades: 'unidades', tipos_processo: 'tipos_processo', origens: 'origens', tarefas: 'configuracoes_operacionais', tags: 'tags', etapas: 'workflow_stages' };
    const table = tables[req.params.tipo]; if (!table) return res.status(400).json({ error: 'Cadastro inválido.' });
    let query: any = supabase.from(table).select('*');
    if (req.params.tipo !== 'usuarios') query = query.order('created_at', { ascending: false });
    if (req.params.tipo === 'tarefas') query = query.eq('categoria', 'tarefa');
    const { data, error } = await query; if (error) return res.status(500).json({ error: error.message }); return res.json(data);
  });

  operationsRouter.post('/configuracoes/painel/:tipo', async (req: any, res) => {
    if (!canManageConfiguration(req.user?.roleId)) return res.status(403).json({ error: 'Apenas administradores e programadores podem alterar cadastros.' });
    const type = req.params.tipo; const body = req.body;
    if (type === 'usuarios') {
      const nome = required(body.nome); const email = required(body.email); const senha = required(body.senha) || 'Hb#123456';
      if (!nome || !email) return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });
      const passwordHash = await bcrypt.hash(senha, 10);
      const { data: createdUser, error: userError } = await supabase.from('users').insert({ username: nome, useremail: email, userpass: passwordHash }).select('userid').single();
      if (userError) return res.status(400).json({ error: userError.message });
      const userId = String(createdUser.userid);
      const { data, error } = await supabase.from('usuario_perfis').insert({ user_id: userId, nome, email, cpf: body.cpf || null, tipo_acesso: body.tipoAcesso || 'colaborador', cargo: body.cargo || null, telefone: body.telefone || null, data_nascimento: body.dataNascimento || null, foto_data: body.fotoData || null, unidade_id: body.unidadeId || null, ativo: body.ativo !== false }).select().single();
      if (error) return res.status(400).json({ error: error.message }); return res.status(201).json(data);
    }
    const payloads: Record<string, { table: string; payload: any }> = {
      unidades: { table: 'unidades', payload: { titulo: required(body.titulo), endereco: body.endereco || null, inicio_unidade: body.inicioUnidade || null, ativo: body.ativo !== false } },
      tipos_processo: { table: 'tipos_processo', payload: { titulo: required(body.titulo), ativo: body.ativo !== false } },
      origens: { table: 'origens', payload: { nome: required(body.nome), telefones: Array.isArray(body.telefones) ? body.telefones : String(body.telefones || '').split(',').map((phone) => phone.trim()).filter(Boolean), ativo: body.ativo !== false } },
      tarefas: { table: 'configuracoes_operacionais', payload: { categoria: 'tarefa', nome: required(body.titulo), tipo_evento: body.tipo === 'evento' ? 'evento' : 'tarefa', ativo: body.ativo !== false } },
      tags: { table: 'tags', payload: { name: required(body.nome), color: body.cor || '#2563eb', uso: Array.isArray(body.uso) ? body.uso : [], active: body.ativo !== false } },
      etapas: { table: 'workflow_stages', payload: { module: 'processos', grupo: body.grupo || 'Administrativo', name: required(body.titulo), stage_key: required(body.titulo)?.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''), position: Number(body.position || 0), limite_dias: body.limiteDias ? Number(body.limiteDias) : null, active: body.ativo !== false } },
    };
    const target = payloads[type]; if (!target || Object.values(target.payload).some((value) => value === null && ['titulo', 'nome', 'user_id'].includes(''))) return res.status(400).json({ error: 'Dados inválidos.' });
    const { data, error } = await supabase.from(target.table).insert(target.payload).select().single(); if (error) return res.status(400).json({ error: error.message }); return res.status(201).json(data);
  });

  operationsRouter.patch('/configuracoes/painel/:tipo/:id', async (req: any, res) => {
    if (!canManageConfiguration(req.user?.roleId)) return res.status(403).json({ error: 'Apenas administradores e programadores podem alterar cadastros.' });
    const tables: Record<string, string> = { unidades: 'unidades', tipos_processo: 'tipos_processo', origens: 'origens', tarefas: 'configuracoes_operacionais', tags: 'tags', etapas: 'workflow_stages', usuarios: 'usuario_perfis' }; const table = tables[req.params.tipo]; if (!table) return res.status(400).json({ error: 'Cadastro inválido.' });
    const changes: any = { ...req.body }; if (['tags', 'etapas'].includes(req.params.tipo) && 'ativo' in changes) { changes.active = changes.ativo; delete changes.ativo; }
    if (req.params.tipo === 'usuarios') { if ('tipoAcesso' in changes) { changes.tipo_acesso = changes.tipoAcesso; delete changes.tipoAcesso; } if ('unidadeId' in changes) { changes.unidade_id = changes.unidadeId; delete changes.unidadeId; } if ('dataNascimento' in changes) { changes.data_nascimento = changes.dataNascimento; delete changes.dataNascimento; } if ('fotoData' in changes) { changes.foto_data = changes.fotoData; delete changes.fotoData; } }
    delete changes.senha; delete changes.id; delete changes.user_id;
    const { data, error } = await supabase.from(table).update(changes).eq(req.params.tipo === 'usuarios' ? 'user_id' : 'id', req.params.id).select().single(); if (error) return res.status(400).json({ error: error.message }); return res.json(data);
  });

  operationsRouter.post('/configuracoes/opcoes', async (req: any, res) => {
    if (!isAdministrator(req.user?.roleId)) return res.status(403).json({ error: 'Apenas administradores podem alterar configurações.' });
    const nome = required(req.body.nome); const categoria = req.body.categoria;
    if (!nome || !['beneficio', 'tarefa'].includes(categoria)) return res.status(400).json({ error: 'Informe uma categoria e nome válidos.' });
    const { data, error } = await supabase.from('configuracoes_operacionais').insert({ categoria, nome, tipo_evento: req.body.tipoEvento === 'evento' ? 'evento' : 'tarefa' }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  });

  operationsRouter.patch('/configuracoes/opcoes/:id', async (req: any, res) => {
    if (!isAdministrator(req.user?.roleId)) return res.status(403).json({ error: 'Apenas administradores podem alterar configurações.' });
    const { data, error } = await supabase.from('configuracoes_operacionais').update({ ativo: Boolean(req.body.ativo) }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ error: error.message }); return res.json(data);
  });

  operationsRouter.put('/configuracoes/acessos/:userId', async (req: any, res) => {
    if (!isAdministrator(req.user?.roleId)) return res.status(403).json({ error: 'Apenas administradores podem alterar acessos.' });
    const perfil = ['administrador', 'colaborador', 'consulta'].includes(req.body.perfil) ? req.body.perfil : 'colaborador';
    const { data, error } = await supabase.from('acessos_operacionais_usuarios').upsert({ user_id: req.params.userId, perfil, ativo: Boolean(req.body.ativo), updated_at: new Date().toISOString() }).select().single();
    if (error) return res.status(400).json({ error: error.message }); return res.json(data);
  });

  operationsRouter.get('/tipos-tarefa', async (_req, res) => {
    const { data, error } = await supabase.from('configuracoes_operacionais').select('*').eq('categoria', 'tarefa').eq('ativo', true).order('nome');
    if (error) return res.status(500).json({ error: error.message }); return res.json(data);
  });

  operationsRouter.get('/importacoes', async (_req, res) => {
    const [configs, executions] = await Promise.all([supabase.from('integracoes_importacao').select('*').order('atualizado_em', { ascending: false }), supabase.from('importacoes_execucoes').select('*').order('iniciado_em', { ascending: false }).limit(20)]);
    if (configs.error || executions.error) return res.status(500).json({ error: configs.error?.message || executions.error?.message });
    return res.json({ configuracoes: configs.data, execucoes: executions.data });
  });

  operationsRouter.post('/importacoes', async (req: any, res) => {
    if (!await hasConfigurationAccess(supabase, req.user)) return res.status(403).json({ error: 'Somente administradores e programadores podem configurar importações.' });
    const name = required(req.body.nome); const type = req.body.tipo;
    if (!name || !['clientes','processos','tarefas','etapas','origens','usuarios','movimentacoes','documentos'].includes(type)) return res.status(400).json({ error: 'Informe nome e tipo de importação válidos.' });
    const { data, error } = await supabase.from('integracoes_importacao').insert({ nome: name, tipo: type, mapeamento: Array.isArray(req.body.mapeamento) ? req.body.mapeamento : [], ativo: req.body.ativo !== false }).select().single();
    if (error) return res.status(400).json({ error: error.message }); return res.status(201).json(data);
  });

  operationsRouter.patch('/importacoes/:id', async (req: any, res) => {
    if (!await hasConfigurationAccess(supabase, req.user)) return res.status(403).json({ error: 'Somente administradores e programadores podem configurar importações.' });
    const { data, error } = await supabase.from('integracoes_importacao').update({ nome: req.body.nome, tipo: req.body.tipo, mapeamento: req.body.mapeamento, ativo: req.body.ativo, atualizado_em: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ error: error.message }); return res.json(data);
  });

  operationsRouter.get('/importacoes/advbox/settings', async (_req, res) => {
    const token = process.env.ADVBOX_API_TOKEN;
    if (!token) return res.status(400).json({ error: 'Defina ADVBOX_API_TOKEN no .env do backend para consultar os campos do ADVBOX.' });
    try { const response = await fetch('https://app.advbox.com.br/api/v1/settings', { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) return res.status(response.status).json({ error: 'Não foi possível consultar as configurações do ADVBOX.' }); return res.json(await response.json()); } catch (error: any) { return res.status(502).json({ error: error.message }); }
  });

  operationsRouter.get('/importacoes/sugestoes/:tipo', async (req, res) => {
    const suggestions: Record<string, Array<{ source: string; target: string; required?: boolean }>> = {
      clientes: [{ source: 'id', target: 'advbox_id' }, { source: 'name', target: 'nome', required: true }, { source: 'identification', target: 'cpf' }, { source: 'email', target: 'email' }, { source: 'cellphone', target: 'telefone' }, { source: 'phone', target: 'telefone_secundario' }, { source: 'origin', target: 'origem' }, { source: 'birthdate', target: 'data_nascimento' }, { source: 'notes', target: 'observacoes' }],
      processos: [{ source: 'id', target: 'advbox_id' }, { source: 'customer_id', target: 'cliente_advbox_id', required: true }, { source: 'process_number', target: 'numero_cnj' }, { source: 'protocol_number', target: 'numero_protocolo' }, { source: 'stages_id', target: 'advbox_stage_id' }, { source: 'type_lawsuits_id', target: 'advbox_tipo_processo_id' }, { source: 'process_owner', target: 'responsavel' }, { source: 'notes', target: 'observacoes' }],
      tarefas: [{ source: 'id', target: 'advbox_id' }, { source: 'lawsuit_id', target: 'processo_advbox_id', required: true }, { source: 'task', target: 'titulo', required: true }, { source: 'notes', target: 'descricao' }, { source: 'date', target: 'prazo' }, { source: 'date_deadline', target: 'prazo_fatal' }, { source: 'local', target: 'local' }, { source: 'important', target: 'classificacao_importante' }, { source: 'urgent', target: 'classificacao_urgente' }],
      etapas: [{ source: 'id', target: 'advbox_id' }, { source: 'name', target: 'name', required: true }],
      origens: [{ source: 'id', target: 'advbox_id' }, { source: 'name', target: 'nome', required: true }],
      usuarios: [{ source: 'id', target: 'advbox_id' }, { source: 'name', target: 'nome', required: true }, { source: 'email', target: 'email' }, { source: 'cellphone', target: 'telefone' }],
      movimentacoes: [{ source: 'id', target: 'advbox_id' }, { source: 'lawsuits_id', target: 'processo_advbox_id' }, { source: 'notes', target: 'conteudo' }, { source: 'created_at', target: 'ocorrido_em' }],
      documentos: [{ source: 'id', target: 'advbox_id' }, { source: 'name', target: 'nome', required: true }, { source: 'customer_id', target: 'cliente_advbox_id' }, { source: 'task_id', target: 'tarefa_advbox_id' }],
    };
    return res.json(suggestions[req.params.tipo] || []);
  });

  operationsRouter.get('/importacoes/advbox/:tipo/preview', async (req, res) => {
    const token = process.env.ADVBOX_API_TOKEN; if (!token) return res.status(400).json({ error: 'ADVBOX_API_TOKEN não foi definido no backend.' });
    const routes: Record<string, string> = { clientes: 'customers', processos: 'lawsuits', tarefas: 'posts', movimentacoes: 'movements', documentos: 'documents', etapas: 'settings', origens: 'settings', usuarios: 'settings' };
    const route = routes[req.params.tipo]; if (!route) return res.status(400).json({ error: 'Tipo inválido.' });
    const offset = Math.max(0, Number(req.query.offset || 0));
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit || 1000)));
    const paginated = !['etapas', 'origens', 'usuarios'].includes(req.params.tipo);
    const url = new URL(`https://app.advbox.com.br/api/v1/${route}`);
    if (paginated) { url.searchParams.set('limit', String(limit)); url.searchParams.set('offset', String(offset)); }
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) return res.status(response.status).json({ error: `ADVBOX respondeu ${response.status}` });
      const body: any = await response.json(); const data = Array.isArray(body) ? body : body.data || [];
      const rows = req.params.tipo === 'etapas' ? body.stages || [] : req.params.tipo === 'origens' ? body.origins || [] : req.params.tipo === 'usuarios' ? body.users || [] : data;
      const total = Number(body.totalCount ?? body.total ?? rows.length);
      const pageSize = rows.length;
      const columns = Array.from(new Set(rows.slice(0, 20).flatMap((row: any) => Object.keys(row))));
      return res.json({ columns, rows: rows.slice(0, 10), total, offset: paginated ? offset : 0, limit: paginated ? limit : pageSize, totalNestaPagina: pageSize, proximoOffset: paginated ? offset + pageSize : null, temMais: paginated && offset + pageSize < total });
    } catch (error: any) { return res.status(502).json({ error: error.message }); }
  });

  operationsRouter.get('/importacoes/advbox/etapas/mapeamentos', async (_req, res) => {
    const [mappings, stages] = await Promise.all([
      supabase.from('advbox_stage_mappings').select('*').order('advbox_stage_name'),
      supabase.from('workflow_stages').select('id, module, categoria, name, stage_key').eq('active', true).order('module').order('position'),
    ]);
    if (mappings.error || stages.error) return res.status(500).json({ error: mappings.error?.message || stages.error?.message });
    return res.json({ mappings: mappings.data || [], stages: stages.data || [] });
  });

  operationsRouter.put('/importacoes/advbox/etapas/mapeamentos/:key', async (req: any, res) => {
    if (!await hasConfigurationAccess(supabase, req.user)) return res.status(403).json({ error: 'Somente administradores e programadores podem mapear etapas.' });
    const destination = String(req.body.destino || 'processo');
    const stageId = req.body.stageId || null;
    if (!['processo', 'atendimento', 'arquivado'].includes(destination)) return res.status(400).json({ error: 'Destino de etapa inválido.' });
    if (destination !== 'arquivado' && !stageId) return res.status(400).json({ error: 'Selecione uma etapa da Plataforma HB.' });
    const { data, error } = await supabase.from('advbox_stage_mappings').upsert({ advbox_stage_key: req.params.key, advbox_stage_name: req.body.nome || 'Etapa ADVBOX', destino: destination, stage_id: stageId, updated_at: new Date().toISOString() }, { onConflict: 'advbox_stage_key' }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  });

  operationsRouter.get('/importacoes/advbox/etapas/pendentes', async (req: any, res) => {
    if (!await hasConfigurationAccess(supabase, req.user)) return res.status(403).json({ error: 'Somente administradores e programadores podem consultar etapas.' });
    const token = process.env.ADVBOX_API_TOKEN; if (!token) return res.status(400).json({ error: 'ADVBOX_API_TOKEN não foi definido no backend.' });
    const { data: mappings, error: mappingsError } = await supabase.from('advbox_stage_mappings').select('advbox_stage_key');
    if (mappingsError) return res.status(500).json({ error: mappingsError.message });
    try {
      const mapped = new Set((mappings || []).map((item: any) => item.advbox_stage_key));
      const { data: stages, error: stagesError } = await supabase.from('workflow_stages').select('id, module, categoria, name, position').eq('active', true).order('module').order('position');
      if (stagesError) return res.status(500).json({ error: stagesError.message });
      const pending = new Map<string, { key: string; nome: string }>();
      const limit = 1000;
      for (let offset = 0; ; offset += limit) {
        const url = new URL('https://app.advbox.com.br/api/v1/lawsuits'); url.searchParams.set('limit', String(limit)); url.searchParams.set('offset', String(offset));
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error(`ADVBOX respondeu ${response.status}`);
        const body: any = await response.json(); const records = Array.isArray(body) ? body : body.data || [];
        for (const item of records) { const stage = advboxStageIdentity(item); if (!mapped.has(stage.key)) pending.set(stage.key, { key: stage.key, nome: stage.name, step: stage.step, stage: stage.stage }); }
        if (records.length < limit) break;
      }
      return res.json({ pendentes: [...pending.values()], stages: stages || [] });
    } catch (error: any) { return res.status(502).json({ error: error.message }); }
  });

  operationsRouter.post('/importacoes/advbox/clientes/importar', async (req: any, res) => {
    if (!await hasConfigurationAccess(supabase, req.user)) return res.status(403).json({ error: 'Somente administradores e programadores podem importar dados.' });
    const token = process.env.ADVBOX_API_TOKEN; if (!token) return res.status(400).json({ error: 'ADVBOX_API_TOKEN não foi definido no backend.' });
    const { data: run, error: runError } = await supabase.from('importacoes_execucoes').insert({ tipo: 'clientes', status: 'executando' }).select().single();
    if (runError) return res.status(400).json({ error: runError.message });
    try {
      const initialOffset = Math.max(0, Number(req.body?.offset || 0));
      const limit = Math.min(1000, Math.max(1, Number(req.body?.limit || 1000)));
      const importarRestantes = Boolean(req.body?.importarRestantes);
      let offset = initialOffset; let totalLido = 0; let imported = 0; let skipped = 0; let totalDisponivel: number | null = null; const errors: string[] = [];
      do {
        const url = new URL('https://app.advbox.com.br/api/v1/customers'); url.searchParams.set('limit', String(limit)); url.searchParams.set('offset', String(offset));
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error(`ADVBOX respondeu ${response.status}`);
        const body: any = await response.json(); const customers = Array.isArray(body) ? body : body.data || body.customers || body.results || body.items || [];
        totalDisponivel = Number(body.totalCount ?? body.total ?? totalDisponivel ?? customers.length);
        for (const item of customers) {
          const advboxId = String(item.id || item.customer_id || ''); const cpf = item.identification || item.cpf || null;
          if (!advboxId) { skipped++; continue; }
          const { data: existingByAdvbox } = await supabase.from('clientes').select('id').eq('advbox_id', advboxId).limit(1);
          const { data: existingByCpf } = !existingByAdvbox?.length && cpf ? await supabase.from('clientes').select('id').eq('cpf', cpf).limit(1) : { data: null };
          if (existingByAdvbox?.length) { skipped++; continue; }
          if (existingByCpf?.length) { await supabase.from('clientes').update({ advbox_id: advboxId }).eq('id', existingByCpf[0].id); skipped++; continue; }
          const customer = { advbox_id: advboxId, nome: item.name || item.full_name || 'Sem nome', cpf, email: item.email || null, telefone: item.cellphone || item.phone || null, rg: item.document || null, genero: item.gender === 'M' || item.gender === 'male' ? 'masculino' : item.gender === 'F' || item.gender === 'female' ? 'feminino' : null, estado_civil: item.civil_status || null, profissao: item.occupation || null, rua_numero: item.street || null, cep: item.postalcode || item.postal_code || null, bairro: item.region || null, cidade: item.city || null, estado: item.state || null, pais: item.country || null, pis_nis_nit: item.number_pis || item.pis || item.nis || null, origem: item.origin?.name || item.origin || null, advbox_created_at: item.created_at || null, observacoes: item.notes || null };
          const { error } = await supabase.from('clientes').insert(customer); if (error) { errors.push(`${advboxId}: ${error.message}`); skipped++; } else imported++;
        }
        totalLido += customers.length; offset += customers.length;
        if (!importarRestantes || !customers.length || customers.length < limit || (totalDisponivel !== null && offset >= totalDisponivel)) break;
      } while (true);
      const temMais = totalDisponivel !== null ? offset < totalDisponivel : false;
      await supabase.from('importacoes_execucoes').update({ status: errors.length ? 'erro' : 'concluida', total_lido: totalLido, total_importado: imported, total_ignorado: skipped, detalhes: { erros: errors.slice(0, 30), offsetInicial: initialOffset, proximoOffset: offset, totalDisponivel }, finalizado_em: new Date().toISOString() }).eq('id', run.id);
      return res.json({ totalLido, totalImportado: imported, totalIgnorado: skipped, erros: errors.slice(0, 30), offsetInicial: initialOffset, proximoOffset: offset, totalDisponivel, temMais });
    } catch (error: any) { await supabase.from('importacoes_execucoes').update({ status: 'erro', detalhes: { erro: error.message }, finalizado_em: new Date().toISOString() }).eq('id', run.id); return res.status(502).json({ error: error.message }); }
  });

  operationsRouter.post('/importacoes/advbox/processos/importar', async (req: any, res) => {
    if (!await hasConfigurationAccess(supabase, req.user)) return res.status(403).json({ error: 'Somente administradores e programadores podem importar dados.' });
    const token = process.env.ADVBOX_API_TOKEN; if (!token) return res.status(400).json({ error: 'ADVBOX_API_TOKEN não foi definido no backend.' });
    try {
      const offset = Math.max(0, Number(req.body?.offset || 0)); const limit = Math.min(1000, Math.max(1, Number(req.body?.limit || 1000)));
      const url = new URL('https://app.advbox.com.br/api/v1/lawsuits'); url.searchParams.set('limit', String(limit)); url.searchParams.set('offset', String(offset));
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }); if (!response.ok) throw new Error(`ADVBOX respondeu ${response.status}`);
      const body: any = await response.json(); const records = Array.isArray(body) ? body : body.data || [];
      const [stagesResult, mappingsResult] = await Promise.all([
        supabase.from('workflow_stages').select('id, module, categoria').eq('active', true),
        supabase.from('advbox_stage_mappings').select('advbox_stage_key, advbox_stage_name, destino, stage_id'),
      ]);
      if (stagesResult.error || mappingsResult.error) throw new Error(stagesResult.error?.message || mappingsResult.error?.message || 'Não foi possível carregar os mapeamentos de etapa.');
      const stagesById = new Map((stagesResult.data || []).map((stage: any) => [stage.id, stage]));
      const mappingByKey = new Map((mappingsResult.data || []).map((mapping: any) => [mapping.advbox_stage_key, mapping]));
      const mappingByName = new Map((mappingsResult.data || []).filter((mapping: any) => mapping.advbox_stage_name).map((mapping: any) => [String(mapping.advbox_stage_name).trim().toLowerCase(), mapping]));
      let imported = 0; let skipped = 0; const errors: string[] = []; const pendingStages = new Map<string, { key: string; nome: string; step: string; stage: string }>();
      for (const item of records) {
        const advboxId = String(item.id || item.lawsuit_id || ''); const customerId = advboxCustomerId(item); const sourceStage = advboxStageIdentity(item); const isArchived = /arquiv/.test(sourceStage.step.toLowerCase()); const stageMapping = isArchived ? { destino: 'arquivado', stage_id: null } : mappingByKey.get(sourceStage.key) || mappingByName.get(sourceStage.stage.trim().toLowerCase()) || mappingByName.get(sourceStage.name.trim().toLowerCase());
        if (!advboxId) { skipped++; continue; }
        if (!stageMapping) { pendingStages.set(sourceStage.key, { key: sourceStage.key, nome: sourceStage.name, step: sourceStage.step, stage: sourceStage.stage }); skipped++; continue; }
        if (!customerId) { errors.push(`Processo sem customer_id: ${advboxId}`); skipped++; continue; }
        let { data: client } = await supabase.from('clientes').select('id').eq('advbox_id', customerId).maybeSingle();
        if (!client) {
          const cpf = advboxCustomerCpf(item, customerId);
          if (cpf) {
            const { data: clientByCpf } = await supabase.from('clientes').select('id').in('cpf', [cpf, cpf.replace(/\D/g, '')]).maybeSingle();
            if (clientByCpf) { client = clientByCpf; await supabase.from('clientes').update({ advbox_id: customerId }).eq('id', client.id); }
          }
        }
        if (!client) { errors.push(`Cliente ADVBOX ${customerId} não foi localizado`); skipped++; continue; }
        const type = advboxValue(item.type) || advboxValue(item.type_lawsuits) || advboxValue(item.type_lawsuit);
        const mappedStage = stageMapping.stage_id ? stagesById.get(stageMapping.stage_id) : null;
        if (stageMapping.destino === 'atendimento' || mappedStage?.module === 'comercial') {
          const attendancePayload = { advbox_id: advboxId, cliente_id: client.id, stage_id: mappedStage?.id || null, assunto: type || sourceStage.name || 'Atendimento ADVBOX', descricao: item.notes || null, responsavel: advboxValue(item.process_owner), origem: 'ADVBOX' };
          const { data: attendance } = await supabase.from('atendimentos').select('id').eq('advbox_id', advboxId).maybeSingle();
          const attendanceResult = attendance ? await supabase.from('atendimentos').update(attendancePayload).eq('id', attendance.id) : await supabase.from('atendimentos').insert(attendancePayload);
          if (attendanceResult.error) { errors.push(attendanceResult.error.message); skipped++; continue; }
          const { error: deleteError } = await supabase.from('processos').delete().eq('advbox_id', advboxId);
          if (deleteError) errors.push(`Atendimento importado, mas não foi possível remover o processo duplicado ${advboxId}: ${deleteError.message}`);
          imported++; continue;
        }
        const categoria = stageMapping.destino === 'arquivado' ? 'arquivado' : mappedStage?.categoria || 'administrativo';
        const payload = { advbox_id: advboxId, cliente_id: client.id, tipo_beneficio: type, numero_cnj: item.process_number || null, numero_protocolo: item.protocol_number || null, responsavel: advboxValue(item.process_owner), observacoes: item.notes || null, categoria, stage_id: categoria === 'arquivado' ? null : mappedStage?.id || null };
        const { data: existing } = await supabase.from('processos').select('id, cliente_id').eq('advbox_id', advboxId).maybeSingle();
        if (existing) { const { error } = await supabase.from('processos').update(payload).eq('id', existing.id); if (error) { errors.push(error.message); skipped++; } else imported++; continue; }
        const { error } = await supabase.from('processos').insert(payload);
        if (error) { errors.push(error.message); skipped++; } else imported++;
      }
      // Alguns retornos do ADVBOX não trazem o total correto. Enquanto vier um lote cheio,
      // seguimos para a próxima página; uma última consulta vazia encerra a importação.
      return res.json({ totalLido: records.length, totalImportado: imported, totalIgnorado: skipped, erros: errors.slice(0, 10), etapasPendentes: [...pendingStages.values()], proximoOffset: offset + records.length, temMais: records.length === limit });
    } catch (error: any) { return res.status(502).json({ error: error.message }); }
  });

  operationsRouter.post('/importacoes/:id/executar', async (req: any, res) => {
    if (!canManageConfiguration(req.user?.roleId)) return res.status(403).json({ error: 'Somente administradores e programadores podem executar importações.' });
    const { data: config, error: configError } = await supabase.from('integracoes_importacao').select('*').eq('id', req.params.id).single();
    if (configError || !config) return res.status(404).json({ error: 'Mapeamento não encontrado.' });
    const { data: run, error: runError } = await supabase.from('importacoes_execucoes').insert({ integracao_id: config.id, tipo: config.tipo, status: 'executando' }).select().single();
    if (runError) return res.status(400).json({ error: runError.message });
    const routes: Record<string, string> = { clientes: 'customers', processos: 'lawsuits', tarefas: 'posts', movimentacoes: 'movements', documentos: 'documents', etapas: 'settings', origens: 'settings', usuarios: 'settings' };
    try { const response = await fetch(`https://app.advbox.com.br/api/v1/${routes[config.tipo]}`, { headers: { Authorization: `Bearer ${process.env.ADVBOX_API_TOKEN || ''}` } }); if (!response.ok) throw new Error(`ADVBOX respondeu ${response.status}`); const payload: any = await response.json(); const records = Array.isArray(payload) ? payload : payload.data || []; await supabase.from('importacoes_execucoes').update({ status: 'concluida', total_lido: records.length, total_importado: 0, total_ignorado: records.length, detalhes: { mensagem: 'Leitura concluída. A gravação é habilitada após validar os campos obrigatórios do mapeamento.', amostra: records.slice(0, 3) }, finalizado_em: new Date().toISOString() }).eq('id', run.id); return res.json({ id: run.id, totalLido: records.length, preview: records.slice(0, 3) }); } catch (error: any) { await supabase.from('importacoes_execucoes').update({ status: 'erro', detalhes: { erro: error.message }, finalizado_em: new Date().toISOString() }).eq('id', run.id); return res.status(502).json({ error: error.message }); }
  });

  operationsRouter.post('/tags', async (req: any, res) => {
    if (!canManageConfiguration(req.user?.roleId)) return res.status(403).json({ error: 'Somente administradores e programadores podem criar tags.' });
    const name = required(req.body.name);
    if (!name) return res.status(400).json({ error: 'Informe o nome da tag.' });
    const { data, error } = await supabase.from('tags').insert({ name, color: req.body.color || '#2563eb' }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  });

  operationsRouter.get('/atendimentos', async (req, res) => {
    let query: any = supabase.from('atendimentos').select('*, atendimento_tags(tag_id, tags(id, name, color))').order('created_at', { ascending: false });
    query = req.query.arquivados === 'true' ? query.eq('status_conversao', 'encerrado') : query.neq('status_conversao', 'encerrado');
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  operationsRouter.post('/atendimentos', async (req, res) => {
    const clienteId = required(req.body.clienteId || req.body.cliente_id || req.body.clientId);
    const assunto = required(req.body.assunto);
    if (!clienteId || !assunto) return res.status(400).json({ error: 'Cliente e assunto são obrigatórios.' });
    const { data, error } = await supabase.from('atendimentos').insert({
      cliente_id: clienteId, stage_id: req.body.stageId || null, assunto, descricao: req.body.descricao || null,
      responsavel: req.body.responsavel || null, origem: req.body.origem || null,
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    try { await replaceTags(supabase, 'atendimento_tags', 'atendimento_id', data.id, req.body.tagIds); } catch (tagError: any) { return res.status(400).json({ error: tagError.message }); }
    return res.status(201).json(data);
  });

  operationsRouter.patch('/atendimentos/:id', async (req, res) => {
    const { clienteId, assunto, descricao, responsavel, origem, stageId, statusConversao } = req.body;
    let automaticStatus = statusConversao;
    if (stageId) { const { data: stage } = await supabase.from('workflow_stages').select('stage_key').eq('id', stageId).single(); if (stage?.stage_key === 'encerrado') automaticStatus = 'encerrado'; }
    const { data, error } = await supabase.from('atendimentos').update({
      ...(clienteId && { cliente_id: clienteId }), ...(assunto && { assunto }), descricao: descricao || null,
      responsavel: responsavel || null, origem: origem || null, stage_id: stageId || null, ...(automaticStatus && { status_conversao: automaticStatus }), updated_at: new Date().toISOString(),
    }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    try { await replaceTags(supabase, 'atendimento_tags', 'atendimento_id', data.id, req.body.tagIds); } catch (tagError: any) { return res.status(400).json({ error: tagError.message }); }
    return res.json(data);
  });

  operationsRouter.post('/atendimentos/:id/arquivar', async (req, res) => {
    const { data, error } = await supabase.from('atendimentos').update({ status_conversao: 'encerrado', updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ error: error.message }); return res.json(data);
  });

  operationsRouter.get('/processos', async (_req, res) => {
    const all: any[] = []; const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase.from('processos').select('*, processo_tags(tag_id, tags(id, name, color))').order('created_at', { ascending: false }).range(from, from + pageSize - 1);
      if (error) return res.status(500).json({ error: error.message });
      all.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    return res.json(all);
  });

  operationsRouter.get('/cnj/:numero', async (req, res) => {
    const numero = String(req.params.numero || '').replace(/\D/g, '');
    if (numero.length !== 20) return res.status(400).json({ error: 'Informe um número CNJ com 20 dígitos.' });
    const ano = numero.slice(9, 13); const segmento = numero.slice(13, 14); const tribunalCode = numero.slice(14, 16);
    const aliases: Record<string, string> = { '806': 'tjce', '826': 'tjpe', '819': 'tjrj', '835': 'tjsp', '405': 'trf5', '505': 'trt5' };
    const alias = aliases[`${segmento}${tribunalCode}`];
    const tribunal = segmento === '8' ? `TJ${tribunalCode}` : segmento === '4' ? `TRF${tribunalCode}` : segmento === '5' ? `TRT${tribunalCode}` : 'Justiça brasileira';
    if (!alias) return res.json({ anoAjuizamento: ano, tribunal, sistemaEletronico: 'Não identificado pelo CNJ', vara: '' });
    try {
      const key = process.env.DATAJUD_API_KEY || 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
      const response = await fetch(`https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`, { method: 'POST', headers: { Authorization: `APIKey ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ size: 1, query: { match: { numeroProcesso: numero } } }) });
      if (!response.ok) return res.json({ anoAjuizamento: ano, tribunal, sistemaEletronico: 'Não identificado pelo CNJ', vara: '' });
      const body: any = await response.json(); const source = body?.hits?.hits?.[0]?._source || {};
      return res.json({ anoAjuizamento: ano, tribunal: source.tribunal || tribunal, vara: source.orgaoJulgador?.nome || '', sistemaEletronico: source.sistema?.nome || source.sistema || 'DataJud' });
    } catch { return res.json({ anoAjuizamento: ano, tribunal, sistemaEletronico: 'Não identificado pelo CNJ', vara: '' }); }
  });

  operationsRouter.get('/clientes/:id/grupo-familiar', async (req, res) => {
    const { data, error } = await supabase.from('cliente_grupo_familiar').select('*').eq('cliente_id', req.params.id).order('data_nascimento');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  operationsRouter.post('/clientes/:id/grupo-familiar', async (req, res) => {
    const nome = required(req.body.nome); const parentesco = required(req.body.parentesco);
    if (!nome || !parentesco) return res.status(400).json({ error: 'Nome e parentesco são obrigatórios.' });
    const { data, error } = await supabase.from('cliente_grupo_familiar').insert({ cliente_id: req.params.id, nome, parentesco, data_nascimento: req.body.dataNascimento || null, renda: req.body.renda || null }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  });

  operationsRouter.patch('/clientes/:id/grupo-familiar/:memberId', async (req, res) => {
    const { data, error } = await supabase.from('cliente_grupo_familiar').update({ nome: req.body.nome, parentesco: req.body.parentesco, data_nascimento: req.body.dataNascimento || null, renda: req.body.renda || null }).eq('id', req.params.memberId).eq('cliente_id', req.params.id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  });

  operationsRouter.post('/processos', async (req, res) => {
    const clienteId = required(req.body.clienteId || req.body.cliente_id || req.body.clientId);
    if (!clienteId) return res.status(400).json({ error: 'Cliente é obrigatório.' });
    const payload = {
      cliente_id: clienteId, atendimento_id: req.body.atendimentoId || null, stage_id: req.body.stageId || null,
      tipo_beneficio: req.body.tipoBeneficio || null, responsavel: req.body.responsavel || null,
      numero_requerimento: req.body.numeroRequerimento || null, numero_beneficio: req.body.numeroBeneficio || null,
      numero_cnj: req.body.numeroCnj || null, pasta_nextcloud_url: req.body.pastaNextcloudUrl || null,
      numero_protocolo: req.body.numeroProtocolo || null, observacoes: req.body.observacoes || null,
      categoria: req.body.categoria || 'administrativo', data_cadastro: req.body.dataCadastro || new Date().toISOString().slice(0, 10),
      data_requerimento: req.body.dataRequerimento || null, ano_ajuizamento: req.body.anoAjuizamento || null,
      segmento_judiciario: req.body.segmentoJudiciario || null, comarca: req.body.comarca || null, vara: req.body.vara || null,
      tribunal: req.body.tribunal || null, sistema_eletronico: req.body.sistemaEletronico || null,
      valor_causa: req.body.valorCausa || null, contingenciamento: req.body.contingenciamento || null,
      data_fechamento: req.body.dataFechamento || null, data_transito_julgado: req.body.dataTransitoJulgado || null,
      data_arquivamento: req.body.dataArquivamento || null, resultado_processo: req.body.resultadoProcesso || null,
    };
    let { data, error } = await supabase.from('processos').insert(payload).select().single();
    // Compatibilidade com instalações que ainda não executaram a migração de campos avançados.
    if (error) {
      ({ data, error } = await supabase.from('processos').insert({ cliente_id: clienteId, atendimento_id: req.body.atendimentoId || null, stage_id: req.body.stageId || null, tipo_beneficio: req.body.tipoBeneficio || null, responsavel: req.body.responsavel || null, numero_protocolo: req.body.numeroProtocolo || null, observacoes: req.body.observacoes || null }).select().single());
    }
    if (error || !data) return res.status(400).json({ error: error?.message || 'Não foi possível criar o processo.', details: { clienteId, camposRecebidos: Object.keys(req.body || {}) } });
    try { await replaceTags(supabase, 'processo_tags', 'processo_id', data.id, req.body.tagIds); } catch (tagError: any) { return res.status(400).json({ error: tagError.message }); }
    return res.status(201).json(data);
  });

  operationsRouter.patch('/processos/:id', async (req, res) => {
    const payload = {
      cliente_id: req.body.clienteId || null, stage_id: req.body.stageId || null, tipo_beneficio: req.body.tipoBeneficio || null, responsavel: req.body.responsavel || null,
      numero_requerimento: req.body.numeroRequerimento || null, numero_beneficio: req.body.numeroBeneficio || null,
      numero_cnj: req.body.numeroCnj || null, pasta_nextcloud_url: req.body.pastaNextcloudUrl || null,
      numero_protocolo: req.body.numeroProtocolo || null, resultado: req.body.resultado || null,
      destino_resultado: req.body.destinoResultado || null, observacoes: req.body.observacoes || null, updated_at: new Date().toISOString(),
      categoria: req.body.categoria || 'administrativo', data_requerimento: req.body.dataRequerimento || null,
      ano_ajuizamento: req.body.anoAjuizamento || null, segmento_judiciario: req.body.segmentoJudiciario || null,
      comarca: req.body.comarca || null, vara: req.body.vara || null, tribunal: req.body.tribunal || null,
      sistema_eletronico: req.body.sistemaEletronico || null, valor_causa: req.body.valorCausa || null,
      contingenciamento: req.body.contingenciamento || null, data_cadastro: req.body.dataCadastro || null,
      data_fechamento: req.body.dataFechamento || null, data_transito_julgado: req.body.dataTransitoJulgado || null,
      data_arquivamento: req.body.dataArquivamento || null, resultado_processo: req.body.resultadoProcesso || null,
    };
    let { data, error } = await supabase.from('processos').update(payload).eq('id', req.params.id).select().single();
    if (error) ({ data, error } = await supabase.from('processos').update({ cliente_id: req.body.clienteId || null, stage_id: req.body.stageId || null, tipo_beneficio: req.body.tipoBeneficio || null, responsavel: req.body.responsavel || null, numero_protocolo: req.body.numeroProtocolo || null, observacoes: req.body.observacoes || null, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single());
    if (error) return res.status(400).json({ error: error.message });
    try { await replaceTags(supabase, 'processo_tags', 'processo_id', data.id, req.body.tagIds); } catch (tagError: any) { return res.status(400).json({ error: tagError.message }); }
    return res.json(data);
  });

  operationsRouter.get('/processos/:id/partes', async (req, res) => {
    const { data, error } = await supabase.from('processo_partes').select('*').eq('processo_id', req.params.id).order('created_at');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  operationsRouter.post('/processos/:id/partes', async (req, res) => {
    const nome = required(req.body.nome); const tipo = required(req.body.tipo);
    if (!nome || !tipo) return res.status(400).json({ error: 'Nome e tipo da parte são obrigatórios.' });
    const { data, error } = await supabase.from('processo_partes').insert({ processo_id: req.params.id, nome, tipo }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  });

  operationsRouter.get('/processos/:id/andamentos', async (req: any, res) => {
    const { data, error } = await supabase.from('processo_andamentos').select('*').eq('processo_id', req.params.id).order('ocorrido_em', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    const isAdmin = String(req.user?.roleName || '').toLowerCase() === 'admin';
    return res.json((data || []).filter((item) => !item.segredo || isAdmin || String(item.autor_id) === String(req.user?.id)));
  });

  operationsRouter.post('/processos/:id/andamentos', async (req: any, res) => {
    const conteudo = required(req.body.conteudo);
    if (!conteudo) return res.status(400).json({ error: 'Informe o andamento.' });
    const { data, error } = await supabase.from('processo_andamentos').insert({ processo_id: req.params.id, conteudo, segredo: Boolean(req.body.segredo), autor_id: req.user?.id || null, autor_nome: req.user?.name || 'Usuário', tipo: 'manual' }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  });

  operationsRouter.post('/atendimentos/:id/converter', async (req, res) => {
    const { data: atendimento, error: attendanceError } = await supabase.from('atendimentos').select('*').eq('id', req.params.id).single();
    if (attendanceError || !atendimento) return res.status(404).json({ error: 'Atendimento não encontrado.' });
    if (atendimento.processo_id) return res.status(409).json({ error: 'Este atendimento já foi convertido em processo.' });
    const { data: initialStage } = await supabase.from('workflow_stages').select('id').eq('module', 'processos').eq('stage_key', 'contrato_fechado').single();
    const { data: processo, error: processError } = await supabase.from('processos').insert({ cliente_id: atendimento.cliente_id, atendimento_id: atendimento.id, stage_id: initialStage?.id || null, tipo_beneficio: req.body.tipoBeneficio || null, responsavel: atendimento.responsavel || null }).select().single();
    if (processError) return res.status(400).json({ error: processError.message });
    const { error: updateError } = await supabase.from('atendimentos').update({ status_conversao: 'convertido', processo_id: processo.id, updated_at: new Date().toISOString() }).eq('id', atendimento.id);
    if (updateError) return res.status(500).json({ error: updateError.message });
    return res.status(201).json(processo);
  });

  operationsRouter.get('/tarefas', async (req, res) => {
    let query = supabase.from('tarefas').select('*').order('prazo', { ascending: true });
    if (req.query.atendimentoId) query = query.eq('atendimento_id', String(req.query.atendimentoId));
    if (req.query.processoId) query = query.eq('processo_id', String(req.query.processoId));
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  operationsRouter.get('/tarefas/:id/comentarios', async (req, res) => {
    const { data, error } = await supabase.from('tarefa_comentarios').select('*').eq('tarefa_id', req.params.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  operationsRouter.post('/tarefas/:id/comentarios', async (req: any, res) => {
    const conteudo = required(req.body.conteudo);
    if (!conteudo) return res.status(400).json({ error: 'Escreva um comentário.' });
    const { data, error } = await supabase.from('tarefa_comentarios').insert({ tarefa_id: req.params.id, conteudo, autor_id: req.user?.id || null, autor_nome: req.user?.name || 'Usuário' }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  });

  operationsRouter.patch('/tarefas/:id', async (req, res) => {
    const titulo = required(req.body.titulo);
    const { data, error } = await supabase.from('tarefas').update({
      ...(titulo && { titulo }), descricao: req.body.descricao || null, responsavel: req.body.responsavel || null,
      prazo: req.body.prazo || null, hora: req.body.hora || null, prazo_fatal: req.body.prazoFatal || null,
      tipo: req.body.tipo || 'tarefa', local: req.body.local || null, classificacao: req.body.classificacao || 'normal',
      ocultar_ate: req.body.ocultarAte || null, instrucao_necessaria: Boolean(req.body.instrucaoNecessaria),
      situacao_evento: req.body.situacaoEvento || null,
      status: req.body.status || 'pendente', concluida_em: req.body.status === 'concluida' ? new Date().toISOString() : null,
    }).eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.json(data);
  });

  operationsRouter.get('/modelos-tarefa', async (_req, res) => {
    const { data, error } = await supabase.from('modelos_tarefa').select('*').eq('ativo', true).order('titulo');
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  operationsRouter.post('/modelos-tarefa', async (req: any, res) => {
    if (!isAdministrator(req.user?.roleId)) return res.status(403).json({ error: 'Apenas administradores podem criar modelos de tarefa.' });
    const titulo = required(req.body.titulo);
    if (!titulo) return res.status(400).json({ error: 'Informe o título do modelo.' });
    const { data, error } = await supabase.from('modelos_tarefa').insert({ titulo, tipo: req.body.tipo === 'evento' ? 'evento' : 'tarefa', descricao: req.body.descricao || null }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json(data);
  });

  operationsRouter.post('/tarefas', async (req, res) => {
    const clienteId = required(req.body.clienteId);
    const titulo = required(req.body.titulo);
    if (!clienteId || !titulo) return res.status(400).json({ error: 'Cliente e título são obrigatórios.' });
    const { data, error } = await supabase.from('tarefas').insert({ cliente_id: clienteId, atendimento_id: req.body.atendimentoId || null, processo_id: req.body.processoId || null, tarefa_pai_id: req.body.tarefaPaiId || null, titulo, descricao: req.body.descricao || null, responsavel: req.body.responsavel || null, prazo: req.body.prazo || null, prioridade: req.body.prioridade || 'normal', hora: req.body.hora || null, prazo_fatal: req.body.prazoFatal || null, tipo: req.body.tipo || 'tarefa', local: req.body.local || null, classificacao: req.body.classificacao || 'normal', ocultar_ate: req.body.ocultarAte || null, instrucao_necessaria: Boolean(req.body.instrucaoNecessaria), situacao_evento: req.body.situacaoEvento || null }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    const lembretes = Array.isArray(req.body.lembretes) ? req.body.lembretes.filter((dias: unknown): dias is number => typeof dias === 'number' && Number.isInteger(dias) && dias >= 0) : [];
    const supportsReminderTasks = ['Perícia Médica', 'Avaliação Social', 'Audiência'].includes(titulo);
    if (lembretes.length && supportsReminderTasks) {
      await supabase.from('lembretes_tarefa').insert(lembretes.map((dias: number) => ({ tarefa_id: data.id, dias_antes: dias })));
      if (req.body.prazo) {
        const dueDate = new Date(`${req.body.prazo}T12:00:00`);
        const reminders = lembretes.map((dias: number) => { const date = new Date(dueDate); date.setDate(date.getDate() - dias); return { cliente_id: clienteId, atendimento_id: req.body.atendimentoId || null, processo_id: req.body.processoId || null, tarefa_pai_id: data.id, titulo: `Lembrete: ${titulo} (${dias} dias)`, responsavel: req.body.responsavel || null, prazo: date.toISOString().slice(0, 10), prioridade: req.body.prioridade || 'normal', classificacao: 'normal', tipo: 'tarefa' }; });
        const { error: reminderError } = await supabase.from('tarefas').insert(reminders);
        if (reminderError) return res.status(400).json({ error: reminderError.message });
      }
    }
    if (data.tipo === 'evento' && data.instrucao_necessaria) await supabase.from('tarefas').insert({ cliente_id: clienteId, atendimento_id: req.body.atendimentoId || null, processo_id: req.body.processoId || null, titulo: `Instrução: ${titulo}`, responsavel: req.body.responsavel || null, prazo: req.body.prazo || null, prioridade: 'alta', classificacao: 'importante' });
    return res.status(201).json(data);
  });

  return operationsRouter;
}
