import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FolderOpen, Plus, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { TaskModal } from '../components/TaskModal';

type Client = { id: string | number; nome?: string; name?: string; cpf?: string };
type Stage = { id: string; name: string; stage_key: string; limite_dias?: number | null };
type LinkedTag = { tags?: { id: string; name: string; color: string } | null };
type Attendance = { id: string; cliente_id: string; stage_id?: string | null; assunto: string; responsavel?: string | null; status_conversao: string; created_at: string; atendimento_tags?: LinkedTag[] };
type Process = { id: string; cliente_id: string; stage_id?: string | null; tipo_beneficio?: string | null; responsavel?: string | null; numero_protocolo?: string | null; pasta_nextcloud_url?: string | null; resultado?: string | null; destino_resultado?: string | null; created_at: string; processo_tags?: LinkedTag[] };
type TagItem = { id: string; name: string; color: string };

interface OperationsProps { mode: 'comercial' | 'processos'; clients: Client[]; onNewClient: () => void; }

const clientName = (clients: Client[], id: string) => clients.find((client) => String(client.id) === String(id))?.nome || clients.find((client) => String(client.id) === String(id))?.name || 'Cliente não localizado';

export function Operations({ mode, clients, onNewClient }: OperationsProps) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<TagItem[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<'all' | 'any' | 'none'>('any');
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [users, setUsers] = useState<{ id?: string; userid?: string; name?: string; username?: string }[]>([]);
  const [taskContext, setTaskContext] = useState<{ clienteId: string; atendimentoId?: string; processoId?: string; title: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'dados' | 'tarefas'>('dados');
  const [linkedTasks, setLinkedTasks] = useState<{ id: string; titulo: string; prazo?: string | null; classificacao?: string; status?: string }[]>([]);

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

  const openForm = () => {
    setForm({ clienteId: '', stageId: stages[0]?.id || '', assunto: '', responsavel: '', tipoBeneficio: '', numeroProtocolo: '', numeroRequerimento: '', numeroBeneficio: '', numeroCnj: '', pastaNextcloudUrl: '', descricao: '', observacoes: '', categoria: 'administrativo', dataRequerimento: '', anoAjuizamento: '', segmentoJudiciario: '', comarca: '', vara: '', tribunal: '', sistemaEletronico: '', valorCausa: '', contingenciamento: '', dataCadastro: '', dataFechamento: '', dataTransitoJulgado: '', dataArquivamento: '', resultadoProcesso: '' });
    setSelectedTagIds([]);
    setEditingId(null);
    setShowForm(true);
  };

  const editRecord = (record: Attendance | Process) => {
    const recordTags = isCommercial ? (record as Attendance).atendimento_tags : (record as Process).processo_tags;
    setSelectedTagIds(recordTags?.map((item) => item.tags?.id).filter((id): id is string => Boolean(id)) || []);
    setForm({ clienteId: record.cliente_id, stageId: record.stage_id || '', assunto: isCommercial ? (record as Attendance).assunto : '', statusConversao: isCommercial ? (record as Attendance).status_conversao : '', responsavel: record.responsavel || '', tipoBeneficio: !isCommercial ? (record as Process).tipo_beneficio || '' : '', numeroProtocolo: !isCommercial ? (record as Process).numero_protocolo || '' : '', pastaNextcloudUrl: !isCommercial ? (record as Process).pasta_nextcloud_url || '' : '', descricao: '', observacoes: '', categoria: 'administrativo' });
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
      setError(requestError.response?.data?.error || 'Não foi possível salvar o registro.');
    } finally { setSaving(false); }
  };

  const convert = async (attendance: Attendance) => {
    const tipoBeneficio = window.prompt('Tipo de benefício (opcional):') ?? '';
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


  const records = isCommercial ? attendances : processes;
  const filteredRecords = records.filter((record) => {
    const term = search.toLowerCase();
    const recordTags = isCommercial ? (record as Attendance).atendimento_tags : (record as Process).processo_tags;
    const matchesText = !term || clientName(clients, record.cliente_id).toLowerCase().includes(term) || (isCommercial ? (record as Attendance).assunto : (record as Process).tipo_beneficio || '').toLowerCase().includes(term);
    const recordTagIds = recordTags?.map((item) => item.tags?.id).filter((id): id is string => Boolean(id)) || [];
    const matchesTags = !tagFilter.length || (tagFilterMode === 'all' ? tagFilter.every((id) => recordTagIds.includes(id)) : tagFilterMode === 'any' ? tagFilter.some((id) => recordTagIds.includes(id)) : tagFilter.every((id) => !recordTagIds.includes(id)));
    return matchesText && matchesTags;
  });

  if (taskContext) return <TaskModal context={taskContext} users={users} onClose={() => setTaskContext(null)} />;

  return <>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
      <div><h2 className="text-2xl font-bold text-slate-900">{title}</h2><p className="text-sm text-slate-500 mt-1">{isCommercial ? 'Registre atendimentos e converta contratos fechados em processos.' : 'Acompanhe cada processo pela etapa operacional atual.'}</p></div>
      <button onClick={openForm} className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-blue-600/20"><Plus size={18} />{isCommercial ? 'Novo atendimento' : 'Novo processo'}</button>
    </div>

    {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <div className="flex flex-col sm:flex-row gap-3 mb-5">
      <div className="relative"><button onClick={() => setShowTagFilter((value) => !value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">Filtro{tagFilter.length ? ` (${tagFilter.length})` : ''}</button>{showTagFilter && <div className="absolute right-0 top-11 z-20 min-w-56 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"><select value={tagFilterMode} onChange={(event) => setTagFilterMode(event.target.value as 'all' | 'any' | 'none')} className="w-full border-b border-slate-100 bg-transparent pb-2 text-xs font-semibold text-slate-600"><option value="all">Todos esses</option><option value="any">Qualquer um desses</option><option value="none">Nenhum desses</option></select><div className="mt-2 max-h-40 space-y-1 overflow-y-auto">{tags.map((tag) => <label key={tag.id} className="flex cursor-pointer items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={tagFilter.includes(tag.id)} onChange={() => setTagFilter((selected) => selected.includes(tag.id) ? selected.filter((id) => id !== tag.id) : [...selected, tag.id])} /><span className="h-2 w-2 rounded-full" style={{ background: tag.color }} />{tag.name}</label>)}</div><button onClick={() => setTagFilter([])} className="mt-3 text-xs font-semibold text-blue-700">Limpar filtro</button></div>}</div>
      {isCommercial && <button onClick={() => setShowArchived((value) => !value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">{showArchived ? 'Atendimentos ativos' : 'Arquivados'}</button>}
      <button onClick={load} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"><RefreshCw size={16} />Atualizar</button>
    </div>

    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">{isCommercial ? 'Atendimento' : 'Benefício'}</th><th className="px-5 py-3">Etapa</th><th className="px-5 py-3">Responsável</th><th className="px-5 py-3">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">
        {filteredRecords.length === 0 ? <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">Nenhum registro localizado.</td></tr> : filteredRecords.map((record) => <tr key={record.id} onClick={() => editRecord(record)} className="cursor-pointer hover:bg-slate-50"><td className="px-5 py-4 font-semibold text-slate-800">{clientName(clients, record.cliente_id)}<Tags tags={isCommercial ? (record as Attendance).atendimento_tags : (record as Process).processo_tags} /></td><td className="px-5 py-4 text-slate-600">{isCommercial ? (record as Attendance).assunto : (record as Process).tipo_beneficio || '-'}</td><td className="px-5 py-4"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{stageById.get(record.stage_id || '') || 'Sem etapa'}</span>{!isCommercial && <StageAlert createdAt={record.created_at} limit={stageLimits.get(record.stage_id || '')} />}</td><td className="px-5 py-4 text-slate-600">{record.responsavel || '-'}</td><td className="px-5 py-4 whitespace-nowrap"><span className="inline-flex gap-2"><button onClick={(e) => { e.stopPropagation(); createTask(record); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">Tarefa</button>{isCommercial && (record as Attendance).status_conversao !== 'convertido' && <button onClick={(e) => { e.stopPropagation(); convert(record as Attendance); }} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Converter</button>}{!isCommercial && <ProcessLinks process={record as Process} />}</span></td></tr>)}
      </tbody></table></div>
    </div>

    {showForm && <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4">
      <form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-slate-900">{editingId ? 'Editar' : 'Novo'} {isCommercial ? 'atendimento' : 'processo'}</h3>
        {editingId && <div className="mt-4 flex gap-4 border-b border-slate-200"><button type="button" onClick={() => setDetailTab('dados')} className={`border-b-2 px-1 pb-2 text-sm font-semibold ${detailTab === 'dados' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>Dados</button><button type="button" onClick={() => setDetailTab('tarefas')} className={`border-b-2 px-1 pb-2 text-sm font-semibold ${detailTab === 'tarefas' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}>Tarefas ({linkedTasks.length})</button></div>}
        {detailTab === 'dados' && <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Cliente<select required value={form.clienteId || ''} onChange={(e) => setForm({ ...form, clienteId: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"><option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.nome || client.name}</option>)}</select></label>
          <div className="flex items-end"><button type="button" onClick={onNewClient} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-semibold text-blue-700">Cadastrar cliente</button></div>
          <label className="text-sm font-medium text-slate-700">Etapa<select value={form.stageId || ''} onChange={(e) => setForm({ ...form, stageId: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5">{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></label>
          <label className="text-sm font-medium text-slate-700">Responsável<select value={form.responsavel || ''} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"><option value="">Não definido</option>{users.map((item) => <option key={item.id || item.userid || item.username} value={item.name || item.username || ''}>{item.name || item.username}</option>)}</select></label>
          {isCommercial ? <><label className="sm:col-span-2 text-sm font-medium text-slate-700">Assunto<input required value={form.assunto || ''} onChange={(e) => setForm({ ...form, assunto: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label>{editingId && <label className="text-sm font-medium text-slate-700">Situação<select value={form.statusConversao || 'aberto'} onChange={(e) => setForm({ ...form, statusConversao: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"><option value="aberto">Aberto</option><option value="encerrado">Encerrar e arquivar</option></select></label>}</> : <><label className="text-sm font-medium text-slate-700">Tipo de benefício<input value={form.tipoBeneficio || ''} onChange={(e) => setForm({ ...form, tipoBeneficio: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Nº do protocolo<input value={form.numeroProtocolo || ''} onChange={(e) => setForm({ ...form, numeroProtocolo: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="sm:col-span-2 text-sm font-medium text-slate-700">URL da pasta no Nextcloud<input type="url" value={form.pastaNextcloudUrl || ''} onChange={(e) => setForm({ ...form, pastaNextcloudUrl: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label></>}
          {!isCommercial && <><label className="text-sm font-medium text-slate-700">Categoria<select value={form.categoria || 'administrativo'} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"><option value="administrativo">Administrativo</option><option value="judicial">Judicial</option></select></label><label className="text-sm font-medium text-slate-700">Nº requerimento<input value={form.numeroRequerimento || ''} onChange={(e) => setForm({ ...form, numeroRequerimento: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Nº benefício<input value={form.numeroBeneficio || ''} onChange={(e) => setForm({ ...form, numeroBeneficio: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Nº CNJ<input value={form.numeroCnj || ''} onChange={(e) => setForm({ ...form, numeroCnj: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Data do requerimento<input type="date" value={form.dataRequerimento || ''} onChange={(e) => setForm({ ...form, dataRequerimento: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Ano ajuizamento<input type="number" value={form.anoAjuizamento || ''} onChange={(e) => setForm({ ...form, anoAjuizamento: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Tribunal<input value={form.tribunal || ''} onChange={(e) => setForm({ ...form, tribunal: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Vara / comarca<input value={form.vara || ''} onChange={(e) => setForm({ ...form, vara: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Sistema eletrônico<input value={form.sistemaEletronico || ''} onChange={(e) => setForm({ ...form, sistemaEletronico: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5" /></label><label className="text-sm font-medium text-slate-700">Resultado<select value={form.resultadoProcesso || ''} onChange={(e) => setForm({ ...form, resultadoProcesso: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 p-2.5"><option value="">Em aberto</option><option value="ganho">Ganho</option><option value="perdido">Perdido</option></select></label></>}
          <div className="sm:col-span-2"><p className="text-sm font-medium text-slate-700">Tags deste {isCommercial ? 'atendimento' : 'processo'}</p><p className="mt-1 text-xs text-slate-500">Tags são configuradas no painel de Configurações.</p><div className="mt-2 flex flex-wrap gap-2">{tags.map((tag) => <label key={tag.id} className="cursor-pointer"><input type="checkbox" className="sr-only" checked={selectedTagIds.includes(tag.id)} onChange={() => setSelectedTagIds((ids) => ids.includes(tag.id) ? ids.filter((id) => id !== tag.id) : [...ids, tag.id])} /><span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${selectedTagIds.includes(tag.id) ? 'ring-2 ring-offset-1' : ''}`} style={{ backgroundColor: `${tag.color}22`, color: tag.color }}>{tag.name}</span></label>)}</div></div>
          <label className="sm:col-span-2 text-sm font-medium text-slate-700">Observações<textarea value={isCommercial ? form.descricao || '' : form.observacoes || ''} onChange={(e) => setForm({ ...form, [isCommercial ? 'descricao' : 'observacoes']: e.target.value })} className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 p-2.5" /></label>
        </div>}
        {editingId && detailTab === 'tarefas' && <div className="mt-5"><button type="button" onClick={() => createTask({ id: editingId, cliente_id: form.clienteId, ...(isCommercial ? { assunto: form.assunto, status_conversao: 'aberto' } : { tipo_beneficio: form.tipoBeneficio }) } as Attendance | Process)} className="mb-4 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white">+ Nova tarefa</button><TaskHistory tasks={linkedTasks} /></div>}
        {detailTab === 'dados' && <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm font-semibold text-slate-600">Cancelar</button><button disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar'}</button></div>}
      </form>
    </div>}
  </>;
}

function ProcessLinks({ process }: { process: Process }) {
  const sagUrl = process.numero_protocolo ? `https://atendimento.inss.gov.br/tarefas/detalhar_tarefa/${encodeURIComponent(process.numero_protocolo)}` : '';
  return <span className="inline-flex gap-2">{process.pasta_nextcloud_url && <a href={process.pasta_nextcloud_url} target="_blank" rel="noreferrer" title="Abrir pasta no Nextcloud" className="rounded-lg bg-amber-50 p-2 text-amber-700 hover:bg-amber-100"><FolderOpen size={15} /></a>}{sagUrl && <a href={sagUrl} target="_blank" rel="noreferrer" title="Abrir processo no SAG" className="rounded-lg bg-blue-50 p-2 text-blue-700 hover:bg-blue-100"><ExternalLink size={15} /></a>}</span>;
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

function TaskHistory({ tasks }: { tasks: Array<{ id: string; titulo: string; prazo?: string | null; classificacao?: string; status?: string; tarefa_pai_id?: string | null }> }) {
  const parents = tasks.filter((task) => !task.tarefa_pai_id).sort((a, b) => b.id.localeCompare(a.id));
  if (!parents.length) return <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">Ainda não há tarefas vinculadas.</p>;
  return <div className="space-y-4">{parents.map((task) => <TaskHistoryItem key={task.id} task={task} children={tasks.filter((child) => child.tarefa_pai_id === task.id)} />)}</div>;
}

function TaskHistoryItem({ task, children }: { task: { id: string; titulo: string; prazo?: string | null; classificacao?: string; status?: string }; children: Array<{ id: string; titulo: string; prazo?: string | null; classificacao?: string }> }) {
  const [comments, setComments] = useState<{ id: string; conteudo: string; autor_nome: string; created_at: string }[]>([]); const [comment, setComment] = useState(''); const [commentError, setCommentError] = useState('');
  const loadComments = () => api.get(`/api/operacional/tarefas/${task.id}/comentarios`).then((response) => setComments(response.data)).catch(() => setComments([]));
  useEffect(() => { loadComments(); }, [task.id]);
  const addComment = async (event: React.FormEvent) => { event.preventDefault(); if (!comment.trim()) return; setCommentError(''); try { await api.post(`/api/operacional/tarefas/${task.id}/comentarios`, { conteudo: comment }); setComment(''); loadComments(); } catch (error: any) { setCommentError(error.response?.data?.error || 'Não foi possível salvar o comentário. Confirme a migração de histórico e reinicie o backend.'); } };
  return <article className="border-l-2 border-blue-300 pl-4"><div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-3"><h4 className="font-semibold text-slate-800">{task.titulo}</h4><span className="text-xs font-semibold text-slate-500">{task.prazo || 'Sem data'} · {task.classificacao || 'normal'}</span></div>{comments.map((item) => <div key={item.id} className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><span className="block text-xs font-semibold text-slate-500">{new Date(item.created_at).toLocaleDateString('pt-BR')} · {item.autor_nome}</span>{item.conteudo}</div>)}<form onSubmit={addComment} className="mt-3 flex gap-2"><input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Adicionar comentário ao histórico" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" /><button className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white">Registrar</button></form>{commentError && <p className="mt-2 text-xs text-red-600">{commentError}</p>}</div>{children.map((child) => <div key={child.id} className="ml-6 mt-3 rounded-xl border border-slate-200 bg-blue-50 p-3 text-sm"><span className="font-semibold text-blue-900">↳ {child.titulo}</span><span className="ml-2 text-xs text-slate-500">{child.prazo || 'Sem data'}</span></div>)}</article>;
}
