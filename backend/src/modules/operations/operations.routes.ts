import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { authenticateToken } from '../../core/auth/auth.middleware';

const operationsRouter = Router();

function required(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isAdministrator(roleId: unknown): boolean {
  return ['admin', 'administrador', '1'].includes(String(roleId || '').trim().toLowerCase());
}
function canManageConfiguration(roleId: unknown): boolean {
  return isAdministrator(roleId) || ['programador', 'developer', '2'].includes(String(roleId || '').trim().toLowerCase());
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
    if (!isAdministrator(req.user?.roleId)) return res.status(403).json({ error: 'Apenas administradores podem alterar cadastros.' });
    const type = req.params.tipo; const body = req.body;
    if (type === 'usuarios') {
      const nome = required(body.nome); const email = required(body.email); const senha = required(body.senha);
      if (!nome || !email || !senha) return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
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
    if (!isAdministrator(req.user?.roleId)) return res.status(403).json({ error: 'Apenas administradores podem alterar cadastros.' });
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
    const clienteId = required(req.body.clienteId);
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

  operationsRouter.get('/processos', async (_req, res) => {
    const { data, error } = await supabase.from('processos').select('*, processo_tags(tag_id, tags(id, name, color))').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  operationsRouter.post('/processos', async (req, res) => {
    const clienteId = required(req.body.clienteId);
    if (!clienteId) return res.status(400).json({ error: 'Cliente é obrigatório.' });
    const { data, error } = await supabase.from('processos').insert({
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
    }).select().single();
    if (error) return res.status(400).json({ error: error.message });
    try { await replaceTags(supabase, 'processo_tags', 'processo_id', data.id, req.body.tagIds); } catch (tagError: any) { return res.status(400).json({ error: tagError.message }); }
    return res.status(201).json(data);
  });

  operationsRouter.patch('/processos/:id', async (req, res) => {
    const { data, error } = await supabase.from('processos').update({
      stage_id: req.body.stageId || null, tipo_beneficio: req.body.tipoBeneficio || null, responsavel: req.body.responsavel || null,
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
    }).eq('id', req.params.id).select().single();
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
    const { data, error } = await supabase.from('tarefas').insert({ cliente_id: clienteId, atendimento_id: req.body.atendimentoId || null, processo_id: req.body.processoId || null, tarefa_pai_id: req.body.tarefaPaiId || null, titulo, descricao: req.body.descricao || null, responsavel: req.body.responsavel || null, prazo: req.body.prazo || null, prioridade: req.body.prioridade || 'normal', hora: req.body.hora || null, prazo_fatal: req.body.prazoFatal || null, tipo: req.body.tipo || 'tarefa', local: req.body.local || null, classificacao: req.body.classificacao || 'normal', ocultar_ate: req.body.ocultarAte || null, instrucao_necessaria: Boolean(req.body.instrucaoNecessaria) }).select().single();
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
