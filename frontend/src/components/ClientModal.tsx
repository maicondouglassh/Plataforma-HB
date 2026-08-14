import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Phone, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (clientData?: any) => void;
  onSuccess?: () => void;
  clientToEdit?: any;
}

export function ClientModal({ isOpen, onClose, onSave, onSuccess, clientToEdit }: ClientModalProps) {
  const [loadingCep, setLoadingCep] = useState(false);
  const [cpfError, setCpfError] = useState('');

  const [formData, setFormData] = useState({
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
  });

  const [origensList, setOrigensList] = useState<string[]>([
    'Indicação de Cliente', 
    'HB - Paraipaba', 
    'HB - Paracuru', 
    'WhatsApp',
    'Natalia Rocha'
  ]);
  const [novaOrigem, setNovaOrigem] = useState('');
  const [showAddOrigem, setShowAddOrigem] = useState(false);
  const [telefones, setTelefones] = useState<string[]>(['']);

  useEffect(() => {
    if (clientToEdit) {
      setFormData({
        nome: clientToEdit.nome || clientToEdit.name || '',
        cpf: clientToEdit.cpf || clientToEdit.cpfCnpj || '',
        rg: clientToEdit.rg || '',
        dataNascimento: clientToEdit.dataNascimento || '',
        nomeMae: clientToEdit.nomeMae || clientToEdit.motherName || '',
        genero: clientToEdit.genero || '',
        nacionalidade: clientToEdit.nacionalidade || 'Brasileira',
        estadoCivil: clientToEdit.estadoCivil || '',
        profissao: clientToEdit.profissao || clientToEdit.profession || '',
        email: clientToEdit.email || '',
        origem: clientToEdit.origem || clientToEdit.origin || '',
        cep: clientToEdit.cep || '',
        endereco: clientToEdit.endereco || '',
        bairro: clientToEdit.bairro || '',
        cidade: clientToEdit.cidade || clientToEdit.city || '',
        estado: clientToEdit.estado || '',
        nomeRepresentante: clientToEdit.nomeRepresentante || '',
        cpfRepresentante: clientToEdit.cpfRepresentante || '',
        senhaGov: clientToEdit.senhaGov || '',
        nis: clientToEdit.nis || '',
        status: clientToEdit.status || 'Ativo'
      });

      const campoTelefone = clientToEdit.telefone || clientToEdit.phone || '';
      if (campoTelefone) {
        const lista = campoTelefone.split(',').map((t: string) => t.trim()).filter(Boolean);
        setTelefones(lista.length > 0 ? lista : ['']);
      } else {
        setTelefones(['']);
      }
    } else {
      setFormData({
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
      });
      setTelefones(['']);
    }
    setCpfError('');
  }, [clientToEdit, isOpen]);

  if (!isOpen) return null;

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

  const handleAddPhoneField = () => {
    setTelefones([...telefones, '']);
  };

  const handleRemovePhoneField = (index: number) => {
    const novosTelefones = telefones.filter((_, i) => i !== index);
    setTelefones(novosTelefones.length > 0 ? novosTelefones : ['']);
  };

  const handlePhoneChange = (index: number, value: string) => {
    const novosTelefones = [...telefones];
    novosTelefones[index] = value;
    setTelefones(novosTelefones);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const telefonesFormatados = telefones
      .map(t => t.trim())
      .filter(Boolean)
      .join(', ');

    const payload = {
      ...formData,
      telefone: telefonesFormatados,
      cpfCnpj: formData.cpf 
    };

    try {
      const clientId = clientToEdit?.id || clientToEdit?._id;
      if (clientId) {
        await api.put(`/clientes/${clientId}`, payload);
      } else {
        await api.post('/clientes', payload);
      }
      if (onSave) onSave(payload);
      if (onSuccess) onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao salvar cliente', error);
      const mensagemErro = error.response?.data?.message || error.message || 'Erro desconhecido';
      alert(`Erro ao salvar cliente: ${mensagemErro}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden border border-slate-100 my-8">
        
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {clientToEdit ? 'Editar Cliente' : 'Novo Cliente'}
            </h3>
            <p className="text-xs text-slate-500">Preencha todas as informações do cliente</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome do Cliente *</label>
              <input 
                type="text" 
                required
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Nome completo"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">CPF</label>
              <input 
                type="text" 
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                onBlur={handleCpfBlur}
                placeholder="000.000.000-00"
                maxLength={14}
                className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition ${cpfError ? 'border-red-500' : 'border-slate-200'}`}
              />
              {cpfError && <span className="text-xs text-red-500 mt-1 block">{cpfError}</span>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">RG</label>
              <input 
                type="text" 
                value={formData.rg}
                onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                placeholder="Número do RG"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Data de Nascimento</label>
              <input 
                type="date" 
                value={formData.dataNascimento}
                onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition text-slate-700"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome da Mãe</label>
              <input 
                type="text" 
                value={formData.nomeMae}
                onChange={(e) => setFormData({ ...formData, nomeMae: e.target.value })}
                placeholder="Nome completo da mãe"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Gênero</label>
              <select 
                value={formData.genero}
                onChange={(e) => setFormData({ ...formData, genero: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition text-slate-700"
              >
                <option value="">Selecione...</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nacionalidade</label>
              <input 
                type="text" 
                value={formData.nacionalidade}
                onChange={(e) => setFormData({ ...formData, nacionalidade: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Estado Civil</label>
              <select 
                value={formData.estadoCivil}
                onChange={(e) => setFormData({ ...formData, estadoCivil: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition text-slate-700"
              >
                <option value="">Selecione...</option>
                <option value="Solteiro(a)">Solteiro(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viúvo(a)">Viúvo(a)</option>
                <option value="União Estável">União Estável</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Profissão</label>
              <input 
                type="text" 
                value={formData.profissao}
                onChange={(e) => setFormData({ ...formData, profissao: e.target.value })}
                placeholder="Ex: Agricultor"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">E-mail</label>
              <input 
                type="email" 
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase">Origem</label>
                {!showAddOrigem && (
                  <button type="button" onClick={() => setShowAddOrigem(true)} className="text-xs text-blue-600 font-semibold hover:underline">
                    + Nova origem
                  </button>
                )}
              </div>
              {!showAddOrigem ? (
                <select 
                  value={formData.origem}
                  onChange={(e) => setFormData({ ...formData, origem: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition text-slate-700"
                >
                  <option value="">Selecione a origem...</option>
                  {origensList.map((item, idx) => (
                    <option key={idx} value={item}>{item}</option>
                  ))}
                </select>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={novaOrigem}
                    onChange={(e) => setNovaOrigem(e.target.value)}
                    placeholder="Nome..."
                    className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-blue-400 rounded-xl focus:outline-none"
                  />
                  <button type="button" onClick={handleAddOrigem} className="px-3 bg-blue-600 text-white rounded-xl text-xs font-semibold">Ok</button>
                  <button type="button" onClick={() => setShowAddOrigem(false)} className="px-2 bg-slate-200 rounded-xl text-xs font-semibold">X</button>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase">CEP</label>
                {loadingCep && <span className="text-xs text-blue-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin"/> Buscando...</span>}
              </div>
              <input 
                type="text" 
                value={formData.cep}
                onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                onBlur={handleCepBlur}
                maxLength={9}
                placeholder="00000-000"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Endereço</label>
              <input 
                type="text" 
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                placeholder="Rua, número, complemento"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Bairro</label>
              <input 
                type="text" 
                value={formData.bairro}
                onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                placeholder="Nome do bairro"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Cidade</label>
              <input 
                type="text" 
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                placeholder="Nome da cidade"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Estado</label>
              <input 
                type="text" 
                value={formData.estado}
                onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                maxLength={2}
                placeholder="UF"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl uppercase focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome do Representante</label>
              <input 
                type="text" 
                value={formData.nomeRepresentante}
                onChange={(e) => setFormData({ ...formData, nomeRepresentante: e.target.value })}
                placeholder="Se houver"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">CPF do Representante</label>
              <input 
                type="text" 
                value={formData.cpfRepresentante}
                onChange={(e) => setFormData({ ...formData, cpfRepresentante: e.target.value })}
                placeholder="000.000.000-00"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Senha GOV.BR</label>
              <input 
                type="text" 
                value={formData.senhaGov}
                onChange={(e) => setFormData({ ...formData, senhaGov: e.target.value })}
                placeholder="Senha"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">NIS / PIS / PASEP</label>
              <input 
                type="text" 
                value={formData.nis}
                onChange={(e) => setFormData({ ...formData, nis: e.target.value })}
                placeholder="Número do NIS"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Status</label>
              <select 
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition text-slate-700"
              >
                <option value="Ativo">Ativo</option>
                <option value="Em Prospecção">Em Prospecção</option>
                <option value="Arquivado">Arquivado</option>
                <option value="Descartado">Descartado</option>
                <option value="Sem Processo">Sem Processo</option>
              </select>
            </div>

          </div>

          {/* Seção de Telefones Ilimitados Dinâmicos */}
          <div className="border-t border-slate-100 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase">Telefones de Contato</label>
              <button 
                type="button"
                onClick={handleAddPhoneField}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
              >
                <Plus size={14} />
                Adicionar outro telefone
              </button>
            </div>

            <div className="space-y-2.5 max-h-36 overflow-y-auto pr-1">
              {telefones.map((tel, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Phone className="absolute left-3.5 top-3 text-slate-400" size={15} />
                    <input 
                      type="text"
                      value={tel}
                      onChange={(e) => handlePhoneChange(index, e.target.value)}
                      placeholder={`Telefone ${index + 1} (Ex: (85) 99999-9999)`}
                      className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                    />
                  </div>
                  {telefones.length > 1 && (
                    <button 
                      type="button"
                      onClick={() => handleRemovePhoneField(index)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                      title="Remover telefone"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-2">
            <button 
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-600/20 transition flex items-center gap-1.5"
            >
              <CheckCircle2 size={16} />
              {clientToEdit ? 'Atualizar Cadastro' : 'Salvar Cadastro'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}