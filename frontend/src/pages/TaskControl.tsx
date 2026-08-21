import { useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, CheckCircle2, ChevronLeft, ChevronRight, Columns3, ExternalLink, FileText, Filter, FolderOpen, LayoutList, MessageCircle, RefreshCw, Search, UserRound, X } from 'lucide-react';
import { api } from '../services/api';

type Task = { id: string; titulo?: string | null; descricao?: string | null; responsavel?: string | null; prazo?: string | null; status?: string | null; classificacao?: string | null; processo_id?: string | null; cliente_id?: string | null; created_at?: string | null; concluida_por_mim?: boolean };
type Process = { id: string; cliente_id?: string | null; numero_protocolo?: string | null; numero_cnj?: string | null; pasta_nextcloud_url?: string | null; tipo_beneficio?: string | null };
type Client = { id: string; nome?: string | null; name?: string | null; cpf?: string | null; telefone?: string | null; phone?: string | null; telefone_secundario?: string | null; advbox_id?: string | number | null };

interface Props { clients: Client[]; currentUser: any; onOpenClient: (client: Client) => void; onOpenProcess: (processId: string) => void; }

const todayStart = () => { const date = new Date(); date.setHours(0, 0, 0, 0); return date.getTime(); };
const dateValue = (value?: string | null) => {
  if (!value) return 0;
  const brazilian = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brazilian) return new Date(Number(brazilian[3]), Number(brazilian[2]) - 1, Number(brazilian[1])).getTime();
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
};
const formatDate = (value?: string | null) => {
  const timestamp = dateValue(value);
  return timestamp ? new Intl.DateTimeFormat('pt-BR').format(new Date(timestamp)) : 'Sem prazo';
};
const taskTitle = (task: Task) => task.titulo || 'Tarefa sem título';
const isDone = (task: Task) => Boolean(task.concluida_por_mim) || (String(task.responsavel || '').split(',').filter(Boolean).length <= 1 && ['concluida', 'concluído', 'concluída', 'concluido'].includes(String(task.status || '').toLowerCase()));
const normalizedName = (value: unknown) => String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const sameResponsible = (first: string, second: string) => first === second || (first.length > 5 && second.length > 5 && (first.startsWith(second) || second.startsWith(first)));

