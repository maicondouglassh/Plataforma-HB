import React, { useEffect, useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Phone,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api';

interface ClienteFormData {
  nome: string;
  cpf: string;
  rg: string;
  dataNascimento: string;
  nomeMae: string;
  genero: string;
  nacionalidade: string;
  estadoCivil: string;
  profissao: string;
  email: string;
  origem: string;
  cep: string;
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
  nomeRepresentante: string;
  cpfRepresentante: string;
  senhaGov: string;
  nis: string;
  status: string;
}

interface Cliente {
  id?: string;
  nome?: string;
  cpf?: string;
  rg?: string;
  dataNascimento?: string;
  nomeMae?: string;
  genero?: string;
  nacionalidade?: string;
  estadoCivil?: string;
  profissao?: string;
  email?: string;
  origem?: string;
  cep?: string;
  endereco?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  nomeRepresentante?: string;
  cpfRepresentante?: string;
  senhaGov?: string;
  nis?: string;
  status?: string;
  telefone?: string;
}

interface ClienteSemelhante {
  id?: string;
  nome?: string;
  cpf?: string;
  dataNascimento?: string;
  nomeMae?: string;
}

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (
    clienteData?: ClienteFormData & { telefone: string }
  ) => void;
  onSuccess?: () => void;
  clientToEdit?: Cliente;
  onNewProcess?: (clientId: string) => void;
  canDelete?: boolean;
  onDelete?: (clientId: string) => Promise<void>;
}

const FORM_INICIAL: ClienteFormData = {
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
  status: 'Ativo',
};

