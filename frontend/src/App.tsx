import { ClientModal } from './components/ClientModal';
import { Operations } from './pages/Operations';
import { SettingsPage } from './pages/Settings';
import { Dashboard } from './pages/Dashboard';
import { useState, useEffect } from 'react';
import { Login } from './pages/Login';
import { 
  Users, 
  Building2, 
  UserCheck, 
  LogOut, 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  Settings, 
  Plus, 
  Search, 
  ChevronRight,
  ChevronLeft,
  Archive,
  UserX,
  UserMinus,
  Filter,
  X,
  Handshake,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { api } from './services/api';

export function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [clientesList, setclientesList] = useState<any[]>([]);
  
  const [selectedStatusCard, setSelectedStatusCard] = useState('');
  const [filterTexto, setFilterTexto] = useState('');
  const [filterOrigem, setFilterOrigem] = useState('');
  const [filterCidade, setFilterCidade] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [processClientId, setProcessClientId] = useState<string | null>(null);
  const [clientPage, setClientPage] = useState(1);
  const clientPageSize = 50;
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('@PlataformaHB:theme') === 'dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleTheme = () => setDarkMode((current) => { const next = !current; localStorage.setItem('@PlataformaHB:theme', next ? 'dark' : 'light'); return next; });

  useEffect(() => {
    const savedUser = localStorage.getItem('@PlataformaHB:user');
    const token = localStorage.getItem('@PlataformaHB:token');
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser));
        fetchclientes();
      } catch (err) {
        console.error('Erro ao restaurar sessão:', err);
      }
    }
  }, []);

  const fetchclientes = async () => {
    try {
      const response = await api.get('/api/clientes');
      setclientesList(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
    }
  };

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
    fetchclientes();
  };

  const handleLogout = () => {
    localStorage.removeItem('@PlataformaHB:token');
    localStorage.removeItem('@PlataformaHB:user');
    setUser(null);
  };

  if (!user) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Tratamento seguro para nome e e-mail
  const displayName = user?.name || user?.username || user?.email || 'Usuário';
  const initialLetter = displayName.charAt(0).toUpperCase();
  // A API confirma o perfil antes de excluir; mantemos o comando disponível para o perfil salvo no painel operacional.
  const canDeleteClients = true;

  const getClientStatus = (c: any) => {
    if (c.status && c.status !== 'Ativo') {
      return c.status;
    }
    const temProcesso = c.processoId || c.hasProcess || c.processo; 
    return temProcesso ? 'Ativo' : 'Sem Processo';
  };

  const origensDisponiveis = Array.from(
    new Set(clientesList.map(c => c.origem).filter(Boolean))
  );

  const cidadesDisponiveis = Array.from(
    new Set(clientesList.map(c => c.cidade || c.city).filter(Boolean))
  );

  const matchesPainelFiltros = (c: any) => {
    const term = filterTexto.toLowerCase();
    
    const matchesTexto = !filterTexto || (
      (c.nome || c.name)?.toLowerCase().includes(term) ||
      c.cpf?.toLowerCase().includes(term) ||
      c.cpfCnpj?.toLowerCase().includes(term) ||
      c.rg?.toLowerCase().includes(term) ||
      (c.nomeMae || c.motherName)?.toLowerCase().includes(term) ||
      (c.telefone || c.phone)?.toLowerCase().includes(term) ||
      (c.cidade || c.city)?.toLowerCase().includes(term) ||
      (c.profissao || c.profession)?.toLowerCase().includes(term) ||
      c.nis?.toLowerCase().includes(term)
    );

    const matchesOrigem = !filterOrigem || c.origem === filterOrigem;
    const matchesCidade = !filterCidade || (c.cidade || c.city) === filterCidade;

    return matchesTexto && matchesOrigem && matchesCidade;
  };

  const clientesParaCards = clientesList.filter(matchesPainelFiltros);

  const totalClientesCount = clientesParaCards.length;
  const clientesAtivosCount = clientesParaCards.filter(c => getClientStatus(c) === 'Ativo').length;
  const arquivadosCount = clientesParaCards.filter(c => getClientStatus(c) === 'Arquivado').length;
  const emProspeccaoCount = clientesParaCards.filter(c => getClientStatus(c) === 'Em Prospecção').length;
  const descartadosCount = clientesParaCards.filter(c => getClientStatus(c) === 'Descartado').length;
  const semProcessoCount = clientesParaCards.filter(c => getClientStatus(c) === 'Sem Processo').length;

  const filteredclientes = clientesList.filter((c) => {
    const passaPainel = matchesPainelFiltros(c);
    const cStatus = getClientStatus(c);
    const passaCardStatus = !selectedStatusCard || cStatus === selectedStatusCard;

    return passaPainel && passaCardStatus;
  });
  const totalClientPages = Math.max(1, Math.ceil(filteredclientes.length / clientPageSize));
  const currentClientPage = Math.min(clientPage, totalClientPages);
  const displayedClients = filteredclientes.slice((currentClientPage - 1) * clientPageSize, currentClientPage * clientPageSize);

  const handleClearFunil = () => {
    setFilterTexto('');
    setFilterOrigem('');
    setFilterCidade('');
    setSelectedStatusCard('');
  };

  const hasActiveFunil = filterTexto || filterOrigem || filterCidade || selectedStatusCard;

  return (
    <div className={`min-h-screen bg-slate-50 flex ${darkMode ? 'dark-mode' : ''}`}>
      {/* SIDEBAR LATERAL FIXA */}
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} h-screen sticky top-0 shrink-0 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 transition-[width] duration-200`}>
        <div>
          <div className="p-4 flex items-center gap-3 border-b border-slate-800">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/30">
              <Building2 size={24} />
            </div>
            {!sidebarCollapsed && <div>
              <h1 className="text-lg font-bold text-white tracking-wide leading-none">PLATAFORMA HB</h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase mt-1">Gestão Previdenciária</p>
            </div>}
            <button onClick={() => setSidebarCollapsed((value) => !value)} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white" title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}>{sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
          </div>

          <nav className="p-4 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, count: undefined, badge: undefined },
              { id: 'clientes', label: 'Clientes', icon: Users, count: clientesList.length, badge: undefined },
              { id: 'comercial', label: 'Atendimentos', icon: Handshake, count: undefined, badge: undefined },
              { id: 'processes', label: 'Processos', icon: Briefcase, count: undefined, badge: undefined },
              { id: 'documents', label: 'Documentos', icon: FileText, count: undefined, badge: undefined },
              { id: 'settings', label: 'Configurações', icon: Settings, count: undefined, badge: undefined },
            ].map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition duration-150 ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                      : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} />
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </div>
                  {!sidebarCollapsed && item.count !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isActive ? 'bg-white text-blue-700' : 'bg-slate-800 text-slate-300'}`}>
                      {item.count}
                    </span>
                  )}
                  {item.badge && (
                    <span className="text-[10px] bg-blue-900/50 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-800">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {initialLetter}
              </div>
              {!sidebarCollapsed && <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">{displayName}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email || '-'}</p>
              </div>}
            </div>
            {!sidebarCollapsed && <button
              onClick={toggleTheme}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              title={darkMode ? 'Usar modo claro' : 'Usar modo escuro'}
            >
              {darkMode ? <Sun size={16} /> : <Moon size={16} />}
            </button>}
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
              title="Sair do sistema"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10 gap-4">
          <div className="flex items-center gap-3 text-slate-500 text-sm shrink-0">
            <span className="hover:text-slate-800 cursor-pointer">Início</span>
            <ChevronRight size={14} />
            <span className="font-semibold text-slate-800 capitalize">{activeTab}</span>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button onClick={toggleTheme} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title={darkMode ? 'Usar modo claro' : 'Usar modo escuro'}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
          </div>
        </header>

        <main className="flex-1 p-8 overflow-y-auto">
          {activeTab === 'clientes' && (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Gestão de Clientes</h2>
                  <p className="text-slate-500 text-sm mt-0.5">Clique em qualquer linha da tabela para visualizar ou editar os dados.</p>
                </div>
                <button 
                  onClick={() => { setSelectedClient(null); setIsModalOpen(true); }}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-blue-600/20 transition duration-150"
                >
                  <Plus size={18} />
                  Novo Cliente
                </button>
              </div>

              {/* CARDS SUPERIORES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
                <div 
                  onClick={() => setSelectedStatusCard('')}
                  className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-sm flex items-center justify-between ${selectedStatusCard === '' ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200/80 hover:border-slate-300'}`}
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Clientes</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{totalClientesCount}</h3>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <Users size={22} />
                  </div>
                </div>

                <div 
                  onClick={() => setSelectedStatusCard('Ativo')}
                  className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-sm flex items-center justify-between ${selectedStatusCard === 'Ativo' ? 'border-emerald-600 ring-2 ring-emerald-600/20' : 'border-slate-200/80 hover:border-slate-300'}`}
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Clientes Ativos</p>
                    <h3 className="text-2xl font-bold text-emerald-600 mt-1">{clientesAtivosCount}</h3>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                    <UserCheck size={22} />
                  </div>
                </div>

                <div 
                  onClick={() => setSelectedStatusCard('Arquivado')}
                  className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-sm flex items-center justify-between ${selectedStatusCard === 'Arquivado' ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-slate-200/80 hover:border-slate-300'}`}
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Clientes Arquivados</p>
                    <h3 className="text-2xl font-bold text-indigo-600 mt-1">{arquivadosCount}</h3>
                  </div>
                  <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Archive size={22} />
                  </div>
                </div>

                <div 
                  onClick={() => setSelectedStatusCard('Em Prospecção')}
                  className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-sm flex items-center justify-between ${selectedStatusCard === 'Em Prospecção' ? 'border-amber-600 ring-2 ring-amber-600/20' : 'border-slate-200/80 hover:border-slate-300'}`}
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Em Prospecção</p>
                    <h3 className="text-2xl font-bold text-amber-600 mt-1">{emProspeccaoCount}</h3>
                  </div>
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                    <Briefcase size={22} />
                  </div>
                </div>

                <div 
                  onClick={() => setSelectedStatusCard('Descartado')}
                  className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-sm flex items-center justify-between ${selectedStatusCard === 'Descartado' ? 'border-red-600 ring-2 ring-red-600/20' : 'border-slate-200/80 hover:border-slate-300'}`}
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Clientes Descartados</p>
                    <h3 className="text-2xl font-bold text-red-600 mt-1">{descartadosCount}</h3>
                  </div>
                  <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                    <UserX size={22} />
                  </div>
                </div>

                <div 
                  onClick={() => setSelectedStatusCard('Sem Processo')}
                  className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-sm flex items-center justify-between ${selectedStatusCard === 'Sem Processo' ? 'border-slate-600 ring-2 ring-slate-600/20' : 'border-slate-200/80 hover:border-slate-300'}`}
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sem Processo</p>
                    <h3 className="text-2xl font-bold text-slate-600 mt-1">{semProcessoCount}</h3>
                  </div>
                  <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
                    <UserMinus size={22} />
                  </div>
                </div>
              </div>

              {/* PAINEL DE FILTROS */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm mb-8">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
                    <Filter size={16} className="text-blue-600" />
                    <span>Painel de Filtros Múltiplos</span>
                  </div>
                  {hasActiveFunil && (
                    <button 
                      onClick={handleClearFunil}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-medium transition"
                    >
                      <X size={14} />
                      Limpar filtros
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Buscar por Nome / CPF</label>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
                      <input 
                        type="text"
                        placeholder="Ex: Maria, 123..."
                        value={filterTexto}
                        onChange={(e) => setFilterTexto(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Origem</label>
                    <select 
                      value={filterOrigem}
                      onChange={(e) => setFilterOrigem(e.target.value)}
                      className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition text-slate-700"
                    >
                      <option value="">Todas as origens</option>
                      {origensDisponiveis.map(origem => (
                        <option key={origem} value={origem}>{origem}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Cidade</label>
                    <select 
                      value={filterCidade}
                      onChange={(e) => setFilterCidade(e.target.value)}
                      className="w-full py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition text-slate-700"
                    >
                      <option value="">Todas as cidades</option>
                      {cidadesDisponiveis.map(cidade => (
                        <option key={cidade} value={cidade}>{cidade}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* TABELA DE CLIENTES */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                        <th className="py-3.5 px-6">Nome do Cliente</th>
                        <th className="py-3.5 px-6">CPF / CNPJ</th>
                        <th className="py-3.5 px-6">Cidade</th>
                        <th className="py-3.5 px-6">Telefone</th>
                        <th className="py-3.5 px-6">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredclientes.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-slate-400">
                            Nenhum cliente localizado.
                          </td>
                        </tr>
                      ) : (
                        displayedClients.map((client) => {
                          const currentStatus = getClientStatus(client);
                          return (
                            <tr 
                              key={client.id || client._id} 
                              onClick={() => { setSelectedClient(client); setIsModalOpen(true); }}
                              className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                            >
                              <td className="py-4 px-6 font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                                {client.nome || client.name || '-'}
                              </td>
                              <td className="py-4 px-6 text-slate-600 font-mono text-xs">
                                {client.cpf || client.cpfCnpj || '-'}
                              </td>
                              <td className="py-4 px-6 text-slate-600">
                                {client.cidade || client.city || '-'}
                              </td>
                              <td className="py-4 px-6 text-slate-600">{client.telefone || client.phone || '-'}</td>
                              <td className="py-4 px-6">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  currentStatus === 'Ativo'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                                }`}>
                                  {currentStatus}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
                <span>Mostrando {filteredclientes.length ? (currentClientPage - 1) * clientPageSize + 1 : 0}-{Math.min(currentClientPage * clientPageSize, filteredclientes.length)} de {filteredclientes.length}</span>
                <div className="flex items-center gap-2"><button onClick={() => setClientPage((page) => Math.max(1, page - 1))} disabled={currentClientPage === 1} className="rounded-lg border p-2 disabled:opacity-40" title="Página anterior"><ChevronLeft size={16} /></button><span>Página {currentClientPage} de {totalClientPages}</span><button onClick={() => setClientPage((page) => Math.min(totalClientPages, page + 1))} disabled={currentClientPage === totalClientPages} className="rounded-lg border p-2 disabled:opacity-40" title="Próxima página"><ChevronRight size={16} /></button></div>
              </div>
            </div>
            </>
          )}

          {activeTab === 'dashboard' && <Dashboard />}

          {activeTab === 'comercial' && <Operations mode="comercial" clients={clientesList} onNewClient={() => { setSelectedClient(null); setIsModalOpen(true); }} />}
          {activeTab === 'processes' && <Operations mode="processos" clients={clientesList} initialClientId={processClientId} onInitialClientUsed={() => setProcessClientId(null)} onNewClient={() => { setSelectedClient(null); setIsModalOpen(true); }} />}
          {activeTab === 'settings' && <SettingsPage />}

          <ClientModal
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); setSelectedClient(null); }}
            onSave={fetchclientes}
            onSuccess={fetchclientes}
            clientToEdit={selectedClient} 
            onNewProcess={(clientId) => { setIsModalOpen(false); setActiveTab('processes'); setProcessClientId(clientId); }}
            canDelete={canDeleteClients}
            onDelete={async (clientId) => { await api.delete(`/api/clientes/${clientId}`); await fetchclientes(); }}
          />
        </main>
      </div>
    </div>
  );
}