export function TaskControl({ clients, currentUser, onOpenClient, onOpenProcess }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [responsible, setResponsible] = useState('');
  const [status, setStatus] = useState<'pending' | 'done'>('pending');
  const [priority, setPriority] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [showFuture, setShowFuture] = useState(true);
  const [onlyMine, setOnlyMine] = useState(true);
  const [sortKey, setSortKey] = useState<'task' | 'client' | 'deadline' | 'responsible'>('deadline');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [taskResponse, processResponse] = await Promise.all([api.get('/api/operacional/tarefas'), api.get('/api/operacional/processos')]);
      setTasks(Array.isArray(taskResponse.data) ? taskResponse.data : []);
      setProcesses(Array.isArray(processResponse.data) ? processResponse.data : []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [search, responsible, status, priority, start, end, showFuture, onlyMine, pageSize, sortKey, sortDirection]);

  const clientsById = useMemo(() => new Map(clients.map((client) => [String(client.id), client])), [clients]);
  const processesById = useMemo(() => new Map(processes.map((process) => [String(process.id), process])), [processes]);
  const responsibleOptions = useMemo(() => [...new Set(tasks.flatMap((task) => String(task.responsavel || '').split(',').map((name) => name.trim()).filter(Boolean)))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [tasks]);
  const currentNames = useMemo(() => [currentUser?.name, currentUser?.username, currentUser?.email].filter(Boolean).map(normalizedName), [currentUser]);
  const hasOwnAssignments = useMemo(() => tasks.some((task) => String(task.responsavel || '').split(',').map(normalizedName).some((owner) => currentNames.some((currentName) => sameResponsible(owner, currentName)))), [tasks, currentNames]);
  const filtered = useMemo(() => tasks.filter((task) => {
    const process = task.processo_id ? processesById.get(String(task.processo_id)) : undefined;
    const client = task.cliente_id ? clientsById.get(String(task.cliente_id)) : process?.cliente_id ? clientsById.get(String(process.cliente_id)) : undefined;
    const text = `${taskTitle(task)} ${task.descricao || ''} ${client?.nome || client?.name || ''}`.toLowerCase();
    const deadline = dateValue(task.prazo);
    const taskOwners = String(task.responsavel || '').split(',').map(normalizedName).filter(Boolean);
    if (onlyMine && hasOwnAssignments && !taskOwners.some((owner) => currentNames.some((currentName) => sameResponsible(owner, currentName)))) return false;
    if (search && !text.includes(search.toLowerCase())) return false;
    if (responsible && !taskOwners.some((owner) => normalizedName(responsible) === owner)) return false;
    if (status === 'pending' && isDone(task)) return false;
    if (status === 'done' && !isDone(task)) return false;
    if (priority && String(task.classificacao || '').toLowerCase() !== priority) return false;
    if (start && deadline && deadline < dateValue(start)) return false;
    if (end && deadline && deadline > dateValue(end)) return false;
    if (!showFuture && deadline > todayStart() + 24 * 60 * 60 * 1000) return false;
    return true;
  }).sort((a, b) => {
    const clientName = (task: Task) => { const process = task.processo_id ? processesById.get(String(task.processo_id)) : undefined; const client = task.cliente_id ? clientsById.get(String(task.cliente_id)) : process?.cliente_id ? clientsById.get(String(process.cliente_id)) : undefined; return String(client?.nome || client?.name || ''); };
    const values: Record<typeof sortKey, [string | number, string | number]> = {
      task: [normalizedName(taskTitle(a)), normalizedName(taskTitle(b))], client: [normalizedName(clientName(a)), normalizedName(clientName(b))], responsible: [normalizedName(a.responsavel), normalizedName(b.responsavel)], deadline: [dateValue(a.prazo || a.created_at) || Number.MAX_SAFE_INTEGER, dateValue(b.prazo || b.created_at) || Number.MAX_SAFE_INTEGER],
    };
    const [first, second] = values[sortKey]; const comparison = typeof first === 'number' && typeof second === 'number' ? first - second : String(first).localeCompare(String(second), 'pt-BR');
    return sortDirection === 'asc' ? comparison : -comparison;
  }), [tasks, processesById, clientsById, search, responsible, status, priority, start, end, showFuture, onlyMine, currentNames, hasOwnAssignments, sortKey, sortDirection]);

  const toggleSort = (key: typeof sortKey) => { if (sortKey !== key) { setSortKey(key); setSortDirection('asc'); return; } setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc'); };
  useEffect(() => {
    const labels: Record<string, typeof sortKey> = { Tarefa: 'task', Cliente: 'client', Prazo: 'deadline', 'Responsável': 'responsible' };
    const handler = (event: MouseEvent) => { const header = (event.target as HTMLElement).closest('th'); const key = header ? labels[header.textContent?.replace(/[▲▼]/g, '').trim() || ''] : undefined; if (key) toggleSort(key); };
    const headers = Array.from(document.querySelectorAll('th')); headers.forEach((header) => { const key = labels[header.textContent?.replace(/[▲▼]/g, '').trim() || '']; if (!key) return; header.setAttribute('title', 'Clique para ordenar'); (header as HTMLElement).style.cursor = 'pointer'; const marker = key === sortKey ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ''; const label = Object.entries(labels).find(([, value]) => value === key)?.[0] || ''; header.textContent = `${label}${marker}`; });
    document.addEventListener('click', handler); return () => document.removeEventListener('click', handler);
  }, [sortKey, sortDirection]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const displayed = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    const listeners = rows.map((row, index) => {
      const handler = (event: Event) => { if ((event.target as HTMLElement).closest('button, input, select')) return; const task = displayed[index]; if (task) setSelectedTask(task); };
      row.addEventListener('click', handler); (row as HTMLElement).style.cursor = displayed[index] ? 'pointer' : 'default'; row.setAttribute('title', 'Abrir visualização da tarefa'); return () => row.removeEventListener('click', handler);
    });
    return () => listeners.forEach((remove) => remove());
  }, [displayed, onOpenProcess]);
  const pending = filtered.filter((task) => !isDone(task)).length;
  const done = filtered.filter(isDone).length;
  const late = filtered.filter((task) => !isDone(task) && dateValue(task.prazo) && dateValue(task.prazo) < todayStart()).length;
  const clearFilters = () => { setOnlyMine(true); setResponsible(''); setStatus('pending'); setPriority(''); setStart(''); setEnd(''); setShowFuture(true); };

  const links = (task: Task) => {
    const process = task.processo_id ? processesById.get(String(task.processo_id)) : undefined;
    const client = task.cliente_id ? clientsById.get(String(task.cliente_id)) : process?.cliente_id ? clientsById.get(String(process.cliente_id)) : undefined;
    const clientPhone = client?.telefone || client?.phone || client?.telefone_secundario || null;
    return { process, client, clientPhone };
  };
  const open = (url?: string) => { if (url) window.open(url, '_blank', 'noopener,noreferrer'); };
  const complete = async (task: Task) => {
    await api.post(`/api/operacional/tarefas/${task.id}/concluir`);
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, concluida_por_mim: true } : item));
    setSelectedTask((current) => current?.id === task.id ? { ...current, concluida_por_mim: true } : current);
  };

  const Actions = ({ task }: { task: Task }) => {
    const { process, client, clientPhone } = links(task);
    return <div className="flex items-center gap-1 shrink-0">
      {!isDone(task) && <button type="button" title="Concluir minha tarefa" onClick={(event) => { event.stopPropagation(); void complete(task); }} className="p-2 rounded-md text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"><CheckCircle2 size={16} /></button>}
      <button type="button" title="Abrir processo" disabled={!process} onClick={(event) => { event.stopPropagation(); if (process) onOpenProcess(process.id); }} className="p-2 rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-30"><BriefcaseBusiness size={16} /></button>
      <button type="button" title="Abrir cliente" disabled={!client} onClick={(event) => { event.stopPropagation(); if (client) onOpenClient(client); }} className="p-2 rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-30"><UserRound size={16} /></button>
      <button type="button" title="Abrir no SAG" disabled={!process?.numero_protocolo} onClick={(event) => { event.stopPropagation(); open(process?.numero_protocolo ? `https://atendimento.inss.gov.br/tarefas/detalhar_tarefa/${encodeURIComponent(process.numero_protocolo)}` : undefined); }} className="p-2 rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-30"><ExternalLink size={16} /></button>
      <button type="button" title="Abrir pasta" disabled={!process?.pasta_nextcloud_url} onClick={(event) => { event.stopPropagation(); open(process?.pasta_nextcloud_url || undefined); }} className="p-2 rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-30"><FolderOpen size={16} /></button>
      <button type="button" title="Abrir conversa no DataCrazy" disabled={!clientPhone} onClick={(event) => { event.stopPropagation(); const phone = String(clientPhone || '').replace(/\D/g, ''); open(phone ? `https://crm.datacrazy.io/multiservice?search=${phone}` : undefined); }} className="p-2 rounded-md text-slate-500 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-30"><MessageCircle size={16} /></button>
    </div>;
  };

  const TaskCard = ({ task }: { task: Task }) => {
    const { client, process } = links(task);
    return <article onClick={() => setSelectedTask(task)} title="Abrir visualização da tarefa" className="cursor-pointer border border-slate-200 bg-white rounded-lg p-3 shadow-sm hover:border-blue-300">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="font-semibold text-slate-800 text-sm truncate">{taskTitle(task)}</p><p className="text-xs text-slate-500 mt-1 truncate">{client?.nome || client?.name || 'Cliente não vinculado'}</p></div><span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isDone(task) ? 'bg-emerald-500' : dateValue(task.prazo) && dateValue(task.prazo) < todayStart() ? 'bg-red-500' : 'bg-blue-500'}`} /></div>
      <p className="text-xs text-slate-500 mt-3">{formatDate(task.prazo)}{process?.numero_protocolo ? ` · ${process.numero_protocolo}` : ''}</p>
      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between"><span className="text-xs text-slate-500 truncate">{task.responsavel || 'Sem responsável'}</span><Actions task={task} /></div>
    </article>;
  };

  const buckets = useMemo(() => {
    const now = todayStart(); const tomorrow = now + 24 * 60 * 60 * 1000; const week = now + 7 * 24 * 60 * 60 * 1000;
    return [
      { title: 'Atrasadas', tone: 'text-red-700', tasks: filtered.filter((task) => !isDone(task) && dateValue(task.prazo) && dateValue(task.prazo) < now) },
      { title: 'Hoje', tone: 'text-amber-700', tasks: filtered.filter((task) => !isDone(task) && dateValue(task.prazo) >= now && dateValue(task.prazo) < tomorrow) },
      { title: 'Próximos dias', tone: 'text-blue-700', tasks: filtered.filter((task) => !isDone(task) && dateValue(task.prazo) >= tomorrow && dateValue(task.prazo) <= week) },
      { title: 'Fazendo', tone: 'text-indigo-700', tasks: filtered.filter((task) => !isDone(task) && (!dateValue(task.prazo) || dateValue(task.prazo) > week)) },
      { title: 'Concluídas', tone: 'text-emerald-700', tasks: filtered.filter(isDone) },
    ];
  }, [filtered]);

  return <><>{selectedTask && (() => { const { client, process } = links(selectedTask); return <div onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedTask(null); }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><section className="w-full max-w-xl rounded-lg bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase text-blue-600">Tarefa</p><h3 className="mt-1 text-xl font-bold text-slate-900">{taskTitle(selectedTask)}</h3></div><button onClick={() => setSelectedTask(null)} className="p-2 text-slate-500" title="Fechar"><X size={18}/></button></div><p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{selectedTask.descricao || 'Sem comentário ou descrição.'}</p><dl className="mt-5 grid grid-cols-2 gap-4 border-t pt-4 text-sm"><div><dt className="text-slate-500">Cliente</dt><dd className="font-semibold text-slate-800">{client?.nome || client?.name || 'Não vinculado'}</dd></div><div><dt className="text-slate-500">Responsável</dt><dd className="font-semibold text-slate-800">{selectedTask.responsavel || 'Sem responsável'}</dd></div><div><dt className="text-slate-500">Prazo</dt><dd className="font-semibold text-slate-800">{formatDate(selectedTask.prazo)}</dd></div><div><dt className="text-slate-500">Processo</dt><dd className="font-semibold text-slate-800">{process?.numero_protocolo || process?.numero_cnj || 'Não vinculado'}</dd></div></dl><div className="mt-6 flex justify-between border-t pt-4"><div><Actions task={selectedTask}/></div><button onClick={() => setSelectedTask(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Fechar</button></div></section></div>; })()}</><section className="max-w-[1800px] mx-auto">
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6"><div><h2 className="text-2xl font-bold text-slate-900">Controle de tarefas</h2><p className="text-sm text-slate-500 mt-1">Acompanhe pendências, responsáveis e acessos de cada processo.</p></div><div className="flex items-center gap-2"><button onClick={load} className="p-2.5 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50" title="Atualizar tarefas"><RefreshCw size={17} /></button><button onClick={() => setFilterOpen(true)} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50"><Filter size={16} />Filtro</button></div></div>
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 mb-6"><button onClick={() => setView('list')} className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 ${view === 'list' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}><LayoutList size={16} />Lista</button><button onClick={() => setView('board')} className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 ${view === 'board' ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500'}`}><Columns3 size={16} />Quadro</button><span className="mx-2 h-5 border-l border-slate-200" /><button onClick={() => setOnlyMine(true)} className={`px-3 py-2 text-sm font-semibold ${onlyMine ? 'text-blue-700' : 'text-slate-500'}`}>Minhas tarefas</button><button onClick={() => setOnlyMine(false)} className={`px-3 py-2 text-sm font-semibold ${!onlyMine ? 'text-blue-700' : 'text-slate-500'}`}>Todas as tarefas</button><span className="mx-2 h-5 border-l border-slate-200" /><button onClick={() => setStatus('pending')} className={`px-3 py-2 text-sm font-semibold ${status === 'pending' ? 'text-blue-700' : 'text-slate-500'}`}>Pendentes</button><button onClick={() => setStatus('done')} className={`px-3 py-2 text-sm font-semibold ${status === 'done' ? 'text-emerald-700' : 'text-slate-500'}`}>Concluídas</button></div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"><div className="border border-slate-200 bg-white rounded-lg p-4"><p className="text-xs font-semibold uppercase text-slate-500">Tarefas pendentes</p><p className="text-2xl font-bold text-slate-900 mt-1">{pending}</p></div><div className="border border-red-200 bg-red-50 rounded-lg p-4"><p className="text-xs font-semibold uppercase text-red-700">Atrasadas</p><p className="text-2xl font-bold text-red-700 mt-1">{late}</p></div><div className="border border-emerald-200 bg-emerald-50 rounded-lg p-4"><p className="text-xs font-semibold uppercase text-emerald-700">Concluídas</p><p className="text-2xl font-bold text-emerald-700 mt-1">{done}</p></div></div>
    <div className="flex flex-col sm:flex-row gap-3 justify-between mb-4"><div className="relative w-full sm:max-w-md"><Search size={16} className="absolute left-3 top-2.5 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarefa, cliente ou comentário" className="w-full border border-slate-300 rounded-lg py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-600" /></div><span className="text-sm text-slate-500 self-center">{filtered.length} tarefa{filtered.length === 1 ? '' : 's'}</span></div>
    {loading ? <div className="py-16 text-center text-slate-500">Carregando tarefas...</div> : view === 'board' ? <div className="flex gap-4 overflow-x-auto pb-4">{buckets.map((bucket) => <div key={bucket.title} className="w-72 shrink-0 bg-slate-100 border border-slate-200 rounded-lg p-3"><div className="flex justify-between items-center mb-3"><h3 className={`font-bold text-sm ${bucket.tone}`}>{bucket.title}</h3><span className="text-xs rounded-full bg-white border border-slate-200 px-2 py-0.5">{bucket.tasks.length}</span></div><div className="space-y-3">{bucket.tasks.map((task) => <TaskCard key={task.id} task={task} />)}{!bucket.tasks.length && <p className="py-8 text-center text-xs text-slate-400">Nenhuma tarefa</p>}</div></div>)}</div> : <div className="border border-slate-200 bg-white rounded-lg overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-3">Tarefa</th><th className="px-5 py-3">Cliente</th><th className="px-5 py-3">Prazo</th><th className="px-5 py-3">Responsável</th><th className="px-5 py-3 text-right">Acessos</th></tr></thead><tbody className="divide-y divide-slate-100">{displayed.map((task) => { const { client } = links(task); return <tr key={task.id} className="hover:bg-slate-50"><td className="px-5 py-4"><div className="flex items-center gap-2"><FileText size={16} className={isDone(task) ? 'text-emerald-600' : 'text-blue-600'} /><div><p className="font-semibold text-sm text-slate-800">{taskTitle(task)}</p>{task.descricao && <p className="text-xs text-slate-500 truncate max-w-md">{task.descricao}</p>}</div></div></td><td className="px-5 py-4 text-sm text-slate-700">{client?.nome || client?.name || 'Não vinculado'}</td><td className={`px-5 py-4 text-sm ${!isDone(task) && dateValue(task.prazo) && dateValue(task.prazo) < todayStart() ? 'text-red-600 font-semibold' : 'text-slate-600'}`}>{formatDate(task.prazo)}</td><td className="px-5 py-4 text-sm text-slate-600">{task.responsavel || 'Sem responsável'}</td><td className="px-5 py-4"><div className="flex justify-end"><Actions task={task} /></div></td></tr>; })}{!displayed.length && <tr><td colSpan={5} className="py-16 text-center text-slate-400">Nenhuma tarefa encontrada.</td></tr>}</tbody></table><div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-600"><span>Mostrando {filtered.length ? (page - 1) * pageSize + 1 : 0}-{Math.min(page * pageSize, filtered.length)} de {filtered.length}</span><div className="flex items-center gap-2"><select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="border border-slate-300 rounded-md p-1.5 text-xs"><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="p-1.5 rounded border disabled:opacity-40" title="Página anterior"><ChevronLeft size={16}/></button><span>Página {Math.min(page, totalPages)} de {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="p-1.5 rounded border disabled:opacity-40" title="Próxima página"><ChevronRight size={16}/></button></div></div></div>}
    {filterOpen && <div onMouseDown={(event) => { if (event.target === event.currentTarget) setFilterOpen(false); }} className="fixed inset-0 z-50 bg-slate-950/30 flex justify-end"><aside className="w-full max-w-md h-full bg-white shadow-2xl p-6 overflow-y-auto"><div className="flex items-center justify-between border-b border-slate-200 pb-4"><h3 className="font-bold text-slate-900">Filtrar tarefas</h3><button onClick={() => setFilterOpen(false)} title="Fechar filtros" className="p-2 rounded-md hover:bg-slate-100"><X size={18}/></button></div><div className="space-y-4 py-5"><label className="block text-sm font-medium text-slate-700">Responsável<select value={responsible} onChange={(event) => setResponsible(event.target.value)} className="mt-1.5 w-full border border-slate-300 rounded-lg p-2.5"><option value="">Todos os responsáveis</option>{responsibleOptions.map((name) => <option key={name}>{name}</option>)}</select></label><label className="block text-sm font-medium text-slate-700">Situação<select value={status} onChange={(event) => setStatus(event.target.value as 'pending' | 'done')} className="mt-1.5 w-full border border-slate-300 rounded-lg p-2.5"><option value="pending">Pendentes</option><option value="done">Concluídas</option></select></label><label className="block text-sm font-medium text-slate-700">Prioridade<select value={priority} onChange={(event) => setPriority(event.target.value)} className="mt-1.5 w-full border border-slate-300 rounded-lg p-2.5"><option value="">Todas</option><option value="normal">Normal</option><option value="importante">Importante</option><option value="urgente">Urgente</option></select></label><div className="grid grid-cols-2 gap-3"><label className="block text-sm font-medium text-slate-700">Início<input type="date" value={start} onChange={(event) => setStart(event.target.value)} className="mt-1.5 w-full border border-slate-300 rounded-lg p-2.5" /></label><label className="block text-sm font-medium text-slate-700">Término<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className="mt-1.5 w-full border border-slate-300 rounded-lg p-2.5" /></label></div><label className="flex gap-3 items-center text-sm text-slate-700"><input type="checkbox" checked={showFuture} onChange={(event) => setShowFuture(event.target.checked)} className="w-4 h-4" />Mostrar tarefas futuras</label></div><div className="flex justify-between gap-3 border-t border-slate-200 pt-4"><button onClick={clearFilters} className="px-3 py-2 text-sm font-semibold text-slate-600">Limpar filtros</button><button onClick={() => setFilterOpen(false)} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold">Aplicar filtros</button></div></aside></div>}
  </section></>;
}
