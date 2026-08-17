import React, { useState } from 'react';
import { api } from '../services/api';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [customDomain, setCustomDomain] = useState(false);
  const [domain, setDomain] = useState('hbadvocacia.adv.br');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Trata o e-mail para evitar duplicação do @ caso o usuário já digite o e-mail completo
    const cleanUsername = username.trim();
    const fullEmail = cleanUsername.includes('@')
      ? cleanUsername
      : `${cleanUsername}@${domain.trim()}`;

    try {
      // Tenta a rota /api/auth/login (ajuste para '/auth/login' se sua baseURL no Axios já inclui '/api')
      const response = await api.post('/api/auth/login', {
        email: fullEmail,
        password,
      });

      const { token, user } = response.data;

      localStorage.setItem('@PlataformaHB:token', token);
      localStorage.setItem('@PlataformaHB:user', JSON.stringify(user));

      onLoginSuccess(user);
    } catch (err: any) {
      console.error('Erro de Autenticação:', err);

      // Tratamento específico de falhas de conexão/rede/CORS vs erro de credenciais
      if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
        setError('Erro de conexão: Servidor backend está offline ou inacessível.');
      } else {
        setError(
          err.response?.data?.error ||
          err.response?.data?.message ||
          'Credenciais inválidas. Verifique seu e-mail e senha.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] px-4">
      <div className="w-full max-w-md bg-[#1e293b] p-10 rounded-xl border border-[#334155] shadow-2xl text-center">
        {/* LOGO DA LOGO COMPLETA HB */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="flex items-center gap-1 font-serif font-bold mb-2">
            <span className="bg-[#3891d0] text-white text-2xl px-3 py-1.5 rounded leading-none">H</span>
            <span className="bg-[#94a3b8] text-[#0f172a] text-2xl px-3 py-1.5 rounded leading-none">B</span>
          </div>
          <div className="text-sm font-bold text-slate-100 tracking-[1.5px] uppercase">HORLANDO BRAGA</div>
          <div className="text-[9px] text-slate-400 tracking-[3px] uppercase mt-0.5">ADVOCACIA</div>
        </div>

        <p className="text-slate-400 text-xs mb-6">Acesso Restrito ao Sistema HBJud</p>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-400 text-xs p-3 rounded-lg text-left break-words">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {/* Campo de E-mail com input e seletor de domínio */}
          <div>
            <div className="flex items-center bg-[#0f172a] border border-[#334155] rounded overflow-hidden focus-within:border-[#3891d0] transition">
              <input
                type="text"
                required
                placeholder="seu.usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-transparent text-slate-100 placeholder-slate-500 px-4 py-2.5 text-sm focus:outline-none"
              />
              {!username.includes('@') && <span className="text-slate-500 text-sm select-none">@</span>}
              
              {!username.includes('@') && (
                customDomain ? (
                  <input
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="outro.com"
                    className="w-36 bg-transparent text-slate-100 px-2 py-2.5 text-sm focus:outline-none border-l border-[#334155]"
                  />
                ) : (
                  <span className="text-slate-300 text-sm px-3 select-none bg-[#1e293b]/50 py-2.5 border-l border-[#334155]">
                    {domain}
                  </span>
                )
              )}
            </div>

            {/* Alternador de domínio */}
            {!username.includes('@') && (
              <div className="text-right mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCustomDomain(!customDomain);
                    if (customDomain) setDomain('hbadvocacia.adv.br');
                  }}
                  className="text-[10px] text-slate-400 hover:text-[#3891d0] transition underline"
                >
                  {customDomain ? 'Usar domínio padrão' : 'Outro domínio?'}
                </button>
              </div>
            )}
          </div>

          <div>
            <input
              type="password"
              required
              placeholder="Senha de acesso"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0f172a] border border-[#334155] text-slate-100 placeholder-slate-500 px-4 py-2.5 rounded text-sm focus:outline-none focus:border-[#3891d0] transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#3891d0] hover:bg-[#2873a8] text-white font-semibold py-2.5 rounded transition text-sm shadow-lg shadow-[#3891d0]/20 disabled:opacity-50 mt-2 flex items-center justify-center"
          >
            {loading ? 'Autenticando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};