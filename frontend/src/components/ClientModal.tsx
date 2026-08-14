import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (clientData: any) => void;
  onSuccess?: () => void;
  clientToEdit?: any;
}

export const ClientModal: React.FC<ClientModalProps> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  onSuccess, 
  clientToEdit 
}) => {
  const [loadingCep, setLoadingCep] = useState(false);
  const [cpfError, setCpfError] = useState('');

  const [origensList, setOrigensList] = useState<string[]>([
    'Indicação de Cliente', 
    'HB - Paraipaba', 
    'HB - Paracuru', 
    'WhatsApp'
  ]);
  const [novaOrigem, setNovaOrigem] = useState('');
  const [showAddOrigem, setShowAddOrigem] = useState(false);

  const initialFormState = {
    nome: '',
    cpf: '',
    rg: '',
    dataNascimento: '',
    nomeMae: '',
    genero: '',
    nacionalidade: 'Brasileira',
    estadoCivil: '',
    profissao: '',
    email: '',
    telefone: '',
    origem: '',
    cep: '',
    endereco: '',
    bairro: '',
    cidade: '',
    estado: '',
    nomeRepresentante: '',
    cpfRepresentante: '',
    senhaGov: '',
    nis: '',
    status: 'Ativo'
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    if (clientToEdit) {
      setFormData({
        ...initialFormState,
        ...clientToEdit,
      });
    } else {
      setFormData(initialFormState);
    }
  }, [clientToEdit, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validarCPF = (cpf: string) => {
    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11 || /^(\d)\1{10}$/.test(cleanCpf)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(cleanCpf.charAt(i)) * (10 - i);
    let resto = 11 - (soma % 11);
    let digito1 = resto === 10 || resto === 11 ? 0 : resto;
    if (digito1 !== parseInt(cleanCpf.charAt(9))) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(cleanCpf.charAt(i)) * (11 - i);
    resto = 11 - (soma % 11);
    let digito2 = resto === 10 || resto === 11 ? 0 : resto;
    return digito2 === parseInt(cleanCpf.charAt(10));
  };

  const handleCpfBlur = () => {
    const cleanCpf = formData.cpf.replace(/\D/g, '');
    if (!cleanCpf) {
      setCpfError('');
      return;
    }
    if (!validarCPF(cleanCpf)) {
      setCpfError('CPF inválido!');
    } else {
      setCpfError('');
    }
  };

  const handleCepBlur = async () => {
    const cleanCep = formData.cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setLoadingCep(true);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          endereco: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          estado: data.uf || '',
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setLoadingCep(false);
    }
  };

  const handleAddOrigem = () => {
    if (novaOrigem.trim() && !origensList.includes(novaOrigem.trim())) {
      setOrigensList([...origensList, novaOrigem.trim()]);
      setFormData({ ...formData, origem: novaOrigem.trim() });
      setNovaOrigem('');
      setShowAddOrigem(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Identifica se estamos editando e qual o identificador correto
      const clientId = clientToEdit?.id || clientToEdit?._id;

      if (clientId) {
        // Tenta enviar para a rota padrão de atualização. 
        // Caso seu backend utilize outra estrutura, ajuste aqui (ex: `/clientes` com o id no body)
        await api.put(`/clientes/${clientId}`, formData);
      } else {
        await api.post('/clientes', formData);
      }

      if (onSave) onSave(formData);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Erro ao salvar cliente:", error);
      // Exibe detalhe da resposta da API se houver
      const mensagemErro = error.response?.data?.message || error.message || 'Erro desconhecido';
      alert(`Erro ao salvar cliente: ${mensagemErro}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {clientToEdit ? 'Editar Cadastro de Cliente' : 'Novo Cadastro de Cliente'}
            </h2>
            <p className="text-sm text-gray-500">Preencha as informações do cliente de forma unificada.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 border-b border-blue-100 pb-1">
              1. Dados Pessoais
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                <input
                  type="text"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleChange}
                  onBlur={handleCpfBlur}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${cpfError ? 'border-red-500' : 'border-gray-300'}`}
                />
                {cpfError && <span className="text-xs text-red-500 mt-1 block">{cpfError}</span>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  name="nome"
                  value={formData.nome}
                  onChange={handleChange}
                  required
                  placeholder="Ex: Maria da Silva"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RG</label>
                <input
                  type="text"
                  name="rg"
                  value={formData.rg}
                  onChange={handleChange}
                  placeholder="00.000.000-0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                <input
                  type="date"
                  name="dataNascimento"
                  value={formData.dataNascimento}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gênero</label>
                <select
                  name="genero"
                  value={formData.genero}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Mãe</label>
                <input
                  type="text"
                  name="nomeMae"
                  value={formData.nomeMae}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nacionalidade</label>
                <input
                  type="text"
                  name="nacionalidade"
                  value={formData.nacionalidade}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado Civil</label>
                <select
                  name="estadoCivil"
                  value={formData.estadoCivil}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  <option value="Solteiro(a)">Solteiro(a)</option>
                  <option value="Casado(a)">Casado(a)</option>
                  <option value="União Estável">União Estável</option>
                  <option value="Divorciado(a)">Divorciado(a)</option>
                  <option value="Viúvo(a)">Viúvo(a)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Profissão</label>
                <input
                  type="text"
                  name="profissao"
                  value={formData.profissao}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 border-b border-blue-100 pb-1">
              2. Contato & Endereço
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  name="telefone"
                  value={formData.telefone}
                  onChange={handleChange}
                  placeholder="(00) 00000-0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Origem</label>
                  {!showAddOrigem && (
                    <button type="button" onClick={() => setShowAddOrigem(true)} className="text-xs text-blue-600 font-medium hover:underline">
                      + Nova origem
                    </button>
                  )}
                </div>
                {!showAddOrigem ? (
                  <select
                    name="origem"
                    value={formData.origem}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    {origensList.map((item, idx) => (
                      <option key={idx} value={item}>{item}</option>
                    ))}
                  </select>
                ) : (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={novaOrigem}
                      onChange={(e) => setNovaOrigem(e.target.value)}
                      placeholder="Nome..."
                      className="flex-1 px-2 py-2 border border-blue-400 rounded-lg text-sm"
                    />
                    <button type="button" onClick={handleAddOrigem} className="px-3 bg-blue-600 text-white rounded-lg text-xs">Ok</button>
                    <button type="button" onClick={() => setShowAddOrigem(false)} className="px-2 bg-gray-200 rounded-lg text-xs">X</button>
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">CEP</label>
                  {loadingCep && <span className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Buscando...</span>}
                </div>
                <input
                  type="text"
                  name="cep"
                  value={formData.cep}
                  onChange={handleChange}
                  onBlur={handleCepBlur}
                  maxLength={9}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input
                  type="text"
                  name="endereco"
                  value={formData.endereco}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                <input
                  type="text"
                  name="bairro"
                  value={formData.bairro}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                <input
                  type="text"
                  name="cidade"
                  value={formData.cidade}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado (UF)</label>
                <input
                  type="text"
                  name="estado"
                  value={formData.estado}
                  onChange={handleChange}
                  maxLength={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg uppercase focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {clientToEdit ? 'Atualizar Cadastro' : 'Salvar Cadastro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};