export function ClientModal({
  isOpen,
  onClose,
  onSave,
  onSuccess,
  clientToEdit,
  onNewProcess,
  canDelete = false,
  onDelete,
}: ClientModalProps) {
  const [loadingCep, setLoadingCep] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const [cpfError, setCpfError] = useState('');
  const [cpfDuplicado, setCpfDuplicado] = useState<ClienteSemelhante | null>(
    null
  );

  const [buscandoDuplicidade, setBuscandoDuplicidade] = useState(false);

  const [clientesSemelhantes, setClientesSemelhantes] = useState<
    ClienteSemelhante[]
  >([]);

  const [mostrarSemelhantes, setMostrarSemelhantes] = useState(false);

  const [formData, setFormData] =
    useState<ClienteFormData>(FORM_INICIAL);

  const [origensList, setOrigensList] = useState<string[]>([
    'Indicação de Cliente',
    'HB - Paraipaba',
    'HB - Paracuru',
    'WhatsApp',
    'Natalia Rocha',
  ]);

  const [novaOrigem, setNovaOrigem] = useState('');
  const [showAddOrigem, setShowAddOrigem] = useState(false);

  const [telefones, setTelefones] = useState<string[]>(['']);

  /*
   * =========================================================
   * INICIALIZAÇÃO DO FORMULÁRIO
   * =========================================================
   */

  useEffect(() => {
    if (clientToEdit) {
      setFormData({
        nome: clientToEdit.nome || '',
        cpf: clientToEdit.cpf || '',
        rg: clientToEdit.rg || '',
        dataNascimento: clientToEdit.dataNascimento || '',
        nomeMae: clientToEdit.nomeMae || '',
        genero: clientToEdit.genero || '',
        nacionalidade:
          clientToEdit.nacionalidade || 'Brasileira',
        estadoCivil: clientToEdit.estadoCivil || '',
        profissao: clientToEdit.profissao || '',
        email: clientToEdit.email || '',
        origem: clientToEdit.origem || '',
        cep: clientToEdit.cep || '',
        endereco: clientToEdit.endereco || '',
        bairro: clientToEdit.bairro || '',
        cidade: clientToEdit.cidade || '',
        estado: clientToEdit.estado || '',
        nomeRepresentante:
          clientToEdit.nomeRepresentante || '',
        cpfRepresentante:
          clientToEdit.cpfRepresentante || '',
        senhaGov: clientToEdit.senhaGov || '',
        nis: clientToEdit.nis || '',
        status: clientToEdit.status || 'Ativo',
      });

      if (clientToEdit.telefone) {
        const listaTelefones = clientToEdit.telefone
          .split(',')
          .map((telefone) => telefone.trim())
          .filter(Boolean);

        setTelefones(
          listaTelefones.length > 0
            ? listaTelefones
            : ['']
        );
      } else {
        setTelefones(['']);
      }
    } else {
      setFormData(FORM_INICIAL);
      setTelefones(['']);
    }

    setCpfError('');
    setCpfDuplicado(null);
    setClientesSemelhantes([]);
    setMostrarSemelhantes(false);
    setShowAddOrigem(false);
    setNovaOrigem('');
  }, [clientToEdit, isOpen]);

  const handleDelete = async () => {
    if (!clientToEdit?.id || !onDelete || !window.confirm('Excluir este cliente e os registros vinculados? Esta ação não pode ser desfeita.')) return;
    setExcluindo(true);
    try { await onDelete(clientToEdit.id); onClose(); }
    catch (error: any) { window.alert(error.response?.data?.error || 'Não foi possível excluir o cliente.'); }
    finally { setExcluindo(false); }
  };

  if (!isOpen) {
    return null;
  }

  /*
   * =========================================================
   * NORMALIZAÇÃO
   * =========================================================
   */

  const normalizarTexto = (texto: string): string => {
    return texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizarCPF = (cpf: string): string => {
    return cpf.replace(/\D/g, '');
  };

  /*
   * =========================================================
   * VALIDAÇÃO DO CPF
   * =========================================================
   */

  const validarCPF = (cpf: string): boolean => {
    const cpfLimpo = normalizarCPF(cpf);

    if (
      cpfLimpo.length !== 11 ||
      /^(\d)\1{10}$/.test(cpfLimpo)
    ) {
      return false;
    }

    let soma = 0;

    for (let i = 0; i < 9; i++) {
      soma +=
        Number(cpfLimpo.charAt(i)) * (10 - i);
    }

    let resto = 11 - (soma % 11);

    const digito1 =
      resto === 10 || resto === 11
        ? 0
        : resto;

    if (
      digito1 !== Number(cpfLimpo.charAt(9))
    ) {
      return false;
    }

    soma = 0;

    for (let i = 0; i < 10; i++) {
      soma +=
        Number(cpfLimpo.charAt(i)) * (11 - i);
    }

    resto = 11 - (soma % 11);

    const digito2 =
      resto === 10 || resto === 11
        ? 0
        : resto;

    return (
      digito2 === Number(cpfLimpo.charAt(10))
    );
  };

  /*
   * =========================================================
   * DISTÂNCIA DE LEVENSHTEIN
   *
   * Usada para identificar nomes muito parecidos.
   * =========================================================
   */

  const distanciaLevenshtein = (
    a: string,
    b: string
  ): number => {
    const matriz: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matriz[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matriz[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matriz[i][j] =
            matriz[i - 1][j - 1];
        } else {
          matriz[i][j] = Math.min(
            matriz[i - 1][j - 1] + 1,
            matriz[i][j - 1] + 1,
            matriz[i - 1][j] + 1
          );
        }
      }
    }

    return matriz[b.length][a.length];
  };

  /*
   * Calcula um percentual de semelhança.
   */

  const calcularSimilaridade = (
    nome1: string,
    nome2: string
  ): number => {
    const a = normalizarTexto(nome1);
    const b = normalizarTexto(nome2);

    if (!a || !b) {
      return 0;
    }

    if (a === b) {
      return 100;
    }

    const distancia = distanciaLevenshtein(a, b);
    const tamanho = Math.max(
      a.length,
      b.length
    );

    if (tamanho === 0) {
      return 100;
    }

    return Math.round(
      (1 - distancia / tamanho) * 100
    );
  };

  /*
   * =========================================================
   * BUSCAR DUPLICIDADE
   * =========================================================
   */

  const verificarDuplicidade = async (
    nome?: string,
    cpf?: string
  ) => {
    try {
      setBuscandoDuplicidade(true);

      setCpfDuplicado(null);
      setClientesSemelhantes([]);
      setMostrarSemelhantes(false);

      const response = await api.get(
        '/api/clientes'
      );

      const clientes: ClienteSemelhante[] =
        Array.isArray(response.data)
          ? response.data
          : [];

      /*
       * -----------------------------------------------------
       * 1. VERIFICA CPF
       * -----------------------------------------------------
       */

      const cpfLimpo = normalizarCPF(cpf || '');

      if (cpfLimpo) {
        const clienteComMesmoCPF =
          clientes.find((cliente) => {
            const cpfCliente = normalizarCPF(
              cliente.cpf || ''
            );

            const mesmoCliente =
              clientToEdit?.id &&
              String(cliente.id) ===
                String(clientToEdit.id);

            return (
              cpfCliente === cpfLimpo &&
              !mesmoCliente
            );
          });

        if (clienteComMesmoCPF) {
          setCpfDuplicado(clienteComMesmoCPF);
        }
      }

      /*
       * -----------------------------------------------------
       * 2. VERIFICA NOMES PARECIDOS
       * -----------------------------------------------------
       *
       * Só sugerimos quando o nome possui pelo menos
       * 5 caracteres.
       */

      const nomeAtual = normalizarTexto(
        nome || ''
      );

      if (nomeAtual.length >= 5) {
        const semelhantes = clientes
          .filter((cliente) => {
            const mesmoCliente =
              clientToEdit?.id &&
              String(cliente.id) ===
                String(clientToEdit.id);

            if (mesmoCliente) {
              return false;
            }

            if (!cliente.nome) {
              return false;
            }

            const nomeCliente =
              normalizarTexto(cliente.nome);

            if (!nomeCliente) {
              return false;
            }

            /*
             * Correspondência exata.
             */

            if (
              nomeCliente === nomeAtual
            ) {
              return true;
            }

            /*
             * Um nome contém o outro.
             */

            if (
              nomeCliente.includes(nomeAtual) ||
              nomeAtual.includes(nomeCliente)
            ) {
              return true;
            }

            /*
             * Semelhança por distância.
             */

            const similaridade =
              calcularSimilaridade(
                nomeAtual,
                nomeCliente
              );

            return similaridade >= 78;
          })
          .map((cliente) => ({
            ...cliente,
            similaridade:
              calcularSimilaridade(
                nomeAtual,
                cliente.nome || ''
              ),
          }))
          .sort(
            (a: any, b: any) =>
              (b.similaridade || 0) -
              (a.similaridade || 0)
          )
          .slice(0, 5);

        setClientesSemelhantes(
          semelhantes
        );

        if (semelhantes.length > 0) {
          setMostrarSemelhantes(true);
        }
      }
    } catch (error) {
      console.error(
        'Erro ao verificar duplicidade:',
        error
      );
    } finally {
      setBuscandoDuplicidade(false);
    }
  };

  /*
   * =========================================================
   * BLUR DO CPF
   * =========================================================
   */

  const handleCpfBlur = async () => {
    const cpfLimpo = normalizarCPF(
      formData.cpf
    );

    setCpfDuplicado(null);

    if (!cpfLimpo) {
      setCpfError('');
      return;
    }

    if (!validarCPF(cpfLimpo)) {
      setCpfError('CPF inválido.');
      return;
    }

    setCpfError('');

    await verificarDuplicidade(
      formData.nome,
      cpfLimpo
    );
  };

  /*
   * =========================================================
   * BLUR DO NOME
   * =========================================================
   */

  const handleNomeBlur = async () => {
    const nome = formData.nome.trim();

    if (nome.length < 5) {
      setClientesSemelhantes([]);
      setMostrarSemelhantes(false);
      return;
    }

    await verificarDuplicidade(
      nome,
      formData.cpf
    );
  };

  /*
   * =========================================================
   * CEP
   * =========================================================
   */

  const handleCepBlur = async () => {
    const cepLimpo = formData.cep.replace(
      /\D/g,
      ''
    );

    if (cepLimpo.length !== 8) {
      return;
    }

    setLoadingCep(true);

    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${cepLimpo}/json/`
      );

      if (!response.ok) {
        throw new Error(
          'Não foi possível consultar o CEP.'
        );
      }

      const data = await response.json();

      if (!data.erro) {
        setFormData((prev) => ({
          ...prev,
          endereco:
            data.logradouro || '',
          bairro: data.bairro || '',
          cidade:
            data.localidade || '',
          estado: data.uf || '',
        }));
      }
    } catch (error) {
      console.error(
        'Erro ao buscar CEP:',
        error
      );
    } finally {
      setLoadingCep(false);
    }
  };

  /*
   * =========================================================
   * ORIGENS
   * =========================================================
   */

  const handleAddOrigem = () => {
    const origem = novaOrigem.trim();

    if (!origem) {
      return;
    }

    if (origensList.includes(origem)) {
      setFormData((prev) => ({
        ...prev,
        origem,
      }));

      setShowAddOrigem(false);
      setNovaOrigem('');

      return;
    }

    setOrigensList((prev) => [
      ...prev,
      origem,
    ]);

    setFormData((prev) => ({
      ...prev,
      origem,
    }));

    setNovaOrigem('');
    setShowAddOrigem(false);
  };

  /*
   * =========================================================
   * TELEFONES
   * =========================================================
   */

  const handleAddPhoneField = () => {
    setTelefones((prev) => [
      ...prev,
      '',
    ]);
  };

  const handleRemovePhoneField = (
    index: number
  ) => {
    setTelefones((prev) => {
      const novosTelefones =
        prev.filter(
          (_, i) => i !== index
        );

      return novosTelefones.length > 0
        ? novosTelefones
        : [''];
    });
  };

  const handlePhoneChange = (
    index: number,
    value: string
  ) => {
    setTelefones((prev) => {
      const novosTelefones = [
        ...prev,
      ];

      novosTelefones[index] = value;

      return novosTelefones;
    });
  };

  /*
   * =========================================================
   * ENVIO DO FORMULÁRIO
   * =========================================================
   */

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const nome = formData.nome.trim();

    if (!nome) {
      alert(
        'Informe o nome do cliente.'
      );
      return;
    }

    const cpfLimpo = normalizarCPF(
      formData.cpf
    );

    /*
     * CPF informado → precisa ser válido.
     */

    if (
      cpfLimpo &&
      !validarCPF(cpfLimpo)
    ) {
      setCpfError('CPF inválido.');
      return;
    }

    /*
     * CPF já identificado como duplicado.
     */

    if (cpfDuplicado) {
      alert(
        `Cliente já cadastrado!\n\nNome: ${
          cpfDuplicado.nome || '-'
        }\nCPF: ${
          cpfDuplicado.cpf || formData.cpf
        }\n\nVerifique o cadastro existente antes de continuar.`
      );

      return;
    }

    /*
     * Faz uma última verificação antes de salvar.
     *
     * Isso evita que o usuário altere o CPF e tente
     * salvar sem passar pelo blur.
     */

    setSalvando(true);

    try {
      const verificacao = await api.get(
        '/api/clientes'
      );

      const clientes: ClienteSemelhante[] =
        Array.isArray(
          verificacao.data
        )
          ? verificacao.data
          : [];

      /*
       * -----------------------------------------------------
       * VERIFICAÇÃO FINAL DO CPF
       * -----------------------------------------------------
       */

      if (cpfLimpo) {
        const duplicado =
          clientes.find((cliente) => {
            const cpfCliente =
              normalizarCPF(
                cliente.cpf || ''
              );

            const mesmoCliente =
              clientToEdit?.id &&
              String(cliente.id) ===
                String(clientToEdit.id);

            return (
              cpfCliente === cpfLimpo &&
              !mesmoCliente
            );
          });

        if (duplicado) {
          setCpfDuplicado(
            duplicado
          );

          alert(
            `Cliente já cadastrado!\n\nNome: ${
              duplicado.nome || '-'
            }\nCPF: ${
              duplicado.cpf || formData.cpf
            }`
          );

          setSalvando(false);
          return;
        }
      }

      /*
       * -----------------------------------------------------
       * NOME SEM CPF
       * -----------------------------------------------------
       *
       * Se não houver CPF, mostramos uma confirmação
       * quando encontrarmos nomes muito semelhantes.
       */

      if (
        !cpfLimpo &&
        clientesSemelhantes.length > 0
      ) {
        const nomes = clientesSemelhantes
          .map(
            (cliente) =>
              `• ${cliente.nome || '-'}${
                cliente.cpf
                  ? ` — CPF: ${cliente.cpf}`
                  : ''
              }`
          )
          .join('\n');

        const continuar = window.confirm(
          `Encontramos clientes com nome semelhante:\n\n${nomes}\n\n` +
            `Você está tentando cadastrar "${nome}".\n\n` +
            `Verifique se não se trata de um cliente já cadastrado.\n\n` +
            `Deseja continuar mesmo assim?`
        );

        if (!continuar) {
          setSalvando(false);
          return;
        }
      }

      /*
       * -----------------------------------------------------
       * TELEFONES
       * -----------------------------------------------------
       */

      const telefonesFormatados =
        telefones
          .map((telefone) =>
            telefone.trim()
          )
          .filter(Boolean)
          .join(', ');

      const payload = {
        ...formData,
        cpf: cpfLimpo,
        telefone:
          telefonesFormatados,
      };

      /*
       * -----------------------------------------------------
       * SALVAR
       * -----------------------------------------------------
       */

      if (clientToEdit?.id) {
        await api.put(
          `/api/clientes/${clientToEdit.id}`,
          payload
        );
      } else {
        await api.post(
          '/api/clientes',
          payload
        );
      }

      if (onSave) {
        onSave(payload);
      }

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (error: any) {
      console.error(
        'Erro ao salvar cliente:',
        error
      );

      /*
       * Se o backend devolver 409, trata como
       * duplicidade de CPF.
       */

      if (
        error?.response?.status === 409
      ) {
        const cliente =
          error?.response?.data?.cliente;

        setCpfDuplicado(
          cliente || {
            nome:
              error?.response?.data
                ?.nome ||
              'Cliente já cadastrado',
            cpf: formData.cpf,
          }
        );

        alert(
          error?.response?.data
            ?.message ||
            'Cliente já cadastrado com este CPF.'
        );

        return;
      }

      const mensagemErro =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Erro desconhecido';

      alert(
        `Erro ao salvar cliente: ${mensagemErro}`
      );
    } finally {
      setSalvando(false);
    }
  };

  /*
   * =========================================================
   * INTERFACE
   * =========================================================
   */

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden border border-slate-100 my-8">

        {/* CABEÇALHO */}

        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-800">
              {clientToEdit
                ? 'Editar Cliente'
                : 'Novo Cliente'}
            </h3>

            <p className="text-xs text-slate-500">
              Preencha todas as informações do cliente
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* FORMULÁRIO */}

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-5 max-h-[75vh] overflow-y-auto"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

            {/* NOME */}

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Nome do Cliente *
              </label>

              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    nome: e.target.value,
                  });

                  setClientesSemelhantes(
                    []
                  );

                  setMostrarSemelhantes(
                    false
                  );
                }}
                onBlur={handleNomeBlur}
                placeholder="Nome completo"
                className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition ${
                  clientesSemelhantes.length >
                  0
                    ? 'border-amber-400'
                    : 'border-slate-200'
                }`}
              />

              {/* AVISO DE NOMES SEMELHANTES */}

              {mostrarSemelhantes &&
                clientesSemelhantes.length >
                  0 && (
                  <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle
                        size={17}
                        className="text-amber-600 mt-0.5 shrink-0"
                      />

                      <div className="flex-1">
                        <p className="text-xs font-bold text-amber-800">
                          Atenção: encontramos
                          clientes com nome
                          semelhante
                        </p>

                        <p className="text-xs text-amber-700 mt-1">
                          Verifique se o cliente
                          já possui cadastro antes
                          de continuar.
                        </p>

                        <div className="mt-2 space-y-1.5">
                          {clientesSemelhantes.map(
                            (
                              cliente,
                              index
                            ) => (
                              <div
                                key={
                                  cliente.id ||
                                  index
                                }
                                className="bg-white border border-amber-100 rounded-lg px-3 py-2"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-xs font-semibold text-slate-800">
                                      {cliente.nome ||
                                        '-'}
                                    </p>

                                    <p className="text-[11px] text-slate-500">
                                      {cliente.cpf
                                        ? `CPF: ${cliente.cpf}`
                                        : 'CPF não informado'}

                                      {cliente.dataNascimento
                                        ? ` • Nascimento: ${cliente.dataNascimento}`
                                        : ''}
                                    </p>
                                  </div>

                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full whitespace-nowrap">
                                    Possível
                                    duplicidade
                                  </span>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {buscandoDuplicidade && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-blue-600">
                  <Loader2
                    size={12}
                    className="animate-spin"
                  />
                  Verificando cadastro...
                </div>
              )}
            </div>

            {/* CPF */}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                CPF
              </label>

              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    cpf: e.target.value,
                  });

                  setCpfError('');
                  setCpfDuplicado(null);
                }}
                onBlur={handleCpfBlur}
                placeholder="000.000.000-00"
                maxLength={14}
                className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition ${
                  cpfError ||
                  cpfDuplicado
                    ? 'border-red-500'
                    : 'border-slate-200'
                }`}
              />

              {cpfError && (
                <span className="text-xs text-red-500 mt-1 block">
                  {cpfError}
                </span>
              )}

              {/* CPF DUPLICADO */}

              {cpfDuplicado && (
                <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      size={16}
                      className="text-red-600 mt-0.5 shrink-0"
                    />

                    <div>
                      <p className="text-xs font-bold text-red-800">
                        Cliente já cadastrado
                      </p>

                      <p className="text-xs text-red-700 mt-1">
                        Este CPF já pertence ao
                        cliente:
                      </p>

                      <p className="text-sm font-bold text-red-900 mt-1">
                        {cpfDuplicado.nome ||
                          '-'}
                      </p>

                      {cpfDuplicado.cpf && (
                        <p className="text-[11px] text-red-700 mt-0.5">
                          CPF: {
                            cpfDuplicado.cpf
                          }
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* RG */}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                RG
              </label>

              <input
                type="text"
                value={formData.rg}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    rg: e.target.value,
                  })
                }
                placeholder="Número do RG"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            {/* DATA NASCIMENTO */}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Data de Nascimento
              </label>

              <input
                type="date"
                value={formData.dataNascimento}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dataNascimento:
                      e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition text-slate-700"
              />
            </div>

            {/* NOME DA MÃE */}

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Nome da Mãe
              </label>

              <input
                type="text"
                value={formData.nomeMae}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    nomeMae: e.target.value,
                  })
                }
                placeholder="Nome completo da mãe"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            {/* GÊNERO */}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Gênero
              </label>

              <select
                value={formData.genero}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    genero: e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition text-slate-700"
              >
                <option value="">
                  Selecione...
                </option>
                <option value="Masculino">
                  Masculino
                </option>
                <option value="Feminino">
                  Feminino
                </option>
                <option value="Outro">
                  Outro
                </option>
              </select>
            </div>

            {/* NACIONALIDADE */}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Nacionalidade
              </label>

              <input
                type="text"
                value={
                  formData.nacionalidade
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    nacionalidade:
                      e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            {/* ESTADO CIVIL */}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Estado Civil
              </label>

              <select
                value={
                  formData.estadoCivil
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    estadoCivil:
                      e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition text-slate-700"
              >
                <option value="">
                  Selecione...
                </option>
                <option value="Solteiro(a)">
                  Solteiro(a)
                </option>
                <option value="Casado(a)">
                  Casado(a)
                </option>
                <option value="Divorciado(a)">
                  Divorciado(a)
                </option>
                <option value="Viúvo(a)">
                  Viúvo(a)
                </option>
                <option value="União Estável">
                  União Estável
                </option>
              </select>
            </div>

            {/* PROFISSÃO */}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Profissão
              </label>

              <input
                type="text"
                value={formData.profissao}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    profissao:
                      e.target.value,
                  })
                }
                placeholder="Ex: Agricultor"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            {/* EMAIL */}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                E-mail
              </label>

              <input
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    email: e.target.value,
                  })
                }
                placeholder="email@exemplo.com"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            {/* ORIGEM */}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase">
                  Origem
                </label>

                {!showAddOrigem && (
                  <button
                    type="button"
                    onClick={() =>
                      setShowAddOrigem(
                        true
                      )
                    }
                    className="text-xs text-blue-600 font-semibold hover:underline"
                  >
                    + Nova origem
                  </button>
                )}
              </div>

              {!showAddOrigem ? (
                <select
                  value={
                    formData.origem
                  }
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      origem:
                        e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition text-slate-700"
                >
                  <option value="">
                    Selecione a origem...
                  </option>

                  {origensList.map(
                    (origem) => (
                      <option
                        key={origem}
                        value={origem}
                      >
                        {origem}
                      </option>
                    )
                  )}
                </select>
              ) : (
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={
                      novaOrigem
                    }
                    onChange={(e) =>
                      setNovaOrigem(
                        e.target.value
                      )
                    }
                    placeholder="Nome..."
                    className="flex-1 px-3 py-2 text-sm bg-slate-50 border border-blue-400 rounded-xl focus:outline-none"
                  />

                  <button
                    type="button"
                    onClick={
                      handleAddOrigem
                    }
                    className="px-3 bg-blue-600 text-white rounded-xl text-xs font-semibold"
                  >
                    Ok
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowAddOrigem(
                        false
                      );
                      setNovaOrigem('');
                    }}
                    className="px-2 bg-slate-200 rounded-xl text-xs font-semibold"
                  >
                    X
                  </button>
                </div>
              )}
            </div>

            {/* CEP */}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-500 uppercase">
                  CEP
                </label>

                {loadingCep && (
                  <span className="text-xs text-blue-600 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Buscando...
                  </span>
                )}
              </div>

              <input
                type="text"
                value={formData.cep}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cep: e.target.value,
                  })
                }
                onBlur={handleCepBlur}
                maxLength={9}
                placeholder="00000-000"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            {/* ENDEREÇO */}

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Endereço
              </label>

              <input
                type="text"
                value={
                  formData.endereco
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    endereco:
                      e.target.value,
                  })
                }
                placeholder="Rua, número, complemento"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            {/* BAIRRO */}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Bairro
              </label>

              <input
                type="text"
                value={formData.bairro}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    bairro:
                      e.target.value,
                  })
                }
                placeholder="Nome do bairro"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            {/* CIDADE */}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Cidade
              </label>

              <input
                type="text"
                value={formData.cidade}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cidade:
                      e.target.value,
                  })
                }
                placeholder="Nome da cidade"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            {/* ESTADO */}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Estado
              </label>

              <input
                type="text"
                value={formData.estado}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    estado:
                      e.target.value.toUpperCase(),
                  })
                }
                maxLength={2}
                placeholder="UF"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition uppercase"
              />
            </div>

            {/* REPRESENTANTE */}

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Nome do Representante
              </label>

              <input
                type="text"
                value={
                  formData.nomeRepresentante
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    nomeRepresentante:
                      e.target.value,
                  })
                }
                placeholder="Se houver"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            {/* CPF REPRESENTANTE */}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                CPF do Representante
              </label>

              <input
                type="text"
                value={
                  formData.cpfRepresentante
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    cpfRepresentante:
                      e.target.value,
                  })
                }
                placeholder="000.000.000-00"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            {/* SENHA GOV */}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Senha GOV.BR
              </label>

              <input
                type="text"
                value={formData.senhaGov}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    senhaGov:
                      e.target.value,
                  })
                }
                placeholder="Senha"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            {/* NIS */}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                NIS / PIS / PASEP
              </label>

              <input
                type="text"
                value={formData.nis}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    nis: e.target.value,
                  })
                }
                placeholder="Número do NIS"
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
              />
            </div>

            {/* STATUS */}

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">
                Status
              </label>

              <select
                value={
                  formData.status
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status:
                      e.target.value,
                  })
                }
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition text-slate-700"
              >
                <option value="Ativo">
                  Ativo
                </option>

                <option value="Em Prospecção">
                  Em Prospecção
                </option>

                <option value="Arquivado">
                  Arquivado
                </option>

                <option value="Descartado">
                  Descartado
                </option>

                <option value="Sem Processo">
                  Sem Processo
                </option>
              </select>
            </div>
          </div>

          {/* TELEFONES */}

          <div className="border-t border-slate-100 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-xs font-semibold text-slate-500 uppercase">
                Telefones de Contato
              </label>

              <button
                type="button"
                onClick={
                  handleAddPhoneField
                }
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition"
              >
                <Plus size={14} />
                Adicionar outro telefone
              </button>
            </div>

            <div className="space-y-2.5 max-h-36 overflow-y-auto pr-1">
              {telefones.map(
                (
                  telefone,
                  index
                ) => (
                  <div
                    key={index}
                    className="flex items-center gap-2"
                  >
                    <div className="relative flex-1">
                      <Phone
                        className="absolute left-3.5 top-3 text-slate-400"
                        size={15}
                      />

                      <input
                        type="text"
                        value={
                          telefone
                        }
                        onChange={(e) =>
                          handlePhoneChange(
                            index,
                            e.target.value
                          )
                        }
                        placeholder={`Telefone ${
                          index + 1
                        } (Ex: (85) 99999-9999)`}
                        className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white transition"
                      />
                    </div>

                    {telefones.length >
                      1 && (
                      <button
                        type="button"
                        onClick={() =>
                          handleRemovePhoneField(
                            index
                          )
                        }
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition"
                        title="Remover telefone"
                      >
                        <Trash2
                          size={16}
                        />
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
          </div>

          {/* AÇÕES */}

          <div className="border-t border-slate-100 pt-4 flex items-center justify-end gap-3 sticky bottom-0 bg-white py-2">
            {clientToEdit?.id && onNewProcess && (
              <button
                type="button"
                onClick={() => onNewProcess(clientToEdit.id!)}
                className="px-4 py-2 text-sm font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition"
              >
                Cadastrar processo
              </button>
            )}
            {clientToEdit?.id && canDelete && onDelete && <button type="button" onClick={() => void handleDelete()} disabled={salvando || excluindo} className="px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition disabled:opacity-50">{excluindo ? 'Excluindo...' : 'Excluir cliente'}</button>}
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={
                salvando ||
                !!cpfDuplicado
              }
              className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl shadow-md shadow-blue-600/20 transition flex items-center gap-1.5"
            >
              {salvando ? (
                <>
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle2
                    size={16}
                  />

                  {clientToEdit
                    ? 'Atualizar Cadastro'
                    : 'Salvar Cadastro'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
