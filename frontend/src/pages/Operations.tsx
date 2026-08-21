import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ExternalLink, FolderOpen, MessageCircle, Plus, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { TaskModal } from '../components/TaskModal';

type Client = { id: string | number; nome?: string; name?: string; cpf?: string; telefone?: string; phone?: string; telefone_secundario?: string };
type Stage = { id: string; name: string; stage_key: string; categoria?: string; limite_dias?: number | null };
type LinkedTag = { tags?: { id: string; name: string; color: string } | null };
type Attendance = { id: string; cliente_id: string; stage_id?: string | null; assunto: string; responsavel?: string | null; status_conversao: string; created_at: string; atendimento_tags?: LinkedTag[] };
type Process = { id: string; cliente_id: string; stage_id?: string | null; tipo_beneficio?: string | null; responsavel?: string | null; numero_protocolo?: string | null; numero_cnj?: string | null; pasta_nextcloud_url?: string | null; resultado?: string | null; destino_resultado?: string | null; created_at: string; processo_tags?: LinkedTag[] };
type TagItem = { id: string; name: string; color: string };

interface OperationsProps { mode: 'comercial' | 'processos'; clients: Client[]; onNewClient: () => void; initialClientId?: string | null; initialProcessId?: string | null; onInitialClientUsed?: () => void; onInitialProcessUsed?: () => void; }

const clientName = (clients: Client[], id: string) => clients.find((client) => String(client.id) === String(id))?.nome || clients.find((client) => String(client.id) === String(id))?.name || 'Cliente não localizado';

