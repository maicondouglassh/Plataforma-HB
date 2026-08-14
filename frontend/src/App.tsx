import { ClientModal } from './components/ClientModal';
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
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { api } from './services/api';

export function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [clientesList, setclientesList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrigem, setSelectedOrigem] = useState('');
  const [activeTab, setActiveTab] = useState('clientes');

  useEffect(() => {
    const savedUser = localStorage.getItem('@PlataformaHB:user');
    const token = localStorage.getItem('@PlataformaHB:token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
      fetchclientes();
    }
  }, []);

  const fetchclientes = async () => {
    try {
      const response = await api.get('/clientes');
      setclientesList(response.data);
    } catch (err) {
      console.error('Erro ao buscar clientes', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('@PlataformaHB:token');
    localStorage.removeItem('@PlataformaHB:user');
    setUser(null);
  };

  if (!user) {
    return <Login onLoginSuccess={(u) => { setUser(u); fetchclientes(); }} />;
  }

  // Extrai dinamicamente todas as origens únicas cadastradas para popular o select
  const origensDisponiveis = Array.from(
    new Set(clientesList.map(c => c.origem).filter(Boolean))
  );

  // Filtro unificado combinando busca por texto e seleção de origem
  const filteredclientes = clientesList.filter((c) => {
    const term = searchTerm.toLowerCase();
    
    const matchesSearch = !searchTerm || (
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

    const matchesOrigem = !selectedOrigem || c.origem === selectedOrigem;

    return matchesSearch && matchesOrigem;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* SIDEBAR LATERAL FIXA */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800">
        <div>
          <div className="p-6 flex items-center gap-3 border-b border-slate-800">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/30">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide leading-none">PLATAFORMA HB</h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase mt-1">Gestão Previdenciária</p>
            </div>
          </div>

          <nav className="p-4 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'clientes', label: 'Clientes', icon: Users, count: clientesList.length },
              { id: 'processes', label: 'Processos', icon: Briefcase, badge: 'Em breve' },
              { id: 'documents', label: 'Documentos', icon: FileText },
              { id: 'settings', label: 'Configurações', icon: Settings },
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
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && (
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
                {user.name.charAt(0)}
              </div>
              <div className="truncate">
                <p className="text-xs font-semibold text-white truncate">{user.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
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

          {/* BARRA DE BUSCA E FILTRO DINÂMICO DE ORIGEM */}
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-2.5 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Pesquisar cliente ou processo em qualquer tela..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition duration-150"
              />
            </div>

            <select
              value={selectedOrigem}
              onChange={(e) => setSelectedOrigem(e.target.value)}
              className="py-2 px-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition duration-150 text-slate-600 shrink-0"
            >
              <option value="">Todas as Origens</option>
              {origensDisponiveis.map((origem: any) => (
                <option key={origem} value={origem}>
                  {origem}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck size={14} />
              Banco SQLite Local Conectado
            </span>
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Clientes</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{clientesList.length}</h3>
                  </div>
                  <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                    <Users size={22} />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Clientes Ativos</p>
                    <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                      {clientesList.filter(c => c.status === 'Ativo' || !c.status).length}
                    </h3>
                  </div>
                  <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                    <UserCheck size={22} />
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Em Prospecção</p>
                    <h3 className="text-2xl font-bold text-amber-600 mt-1">
                      {clientesList.filter(c => c.status === 'Em Prospecção').length}
                    </h3>
                  </div>
                  <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                    <Briefcase size={22} />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                        <th className="py-3.5 px-6">Nome do Cliente</th>
                        <th className="py-3.5 px-6">CPF / CNPJ</th>
                        <th className="py-3.5 px-6">Telefone</th>
                        <th className="py-3.5 px-6">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {filteredclientes.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-12 text-center text-slate-400">
                            Nenhum cliente localizado com esse critério.
                          </td>
                        </tr>
                      ) : (
                        filteredclientes.map((client) => (
                          <tr 
                            key={client.id || client._id} 
                            onClick={() => { setSelectedClient(client); setIsModalOpen(true); }}
                            className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                            title="Clique para editar"
                          >
                            <td className="py-4 px-6 font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                              {client.nome || client.name || '-'}
                            </td>
                            <td className="py-4 px-6 text-slate-600 font-mono text-xs">
                              {client.cpf || client.cpfCnpj || '-'}
                            </td>
                            <td className="py-4 px-6 text-slate-600">{client.telefone || client.phone || '-'}</td>
                            <td className="py-4 px-6">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                client.status === 'Ativo' || !client.status
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                  : 'bg-slate-100 text-slate-700 border border-slate-200'
                              }`}>
                                {client.status || 'Ativo'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab !== 'clientes' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-12 text-center">
              <h3 className="text-xl font-bold text-slate-800 mb-2">Módulo em Desenvolvimento</h3>
              <p className="text-slate-500 text-sm">O conteúdo da aba "{activeTab}" aparecerá aqui em breve.</p>
            </div>
          )}

          <ClientModal
            isOpen={isModalOpen}
            onClose={() => { setIsModalOpen(false); setSelectedClient(null); }}
            onSave={fetchclientes}
            onSuccess={fetchclientes}
            clientToEdit={selectedClient} 
          />
        </main>
      </div>
    </div>
  );
}