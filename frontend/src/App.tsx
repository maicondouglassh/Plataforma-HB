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
  const [user, setUser] = useState<any>(null);
  const [clientsList, setClientsList] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('clients');

  useEffect(() => {
    const savedUser = localStorage.getItem('@PlataformaHB:user');
    const token = localStorage.getItem('@PlataformaHB:token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
      fetchClients();
    }
  }, []);

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients');
      setClientsList(response.data);
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
    return <Login onLoginSuccess={(u) => { setUser(u); fetchClients(); }} />;
  }

  const filteredClients = clientsList.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.cpfCnpj.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* SIDEBAR LATERAL FIXA - Tons Slate Dark para Sofisticação */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800">
        <div>
          {/* LOGO DA PLATAFORMA - Mais minimalista e corporativa */}
          <div className="p-6 flex items-center gap-3 border-b border-slate-800">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-600/30">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-wide leading-none">PLATAFORMA HB</h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-wider uppercase mt-1">Gestão Previdenciária</p>
            </div>
          </div>

          {/* MENU DE NAVEGAÇÃO - Ícones minimalistas e estados claros */}
          <nav className="p-4 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'clients', label: 'Clientes', icon: Users, count: clientsList.length },
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
                  {item.count && (
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

        {/* PERFIL DO USUÁRIO & LOGOUT - Integrado na base da sidebar */}
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

      {/* ÁREA DE CONTEÚDO PRINCIPAL - Fundo Slate 50 para clareza */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* BARRA SUPERIOR (HEADER) - Limpa e informativa */}
        <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3 text-slate-500 text-sm">
            <span className="hover:text-slate-800 cursor-pointer">Início</span>
            <ChevronRight size={14} />
            <span className="font-semibold text-slate-800 capitalize">{activeTab}</span>
          </div>

          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              <ShieldCheck size={14} />
              Banco SQLite Local Conectado
            </span>
          </div>
        </header>

        {/* ÁREA DE TRABALHO - Espaçamento generoso */}
        <main className="flex-1 p-8 overflow-y-auto">
          {/* CABEÇALHO DA PÁGINA DE CLIENTES */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Gestão de Clientes</h2>
              <p className="text-slate-500 text-sm mt-0.5">Cadastre e acompanhe as fichas dos clientes previdenciários.</p>
            </div>
            <button className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-md shadow-blue-600/20 transition duration-150">
              <Plus size={18} />
              Novo Cliente
            </button>
          </div>

          {/* METRIC CARDS - Design limpo, bordas suaves e ícones destacados */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total de Clientes</p>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{clientsList.length}</h3>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Users size={22} />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Clientes Ativos</p>
                <h3 className="text-2xl font-bold text-emerald-600 mt-1">
                  {clientsList.filter(c => c.status === 'Ativo').length}
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
                  {clientsList.filter(c => c.status === 'Em Prospecção').length}
                </h3>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Briefcase size={22} />
              </div>
            </div>
          </div>

          {/* TABELA E BUSCA - Container unificado, visual SaaS moderno */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            {/* BARRA DE PESQUISA - Integrada ao card da tabela */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-2.5 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por nome ou CPF..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition duration-150"
                />
              </div>
            </div>

            {/* TABELA DE DADOS - Espaçamento e tipografia refinados */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                    <th className="py-3.5 px-6">Nome do Cliente</th>
                    <th className="py-3.5 px-6">CPF / CNPJ</th>
                    <th className="py-3.5 px-6">Telefone</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        Nenhum cliente localizado.
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client) => (
                      <tr key={client.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="py-4 px-6 font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                          {client.name}
                        </td>
                        <td className="py-4 px-6 text-slate-600 font-mono text-xs">{client.cpfCnpj}</td>
                        <td className="py-4 px-6 text-slate-600">{client.phone || '-'}</td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            client.status === 'Ativo' 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {client.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button className="text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition duration-150">
                            Ver Ficha
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}