export function Operations({ mode, clients, onNewClient, initialClientId, initialProcessId, onInitialClientUsed, onInitialProcessUsed }: OperationsProps) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<TagItem[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'all' | 'any' | 'none'>('any');
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showArchivedProcesses, setShowArchivedProcesses] = useState(false);
  const [users, setUsers] = useState<{ id?: string; userid?: string; name?: string; username?: string }[]>([]);
  const [taskContext, setTaskContext] = useState<{ clienteId: string; atendimentoId?: string; processoId?: string; title: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'dados' | 'tarefas'>('dados');
  const [linkedTasks, setLinkedTasks] = useState<{ id: string; titulo: string; descricao?: string | null; responsavel?: string | null; prazo?: string | null; classificacao?: string; status?: string; tarefa_pai_id?: string | null }[]>([]);
  const [stageFilter, setStageFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [pageLimit, setPageLimit] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);

  const isCommercial = mode === 'comercial';
  const title = isCommercial ? 'Atendimentos comerciais' : 'Processos';
  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage.name])), [stages]);
  const stageLimits = useMemo(() => new Map(stages.map((stage) => [stage.id, stage.limite_dias])), [stages]);

  const load = async () => {
    setError('');
    try {
      const [stagesResponse, recordsResponse, tagsResponse, usersResponse] = await Promise.all([
        api.get(`/api/operacional/stages/${mode}`),
        api.get(isCommercial ? `/api/operacional/atendimentos?arquivados=${showArchived}` : '/api/operacional/processos'),
        api.get(`/api/operacional/tags?uso=${isCommercial ? 'atendimento' : 'processo'}`),
        api.get('/api/users'),
      ]);
      setStages(stagesResponse.data);
      setTags(tagsResponse.data);
      setUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
      if (isCommercial) setAttendances(recordsResponse.data); else setProcesses(recordsResponse.data);
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || 'Não foi possível carregar o módulo. Confirme se a migração SQL foi executada no Supabase.');
    }
  };

  useEffect(() => { load(); }, [mode, showArchived]);

  useEffect(() => {
    if (isCommercial) return;
    const number = String(form.numeroCnj || '').replace(/\D/g, '');
    if (number.length !== 20) return;
    const timer = window.setTimeout(() => {
      api.get(`/api/operacional/cnj/${number}`).then((response) => setForm((current) => ({ ...current, anoAjuizamento: response.data.anoAjuizamento || current.anoAjuizamento, tribunal: response.data.tribunal || current.tribunal, vara: response.data.vara || current.vara, sistemaEletronico: response.data.sistemaEletronico || current.sistemaEletronico }))).catch(() => undefined);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [form.numeroCnj, isCommercial]);

  useEffect(() => {
    if (isCommercial || !stages.length) return;
    const available = stages.filter((stage) => stage.categoria === (form.categoria || 'administrativo'));
    if (available.length && !available.some((stage) => stage.id === form.stageId)) setForm((current) => ({ ...current, stageId: available[0].id }));
  }, [form.categoria, form.stageId, stages, isCommercial]);

  useEffect(() => { if (!isCommercial && initialClientId) { openForm(); setForm((current) => ({ ...current, clienteId: initialClientId })); onInitialClientUsed?.(); } }, [initialClientId, isCommercial]);

  useEffect(() => { if (!isCommercial && initialProcessId && processes.length) { const process = processes.find((item) => item.id === initialProcessId); if (process) editRecord(process); onInitialProcessUsed?.(); } }, [initialProcessId, processes, isCommercial]);

  const openForm = () => {
    setForm({ clienteId: '', stageId: stages[0]?.id || '', assunto: '', responsavel: '', tipoBeneficio: '', numeroProtocolo: '', numeroRequerimento: '', numeroBeneficio: '', numeroCnj: '', pastaNextcloudUrl: '', descricao: '', observacoes: '', categoria: 'administrativo', dataRequerimento: '', anoAjuizamento: '', segmentoJudiciario: '', comarca: '', vara: '', tribunal: '', sistemaEletronico: '', valorCausa: '', contingenciamento: '', dataCadastro: '', dataFechamento: '', dataTransitoJulgado: '', dataArquivamento: '', resultadoProcesso: '' });
    setSelectedTagIds([]);
    setEditingId(null);
    setShowForm(true);
  };

  const editRecord = (record: Attendance | Process) => {
    const recordTags = isCommercial ? (record as Attendance).atendimento_tags : (record as Process).processo_tags;
    setSelectedTagIds(recordTags?.map((item) => item.tags?.id).filter((id): id is string => Boolean(id)) || []);
    const process = record as Process & Record<string, string | null | undefined>;
    setForm({ clienteId: record.cliente_id, stageId: record.stage_id || '', assunto: isCommercial ? (record as Attendance).assunto : '', statusConversao: isCommercial ? (record as Attendance).status_conversao : '', responsavel: record.responsavel || '', tipoBeneficio: !isCommercial ? process.tipo_beneficio || '' : '', numeroProtocolo: !isCommercial ? process.numero_protocolo || '' : '', numeroRequerimento: !isCommercial ? process.numero_requerimento || '' : '', numeroBeneficio: !isCommercial ? process.numero_beneficio || '' : '', numeroCnj: !isCommercial ? process.numero_cnj || '' : '', pastaNextcloudUrl: !isCommercial ? process.pasta_nextcloud_url || '' : '', descricao: isCommercial ? (record as Attendance & Record<string, string | null>).descricao || '' : '', observacoes: !isCommercial ? process.observacoes || '' : '', categoria: !isCommercial ? process.categoria || 'administrativo' : 'administrativo', dataRequerimento: !isCommercial ? process.data_requerimento || '' : '', anoAjuizamento: !isCommercial ? process.ano_ajuizamento || '' : '', segmentoJudiciario: !isCommercial ? process.segmento_judiciario || '' : '', comarca: !isCommercial ? process.comarca || '' : '', vara: !isCommercial ? process.vara || '' : '', tribunal: !isCommercial ? process.tribunal || '' : '', sistemaEletronico: !isCommercial ? process.sistema_eletronico || '' : '', valorCausa: !isCommercial ? process.valor_causa || '' : '', contingenciamento: !isCommercial ? process.contingenciamento || '' : '', dataCadastro: !isCommercial ? process.data_cadastro || '' : '', dataFechamento: !isCommercial ? process.data_fechamento || '' : '', dataTransitoJulgado: !isCommercial ? process.data_transito_julgado || '' : '', dataArquivamento: !isCommercial ? process.data_arquivamento || '' : '', resultadoProcesso: !isCommercial ? process.resultado_processo || '' : '' });
    setEditingId(record.id); setDetailTab('dados'); setShowForm(true);
    const taskParam = isCommercial ? `atendimentoId=${record.id}` : `processoId=${record.id}`;
    api.get(`/api/operacional/tarefas?${taskParam}`).then((response) => setLinkedTasks(response.data)).catch(() => setLinkedTasks([]));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const path = isCommercial ? '/api/operacional/atendimentos' : '/api/operacional/processos';
      if (editingId) await api.patch(`${path}/${editingId}`, { ...form, tagIds: selectedTagIds });
      else await api.post(path, { ...form, tagIds: selectedTagIds });
      setShowForm(false);
      await load();
    } catch (requestError: any) {
      const response = requestError.response?.data; setError(`${response?.error || 'Não foi possível salvar o registro.'}${response?.details?.clienteId ? ` Cliente recebido: ${response.details.clienteId}.` : ''}`);
    } finally { setSaving(false); }
  };
  const archiveAttendance = async () => { if (!editingId || !window.confirm('Encerrar e arquivar este atendimento?')) return; try { await api.post(`/api/operacional/atendimentos/${editingId}/arquivar`); setShowForm(false); await load(); } catch (requestError: any) { setError(requestError.response?.data?.error || 'Não foi possível arquivar o atendimento.'); } };

  const convert = async (attendance: Attendance) => {
    const tipoBeneficio = '';
    try {
      await api.post(`/api/operacional/atendimentos/${attendance.id}/converter`, { tipoBeneficio });
      await load();
      alert('Atendimento convertido em processo na etapa “Contrato fechado / Em cadastro”.');
    } catch (requestError: any) {
      setError(requestError.response?.data?.error || 'Não foi possível converter o atendimento.');
    }
  };

  const createTask = (record: Attendance | Process) => {
    setTaskContext({
      clienteId: record.cliente_id,
      ...(isCommercial ? { atendimentoId: record.id } : { processoId: record.id }),
      title: isCommercial ? (record as Attendance).assunto : (record as Process).tipo_beneficio || 'Processo',
    });
  };
  const reloadLinkedTasks = () => { if (!editingId) return; const taskParam = isCommercial ? `atendimentoId=${editingId}` : `processoId=${editingId}`; api.get(`/api/operacional/tarefas?${taskParam}`).then((response) => setLinkedTasks(response.data)).catch(() => setLinkedTasks([])); };


  const records = isCommercial ? attendances : processes;
  const filteredRecords = records.filter((record) => {
    const term = search.toLowerCase();
    const recordTags = isCommercial ? (record as Attendance).atendimento_tags : (record as Process).processo_tags;
    const matchesText = !term || clientName(clients, record.cliente_id).toLowerCase().includes(term) || (isCommercial ? (record as Attendance).assunto : (record as Process).tipo_beneficio || '').toLowerCase().includes(term);
    const recordTagIds = recordTags?.map((item) => item.tags?.id).filter((id): id is string => Boolean(id)) || [];
    const matchesTags = !tagFilter.length || (tagFilterMode === 'all' ? tagFilter.every((id) => recordTagIds.includes(id)) : tagFilterMode === 'any' ? tagFilter.some((id) => recordTagIds.includes(id)) : tagFilter.every((id) => !recordTagIds.includes(id)));
    return matchesText && matchesTags && (!stageFilter || record.stage_id === stageFilter) && (isCommercial || (categoryFilter ? (record as any).categoria === categoryFilter : (showArchivedProcesses ? (record as any).categoria === 'arquivado' : (record as any).categoria !== 'arquivado')));
  });
  const canSeeFinance = (() => { try { const roleId = String(JSON.parse(localStorage.getItem('@PlataformaHB:user') || '{}').roleId || '').toLowerCase(); return ['admin', 'administrador', 'programador', 'programmer', 'developer', '1', '2', '3'].includes(roleId); } catch { return false; } })();
  const workflowGroups = isCommercial ? [] : [
    { name: 'Administrativo', category: 'administrativo', color: 'bg-blue-600' },
    { name: 'Judicial', category: 'judicial', color: 'bg-indigo-600' },
    ...(canSeeFinance ? [{ name: 'Financeiro', category: 'financeiro', color: 'bg-emerald-600' }] : []),
  ];
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageLimit));
  const safePage = Math.min(currentPage, totalPages);
  const visibleRecords = filteredRecords.slice((safePage - 1) * pageLimit, safePage * pageLimit);

  if (taskContext) return <TaskModal context={taskContext} users={users} onSaved={reloadLinkedTasks} onClose={() => setTaskContext(null)} />;

  return <>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
      <div><h2 className="text-2xl font-bold text-slate-900">{title}</h2><p className="text-sm text-slate-500 mt-1">{isCommercial ? 'Registre atendimentos e converta contratos fechados em processos.' : 'Acompanhe cada processo pela etapa operacional atual.'}</p></div>
      <button onClick={openForm} className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-blue-600/20"><Plus size={18} />{isCommercial ? 'Novo atendimento' : 'Novo processo'}</button>
    </div>

    {!isCommercial && <div className="mb-6 space-y-5">{workflowGroups.map((group) => <section key={group.category}><h3 className="mb-2 text-sm font-bold uppercase text-slate-700">{group.name} <span className="ml-1 text-blue-700">({processes.filter((process: any) => (process.categoria || 'administrativo') === group.category).length})</span></h3><div className="flex min-w-max gap-1 overflow-x-auto pb-2">{stages.filter((stage) => stage.categoria === group.category).map((stage) => { const count = processes.filter((process: any) => (process.categoria || 'administrativo') === group.category && process.stage_id === stage.id).length; const selected = stageFilter === stage.id && categoryFilter === group.category; return <div key={stage.id} className="w-40 shrink-0"><p className="mb-1 h-8 text-center text-xs font-semibold leading-4 text-slate-700">{stage.name}</p><button onClick={() => { setStageFilter(selected ? '' : stage.id); setCategoryFilter(selected ? '' : group.category); }} className={`relative w-full px-6 py-4 pr-10 text-center text-white transition ${group.color} ${selected ? 'ring-2 ring-slate-900 ring-offset-2' : 'hover:brightness-110'}`} style={{ clipPath: 'polygon(0 0, calc(100% - 18px) 0, 100% 50%, calc(100% - 18px) 100%, 0 100%, 18px 50%)' }}><b className="block text-2xl">{count}</b></button></div>; })}</div></section>)}</div>}
    {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm mb-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs font-semibold uppercase text-slate-500">Buscar por cliente ou {isCommercial ? 'atendimento' : 'beneficio'}<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Digite para buscar" className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm font-normal text-slate-700" /></label><label className="text-xs font-semibold uppercase text-slate-500">Etapa<select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm font-normal text-slate-700"><option value="">Todas as etapas</option>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label></div></div>
    <div className="flex flex-col sm:flex-row gap-3 mb-5">
      <div><button onClick={() => setShowTagFilter((value) => !value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Filtro{tagFilter.length ? ` (${tagFilter.length})` : ''}</button>{showTagFilter && <div className="fixed right-6 top-20 z-50 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"><select value={tagFilterMode} onChange={(event) => setTagFilterMode(event.target.value as 'all' | 'any' | 'none')} className="w-full border-b border-slate-100 bg-transparent pb-2 text-xs font-semibold text-slate-600"><option value="all">Todos esses</option><option value="any">Qualquer um desses</option><option value="none">Nenhum desses</option></select><div className="mt-2 max-h-40 space-y-1 overflow-y-auto">{tags.map((tag) => <label key={tag.id} className="flex cursor-pointer items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={tagFilter.includes(tag.id)} onChange={() => setTagFilter((selected) => selected.includes(tag.id) ? selected.filter((id) => selected.includes(tag.id) ? selected.filter((id) => id !== tag.id) : [...selected, tag.id]) : [...selected, tag.id])} /><span className="h-2 w-2 rounded-full" style={{ background: tag.color }} />{tag.name}</label>)}</div><button onClick={() => setTagFilter([])} className="mt-3 text-xs font-semibold text-blue-700">Limpar filtro</button></div>}</div>
      {!isCommercial && <button onClick={() => setShowArchivedProcesses((value) => !value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">{showArchivedProcesses ? 'Processos ativos' : `Arquivados (${processes.filter((process: any) => process.categoria === 'arquivado').length})`}</button>}
      {isCommercial && <button onClick={() => setShowArchived((value) => !value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">{showArchived ? 'Atendimentos ativos' : 'Arquivados'}</button>}
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Exibir<select value={pageLimit} onChange={(event) => { setPageLimit(Number(event.target.value)); setCurrentPage(1); }} className="bg-transparent text-sm outline-none"><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option><option value={500}>500</option></select></label>
      <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><RefreshCw size={16} />Atualizar</button>
    </div>

    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">{isCommercial ? 'Atendimento' : 'Benefício'}</th><th className="px-5 py-3">Etapa</th><th className="px-5 py-3">Responsável</th><th className="px-5 py-3">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">
        {filteredRecords.length === 0 ? <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">Nenhum registro localizado.</td></tr> : visibleRecords.map((record) => <tr key={record.id} onClick={() => editRecord(record)} className="cursor-pointer hover:bg-slate-50"><td className="px-5 py-4 font-semibold text-slate-800">{clientName(clients, record.cliente_id)}<Tags tags={isCommercial ? (record as Attendance).atendimento_tags : (record as Process).processo_tags} /></td><td className="px-5 py-4 text-slate-600">{isCommercial ? (record as Attendance).assunto : <><span>{(record as Process).tipo_beneficio || '-'}</span><span className="mt-1 block text-xs text-slate-500">{(record as Process).numero_cnj ? `CNJ: ${(record as Process).numero_cnj}` : (record as Process).numero_protocolo ? `Protocolo: ${(record as Process).numero_protocolo}` : ''}</span></>}</td><td className="px-5 py-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{stageById.get(record.stage_id || '') || 'Sem etapa'}</span>{!isCommercial && <StageAlert createdAt={record.created_at} limit={stageLimits.get(record.stage_id || '')} />}</td><td className="px-5 py-4 text-slate-600">{record.responsavel || '-'}</td><td className="px-5 py-4 whitespace-nowrap"><span className="inline-flex gap-2"><button onClick={(e) => { e.stopPropagation(); createTask(record); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Tarefa</button>{isCommercial && (record as Attendance).status_conversao !== 'convertido' && <button onClick={(e) => { e.stopPropagation(); convert(record as Attendance); }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Converter</button>}{!isCommercial && <ProcessLinks process={record as Process} client={clients.find((client) => String(client.id) === String(record.cliente_id))} />}</span></td></tr>)}
      </tbody></table></div>{filteredRecords.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-600"><span>Exibindo {((safePage - 1) * pageLimit) + 1}-{Math.min(safePage * pageLimit, filteredRecords.length)} de {filteredRecords.length.toLocaleString('pt-BR')}</span><span>Página {safePage} de {totalPages}</span><div className="flex gap-2"><button disabled={safePage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40">Anterior</button><button disabled={safePage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold disabled:opacity-40">Próxima</button></div></div>}
    </div>

    {showForm && <div onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }} className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4">
      <form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900">{editingId ? 'Editar' : 'Novo'} {isCommercial ? 'atendimento' : 'processo'}</h3>
        {editingId && <div className="mt-4 flex gap-4 border-b border-slate-200"><button type="button" onClick={() => setDetailTab('dados')} className={`border-b-2 px-1 pb-2 text-sm font-semibold ${detailTab === 'dados' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>Dados</button><button type="button" onClick={() => setDetailTab('tarefas')} className={`border-b-2 px-1 pb-2 text-sm font-semibold ${detailTab === 'tarefas' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>Tarefas ({linkedTasks.length})</button></div>}
        {detailTab === 'dados' && <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Cliente<select required value={form.clienteId || ''} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"><option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.nome || client.name}</option>)}</select></label>
          <div className="flex items-end"><button type="button" onClick={onNewClient} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700">Cadastrar cliente</button></div>
          <label className="text-sm font-medium text-slate-700">Etapa<select value={form.stageId || ''} onChange={(e) => setForm({ ...form, stageId: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5">{stages.filter((stage) => isCommercial || stage.categoria === (form.categoria || 'administrativo')).map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Responsável<select value={form.responsavel || ''} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"><option value="">Não definido</option>{users.map((item) => <option key={item.id || item.userid || item.username} value={item.name || item.username || ''}>{item.name || item.username}</option>)}</select></label>
          {isCommercial ? <><label className="sm:col-span-2 text-sm font-medium text-slate-700">Assunto<input required value={form.assunto || ''} onChange={(e) => setForm({ ...form, assunto: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label>{editingId && <label className="text-sm font-medium text-slate-700">Situação<select value={form.statusConversao || 'aberto'} onChange={(e) => setForm({ ...form, statusConversao: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"><option value="aberto">Aberto</option><option value="encerrado">Encerrar e arquivar</option></select></label>}</> : <><label className="text-sm font-medium text-slate-700">Tipo de benefício<input value={form.tipoBeneficio || ''} onChange={(e) => setForm({ ...form, tipoBeneficio: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Nº do protocolo<input value={form.numeroProtocolo || ''} onChange={(e) => setForm({ ...form, numeroProtocolo: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="sm:col-span-2 text-sm font-medium text-slate-700">URL da pasta no Nextcloud<input type="url" value={form.pastaNextcloudUrl || ''} onChange={(e) => setForm({ ...form, pastaNextcloudUrl: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label></>}
          {!isCommercial && <><label className="text-sm font-medium text-slate-700">Categoria<select value={form.categoria || 'administrativo'} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"><option value="administrativo">Administrativo</option><option value="judicial">Judicial</option></select></label><label className="text-sm font-medium text-slate-700">Nº requerimento<input value={form.numeroRequerimento || ''} onChange={(e) => setForm({ ...form, numeroRequerimento: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Nº benefício<input value={form.numeroBeneficio || ''} onChange={(e) => setForm({ ...form, numeroBeneficio: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Nº CNJ<input value={form.numeroCnj || ''} onChange={(e) => setForm({ ...form, numeroCnj: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Data do requerimento<input type="date" value={form.dataRequerimento || ''} onChange={(e) => setForm({ ...form, dataRequerimento: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Ano ajuizamento<input type="number" value={form.anoAjuizamento || ''} onChange={(e) => setForm({ ...form, anoAjuizamento: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Tribunal<input value={form.tribunal || ''} onChange={(e) => setForm({ ...form, tribunal: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Vara / comarca<input value={form.vara || ''} onChange={(e) => setForm({ ...form, vara: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Sistema eletrônico<input value={form.sistemaEletronico || ''} onChange={(e) => setForm({ ...form, sistemaEletronico: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Resultado<select value={form.resultadoProcesso || ''} onChange={(e) => setForm({ ...form, resultadoProcesso: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"><option value="">Em aberto</option><option value="ganho">Ganho</option><option value="perdido">Perdido</option></select></label></>}
          <div className="sm:col-span-2"><p className="text-sm font-medium text-slate-700">Tags deste {isCommercial ? 'atendimento' : 'processo'}</p><p className="mt-1 text-xs text-slate-500">Tags são configuradas no painel de Configurações.</p><div className="mt-2 flex flex-wrap gap-2">{tags.map((tag) => <label key={tag.id} className="cursor-pointer"><input type="checkbox" className="sr-only" checked={selectedTagIds.includes(tag.id)} onChange={() => setSelectedTagIds((ids) => ids.includes(tag.id) ? ids.filter((id) => id !== tag.id) : [...ids, tag.id])} /><span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${selectedTagIds.includes(tag.id) ? 'ring-2 ring-offset-1' : ''}`} style={{ backgroundColor: `${tag.color}22`, color: tag.color }}>{tag.name}</span></label>)}</div></div>
          <label className="sm:col-span-2 text-sm font-medium text-slate-700">Observações<textarea value={isCommercial ? form.descricao || '' : form.observacoes || ''} onChange={(e) => setForm({ ...form, [isCommercial ? 'descricao' : 'observacoes']: e.target.value })} className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 p-2.5" /></label>
        </div>}
        {editingId && detailTab === 'tarefas' && <div className="mt-5"><button type="button" onClick={() => createTask({ id: editingId, cliente_id: form.clienteId, ...(isCommercial ? { assunto: form.assunto, status_conversao: 'aberto' } : { tipo_beneficio: form.tipoBeneficio }) } as Attendance | Process)} className="mb-4 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white">+ Nova tarefa</button><TaskHistory tasks={linkedTasks} users={users} onRefresh={reloadLinkedTasks} /></div>}
        {detailTab === 'dados' && <div className="mt-6 flex justify-end gap-3">{isCommercial && editingId && <button type="button" onClick={archiveAttendance} className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700">Encerrar e arquivar</button>}<button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-semibold text-slate-600">Cancelar</button><button disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar'}</button></div>}
      </form>
    </div>}
  </>;
}

function ProcessLinks({ process, client }: { process: Process; client?: Client }) {
  const sagUrl = process.numero_protocolo ? `https://atendimento.inss.gov.br/tarefas/detalhar_tarefa/${encodeURIComponent(process.numero_protocolo)}` : '';
  const phone = String(client?.telefone || client?.phone || client?.telefone_secundario || '').replace(/\D/g, '');
  return <span className="inline-flex gap-2">{phone && <a href={`https://crm.datacrazy.io/multiservice?search=${phone}`} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} title="Abrir conversa do cliente" className="rounded-lg bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100"><MessageCircle size={15} /></a>}{process.pasta_nextcloud_url && <a href={process.pasta_nextcloud_url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} title="Abrir pasta no Nextcloud" className="rounded-lg bg-amber-50 p-2 text-amber-700 hover:bg-amber-100"><FolderOpen size={15} /></a>}{sagUrl && <a href={sagUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} title="Abrir processo no SAG" className="rounded-lg bg-blue-50 p-2 text-blue-700 hover:bg-blue-100"><ExternalLink size={15} /></a>}</span>;
}

function Tags({ tags }: { tags?: LinkedTag[] }) {
  const usableTags = tags?.map((item) => item.tags).filter((tag): tag is TagItem => Boolean(tag)) || [];
  if (!usableTags.length) return null;
  return <span className="mt-1 flex flex-wrap gap-1">{usableTags.map((tag) => <span key={tag.id} className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${tag.color}22`, color: tag.color }}>{tag.name}</span>)}</span>;
}

function StageAlert({ createdAt, limit }: { createdAt: string; limit?: number | null }) {
  if (!limit) return null; const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000); if (days < limit) return null;
  return <span className="mt-1 block w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">Parado há {days} dias</span>;
}

function formatTaskDate(value?: string | null) {
  if (!value) return 'Sem data';
  const isoDate = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[3]}/${isoDate[2]}/${isoDate[1]}`;
  return String(value).replace(/^(\d{2}\/\d{2}\/\d{4}).*$/, '$1');
}

function TaskHistory({ tasks, users, onRefresh }: { tasks: Array<{ id: string; titulo: string; descricao?: string | null; responsavel?: string | null; prazo?: string | null; hora?: string | null; local?: string | null; tipo?: string | null; classificacao?: string; status?: string; tarefa_pai_id?: string | null }>; users: Array<{ id?: string; userid?: string; name?: string; username?: string }>; onRefresh: () => void }) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const linkTask = async (childId: string, parentId: string | null) => { if (childId === parentId) return; try { await api.post(`/api/operacional/tarefas/${childId}/relacionar`, { tarefaPaiId: parentId }); onRefresh(); } catch { window.alert('Não foi possível relacionar a tarefa.'); } };
  const taskDate = (task: any) => {
    const value = String(task.prazo || task.advbox_criado_em || task.created_at || '');
    const isoTimestamp = Date.parse(value);
    if (!Number.isNaN(isoTimestamp)) return isoTimestamp;
    const brazilianDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    return brazilianDate ? new Date(Number(brazilianDate[3]), Number(brazilianDate[2]) - 1, Number(brazilianDate[1]), Number(brazilianDate[4] || 0), Number(brazilianDate[5] || 0)).getTime() : 0;
  };
  const parents = tasks.filter((task) => !task.tarefa_pai_id).sort((a, b) => taskDate(b) - taskDate(a));
  if (!parents.length) return <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">Ainda não há tarefas vinculadas.</p>;
  return <div className="space-y-4">{parents.map((task) => <TaskHistoryItem key={task.id} task={task} children={tasks.filter((child) => child.tarefa_pai_id === task.id).sort((a: any, b: any) => taskDate(b) - taskDate(a))} allTasks={tasks} users={users} draggedTaskId={draggedTaskId} onDragStart={setDraggedTaskId} onDropTask={linkTask} onRefresh={onRefresh} />)}</div>;
}

function TaskHistoryItem({ task, children, allTasks, users, draggedTaskId, onDragStart, onDropTask, onRefresh }: { task: any; children: any[]; allTasks: any[]; users: Array<{ id?: string; userid?: string; name?: string; username?: string }>; draggedTaskId: string | null; onDragStart: (id: string | null) => void; onDropTask: (child: string, parent: string | null) => void; onRefresh: () => void }) {
  const [comments, setComments] = useState<{ id: string; conteudo: string; autor_id?: string | null; autor_nome: string; created_at: string }[]>([]); const [comment, setComment] = useState(''); const [error, setError] = useState(''); const [expanded, setExpanded] = useState(false); const [editing, setEditing] = useState(false); const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ titulo: task.titulo || '', descricao: task.descricao || '', prazo: task.prazo || '', responsaveis: String(task.responsavel || '').split(',').map((item) => item.trim()).filter(Boolean) as string[] });
  const currentUser = (() => { try { return JSON.parse(localStorage.getItem('@PlataformaHB:user') || '{}'); } catch { return {}; } })(); const identities = [currentUser.name, currentUser.username, currentUser.email].filter(Boolean).map((value) => String(value).toLowerCase()); const isResponsible = Boolean(task.responsavel && identities.some((identity) => String(task.responsavel).toLowerCase().includes(identity)));
  const loadComments = () => api.get(`/api/operacional/tarefas/${task.id}/comentarios`).then((response) => setComments(response.data)).catch((requestError) => setError(requestError.response?.data?.error || 'Não foi possível carregar os comentários. Execute a migração 20260818_tarefas_historico.sql.'));
  useEffect(() => { loadComments(); }, [task.id]);
  const addComment = async () => { if (!comment.trim()) return; setError(''); try { await api.post(`/api/operacional/tarefas/${task.id}/comentarios`, { conteudo: comment }); setComment(''); loadComments(); } catch (requestError: any) { setError(requestError.response?.data?.error || 'Não foi possível salvar o comentário. Execute a migração 20260818_tarefas_historico.sql.'); } };
  const deleteComment = async (commentId: string) => { if (!window.confirm('Excluir este comentário?')) return; setError(''); try { await api.delete(`/api/operacional/tarefas/comentarios/${commentId}`); loadComments(); } catch (requestError: any) { setError(requestError.response?.data?.error || 'Não foi possível excluir o comentário.'); } };
  const save = async () => { setSaving(true); setError(''); try { await api.patch(`/api/operacional/tarefas/${task.id}`, { titulo: form.titulo, descricao: form.descricao, prazo: form.prazo, responsavel: form.responsaveis.join(', ') }); setEditing(false); onRefresh(); } catch (requestError: any) { setError(requestError.response?.data?.error || 'Não foi possível editar a tarefa.'); } finally { setSaving(false); } };
  const complete = async () => { setSaving(true); try { await api.post(`/api/operacional/tarefas/${task.id}/concluir`); onRefresh(); } catch (requestError: any) { setError(requestError.response?.data?.error || 'Não foi possível concluir a tarefa.'); } finally { setSaving(false); } };
  const toggleResponsible = (name: string) => setForm((current) => ({ ...current, responsaveis: current.responsaveis.includes(name) ? current.responsaveis.filter((item) => item !== name) : [...current.responsaveis, name] }));
  const ownerCount = String(task.responsavel || '').split(',').map((name) => name.trim()).filter(Boolean).length;
  if (ownerCount > 1) task.status = task.concluida_por_mim ? 'concluida' : 'pendente';
  const isEvent = task.tipo === 'evento' || /^evento\b/i.test(String(task.titulo || ''));
  const eventDetails = isEvent ? [task.hora && `Horário: ${task.hora}`, task.local && `Local: ${task.local}`].filter(Boolean).join('\n') : '';
  if (eventDetails && !String(task.descricao || '').includes(eventDetails)) task.descricao = `${eventDetails}${task.descricao ? `\n\n${task.descricao}` : ''}`;
  return <article draggable onDragStart={() => onDragStart(task.id)} onDragEnd={() => onDragStart(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (draggedTaskId) void onDropTask(draggedTaskId, task.id); }} className="border-l-2 border-blue-300 pl-4"><div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-semibold text-slate-800">{task.titulo}</h4><span className="text-xs font-semibold text-slate-500">{formatTaskDate(task.prazo)}</span></div>{editing ? <div className="mt-3 grid gap-3"><input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} className="rounded-lg border p-2 text-sm" /><textarea value={form.descricao} onChange={(event) => setForm({ ...form, descricao: event.target.value })} className="min-h-20 rounded-lg border p-2 text-sm" /><input type="date" value={form.prazo ? String(form.prazo).slice(0, 10) : ''} onChange={(event) => setForm({ ...form, prazo: event.target.value })} className="rounded-lg border p-2 text-sm" /><div className="flex flex-wrap gap-2">{users.map((user) => { const name = user.name || user.username || ''; return name && <button key={user.id || user.userid || name} type="button" onClick={() => toggleResponsible(name)} className={`rounded-full px-2 py-1 text-xs ${form.responsaveis.includes(name) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{name}</button>; })}</div><div className="flex gap-2"><button type="button" onClick={() => void save()} disabled={saving} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Salvar</button><button type="button" onClick={() => setEditing(false)} className="rounded-lg border px-3 py-2 text-xs">Cancelar</button></div></div> : <><div className="mt-2 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${task.status === 'concluida' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{task.status === 'concluida' ? 'Concluída' : 'Pendente'}</span>{task.responsavel && <span className="text-xs text-slate-600">Responsável: <b>{task.responsavel}</b></span>}<button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-blue-700">Editar</button>{isResponsible && task.status !== 'concluida' && <button type="button" onClick={() => void complete()} className="text-xs font-semibold text-emerald-700">Concluir</button>}</div>{task.descricao && <div className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{task.descricao}</div>}</>}<div className="mt-3 flex gap-2"><input value={comment} onChange={(event) => setComment(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void addComment(); } }} placeholder="Adicionar comentário" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" /><button type="button" onClick={() => void addComment()} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white">Registrar</button></div>{comments.map((item) => <div key={item.id} className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><div className="flex items-center justify-between gap-2"><span className="block text-xs font-semibold text-slate-500">{new Date(item.created_at).toLocaleDateString('pt-BR')} · {item.autor_nome}</span>{String(item.autor_id || '') === String(currentUser.id || '') && <button type="button" onClick={() => void deleteComment(item.id)} className="text-xs font-semibold text-red-600">Excluir</button>}</div>{item.conteudo}</div>)}{error && <p className="mt-2 text-xs text-red-600">{error}</p>}</div><div className="mt-3 flex flex-wrap gap-3"><button type="button" onClick={() => setExpanded((value) => !value)} className={`rounded p-1 text-blue-700 transition-transform ${expanded ? 'rotate-180' : ''}`} title={expanded ? 'Recolher tarefas relacionadas' : 'Expandir tarefas relacionadas'}><ChevronDown size={18} /></button><select defaultValue="" onChange={(event) => { if (event.target.value) void onDropTask(event.target.value, task.id); event.currentTarget.value = ''; }} className="rounded border px-2 py-1 text-xs"><option value="">Relacionar tarefa existente</option>{allTasks.filter((item) => item.id !== task.id && item.tarefa_pai_id !== task.id).map((item) => <option key={item.id} value={item.id}>{item.titulo}</option>)}</select></div>{expanded && children.map((child) => <div key={child.id} className="ml-6 mt-3"><TaskHistoryItem task={child} children={allTasks.filter((item) => item.tarefa_pai_id === child.id)} allTasks={allTasks} users={users} draggedTaskId={draggedTaskId} onDragStart={onDragStart} onDropTask={onDropTask} onRefresh={onRefresh} /></div>)}</article>;
}
