// 1. IMPORTAÇÕES E CONFIGURAÇÕES INICIAIS
  import dotenv from 'dotenv';
  dotenv.config();
  import express from 'express';
  import cors from 'cors';
  import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { createOperationsRouter } from './modules/operations/operations.routes';

// 2. VARIÁVEIS DE AMBIENTE
// Define a porta do servidor e a chave secreta usada para assinar os tokens JWT.
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreto_alterar_em_producao';

// O SDK do Supabase recebe a URL-raiz do projeto e acrescenta /rest/v1 internamente.
// Aceita também instalações antigas que tenham salvo a URL da API completa no .env.
const SUPABASE_URL = (process.env.SUPABASE_URL || '')
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/$/, '');
// A API é o único acesso ao banco. A service role fica somente no .env do backend
// e permite que a autenticação JWT própria da Plataforma HB controle as rotas.
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

// Validação simples para garantir que a URL do Supabase está correta antes de iniciar.
if (!SUPABASE_URL.startsWith('http')) {
  throw new Error('A variável SUPABASE_URL não foi definida corretamente no arquivo .env');
}

// 3. INICIALIZAÇÃO DE SERVIÇOS
// Cria a conexão (cliente) com o banco de dados Supabase.
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Inicializa o aplicativo Express.
const app = express();

// 4. CONFIGURAÇÃO DE MIDDLEWARES GLOBAIS
// CORREÇÃO APLICADA AQUI: Uso correto do pacote 'cors' para evitar o aninhamento de rotas
// e garantir a segurança e permissão de acesso do frontend (Vite).
const corsOptions = {
  origin: (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => {
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) return callback(null, true);
    callback(new Error('Origem não permitida pelo CORS'));
  },
  credentials: true, // Permite envio de cookies/tokens
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Permite que o Express entenda requisições com o corpo (body) no formato JSON.
app.use(express.json());
app.use('/api/operacional', createOperationsRouter(supabase));

// 5. MIDDLEWARE DE AUTENTICAÇÃO
// Função que intercepta as rotas protegidas para verificar se o usuário enviou um Token JWT válido.
const authenticateToken = (
  req: express.Request, 
  res: express.Response, 
  next: express.NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  // O token geralmente vem no formato "Bearer <token>". O split pega apenas o token.
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    return;
  }

  try {
    // Verifica a validade e a assinatura do token usando a chave secreta.
    const payload = jwt.verify(token, JWT_SECRET);
    // Insere os dados decodificados do usuário na requisição para uso posterior nas rotas.
    (req as any).user = payload;
    // Passa o controle para a próxima função/rota.
    next();
  } catch (err) {
    res.status(403).json({ error: 'Token inválido ou expirado.' });
    return;
  }
};

// 6. ROTAS GERAIS E DE VERIFICAÇÃO

// --- HEALTH CHECK ---
// Rota simples para verificar se a API está online e conseguindo se comunicar com o Supabase.
app.get('/health', async (req, res) => {
  try {
    const { error } = await supabase.from('clientes').select('id').limit(1);
    if (error) throw error;

    res.json({
      status: 'OK',
      message: 'Plataforma HB Backend rodando e conectado ao Supabase com sucesso!',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ status: 'ERROR', message: 'Falha na conexão com o Supabase', error: error?.message || error });
  }
});

// --- TESTE DE BANCO DE DADOS ---
// Rota para testar a busca completa de usuários (apenas para fins de teste/debug).
app.get('/api/test-db', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) {
      return res.status(500).json({ status: 'ERRO DO SUPABASE', detalhes: error });
    }
    return res.json({ 
      status: 'CONEXÃO BEM-SUCEDIDA!', 
      totalUsuarios: data.length, 
      usuariosEncontrados: data 
    });
  } catch (err: any) {
    return res.status(500).json({ status: 'EXCEÇÃO NO NODE', erro: err.message });
  }
});

// 7. ROTAS DE AUTENTICAÇÃO

// --- LOGIN ---
// Verifica as credenciais e gera um token JWT de acesso.
app.post('/api/auth/login', async (req, res) => {
  // Pega diferentes possíveis chaves que o frontend pode enviar contendo o email/usuário.
  let rawEmail = (req.body.email || req.body.useremail || req.body.username || req.body.user || '').trim();
  const { password } = req.body;

  // Adiciona o domínio do escritório automaticamente caso o usuário digite apenas o nome (ex: "maicondouglas").
  if (rawEmail && !rawEmail.includes('@')) {
    rawEmail = `${rawEmail}@hbadvocacia.adv.br`;
  }

  if (!rawEmail || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    // Busca o usuário no banco de dados.
    const { data: userList, error } = await supabase
      .from('users')
      .select('*')
      .ilike('useremail', rawEmail)
      .limit(1);

    if (error || !userList || userList.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const user = userList[0];

    // Verifica se a senha armazenada usa criptografia Bcrypt (começa com $2).
    // Se usar, compara a criptografia; se não, compara como texto puro.
    const isBcrypt = user.userpass && user.userpass.startsWith('$2');
    const passwordMatch = isBcrypt 
      ? await bcrypt.compare(password, user.userpass) 
      : password === user.userpass;

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Cria o token JWT com duração de 1 dia, incluindo informações úteis do usuário no payload.
    const token = jwt.sign(
      { 
        id: user.userid, 
        name: user.username, 
        email: user.useremail, 
        sectorId: user.sectorid,
        roleId: user.roleid 
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Retorna o token e os dados para o frontend salvar na sessão.
    return res.json({
      token,
      user: {
        id: user.userid,
        name: user.username,
        email: user.useremail,
        sectorId: user.sectorid,
        roleId: user.roleid,
      },
    });
  } catch (error: any) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro interno no servidor ao realizar login.', details: error.message });
  }
});

// --- ROTA "ME" ---
// Retorna os dados do usuário atualmente autenticado a partir do token (validação com authenticateToken).
app.get('/api/auth/me', authenticateToken, (req: any, res) => {
  res.json({ user: req.user });
});

// 8. ROTAS PROTEGIDAS PELO TOKEN (Usuários e Clientes)

// --- USUÁRIOS ---
// Busca todos os usuários do sistema. Requer estar autenticado.
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const [usersResult, profilesResult] = await Promise.all([
      supabase.from('users').select('userid, username, useremail, sectorid, roleid'),
      supabase.from('usuario_perfis').select('user_id, nome, email, ativo'),
    ]);
    const error = usersResult.error || profilesResult.error;
    const profilesByUserId = new Map((profilesResult.data || []).map((profile: any) => [String(profile.user_id), profile]));
    const allUsers = (usersResult.data || []).map((user: any) => {
      const profile: any = profilesByUserId.get(String(user.userid));
      return { ...user, name: profile?.nome || user.username, username: profile?.nome || user.username, email: profile?.email || user.useremail, ativo: profile?.ativo !== false };
    });

    if (error) throw error;
    res.json(allUsers);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar usuários.', details: error.message });
  }
});

// --- MÓDULO DE CLIENTES ---

// Listar todos os clientes
app.get('/api/clientes', authenticateToken, async (req, res) => {
  try {
    const pageSize = 1000;
    const listaClientes: any[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase.from('clientes').select('*').order('nome', { ascending: true }).range(from, from + pageSize - 1);
      if (error) throw error;
      listaClientes.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    const processos: any[] = [];
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase.from('processos').select('cliente_id').range(from, from + pageSize - 1);
      if (error) throw error;
      processos.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    const clientesComProcesso = new Set(processos.map((processo) => String(processo.cliente_id)));
    return res.json(listaClientes.map((cliente) => ({ ...cliente, hasProcess: clientesComProcesso.has(String(cliente.id)) })));
  } catch (error: any) {
    console.error('Erro ao buscar clientes:', error);
    return res.status(500).json({ error: 'Erro ao buscar clientes.', details: error.message });
  }
});

// Criar novo cliente
app.post('/api/clientes', authenticateToken, async (req, res) => {
  try {
    const { data: novoCliente, error } = await supabase
      .from('clientes')
      .insert([req.body])
      .select();

    if (error) throw error;
    return res.status(201).json(novoCliente[0]);
  } catch (error: any) {
    console.error('Erro ao cadastrar cliente:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar cliente.', details: error.message });
  }
});

// Buscar detalhes de um cliente específico pelo ID, trazendo também seus campos customizados.
app.get('/api/clientes/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;

    // Busca o cliente base.
    const { data: listaClientes, error: clientError } = await supabase
      .from('clientes')
      .select('*')
      .eq('id', id)
      .limit(1);

    if (clientError || !listaClientes || listaClientes.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    // Busca os valores customizados atrelados a este cliente (tabela auxiliar).
    const { data: valoresCustomizados } = await supabase
      .from('clientCustomValues')
      .select(`
        fieldId,
        value,
        clientCustomFields (
          label,
          fieldName
        )
      `)
      .eq('clientId', String(id));

    return res.json({
      ...listaClientes[0],
      camposCustomizados: valoresCustomizados || [],
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao buscar detalhes do cliente.', details: error?.message });
  }
});

/*
 * ---------------------------------------------------------
 * FUNÇÕES AUXILIARES
 * ---------------------------------------------------------
 */

// Remove tudo que não for número do CPF.
const normalizarCPF = (cpf: any): string => {
  return String(cpf || '').replace(/\D/g, '');
};

// Normaliza nome para comparação.
const normalizarNome = (nome: any): string => {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Divide o nome em palavras.
const palavrasNome = (nome: string): string[] => {
  return normalizarNome(nome)
    .split(' ')
    .filter((palavra) => palavra.length >= 2);
};

// Calcula similaridade baseada em palavras + sequência.
const calcularSimilaridadeNome = (
  nomeA: string,
  nomeB: string
): number => {
  const a = normalizarNome(nomeA);
  const b = normalizarNome(nomeB);

  if (!a || !b) return 0;

  if (a === b) return 100;

  const palavrasA = palavrasNome(a);
  const palavrasB = palavrasNome(b);

  if (!palavrasA.length || !palavrasB.length) {
    return 0;
  }

  const conjuntoB = new Set(palavrasB);

  const palavrasIguais = palavrasA.filter((palavra) =>
    conjuntoB.has(palavra)
  ).length;

  const coberturaA =
    palavrasIguais / palavrasA.length;

  const coberturaB =
    palavrasIguais / palavrasB.length;

  const coberturaMedia =
    ((coberturaA + coberturaB) / 2) * 100;

  // Similaridade de sequência simples.
  const menor = Math.min(a.length, b.length);
  const maior = Math.max(a.length, b.length);

  let caracteresIguais = 0;

  for (let i = 0; i < menor; i++) {
    if (a[i] === b[i]) {
      caracteresIguais++;
    }
  }

  const similaridadeSequencia =
    maior > 0
      ? (caracteresIguais / maior) * 100
      : 0;

  return Math.round(
    coberturaMedia * 0.75 +
    similaridadeSequencia * 0.25
  );
};

/*
 * ---------------------------------------------------------
 * VERIFICAR POSSÍVEIS DUPLICIDADES
 * ---------------------------------------------------------
 */

app.post(
  '/api/clientes/verificar-duplicidade',
  authenticateToken,
  async (req, res) => {
    try {
      const {
        cpf,
        nome,
        id,
      } = req.body;

      const cpfNormalizado = normalizarCPF(cpf);
      const nomeNormalizado = normalizarNome(nome);

      /*
       * 1. VERIFICAÇÃO DE CPF
       */

      if (cpfNormalizado) {
        let query = supabase
          .from('clientes')
          .select('*')
          .eq('cpf', cpfNormalizado)
          .limit(1);

        const { data: clienteCPF, error: cpfError } =
          await query;

        if (cpfError) {
          throw cpfError;
        }

        const clienteExistente =
          clienteCPF?.find(
            (cliente: any) =>
              String(cliente.id) !== String(id || '')
          );

        if (clienteExistente) {
          return res.status(409).json({
            tipo: 'CPF_DUPLICADO',
            message: 'Cliente já cadastrado.',
            cliente: {
              id: clienteExistente.id,
              nome: clienteExistente.nome,
              cpf: clienteExistente.cpf,
              telefone: clienteExistente.telefone,
              cidade: clienteExistente.cidade,
              status: clienteExistente.status,
            },
          });
        }
      }

      /*
       * 2. SE NÃO TEM CPF, PROCURA NOMES SEMELHANTES
       */

      if (!cpfNormalizado && nomeNormalizado) {
        const { data: clientes, error } =
          await supabase
            .from('clientes')
            .select(
              'id, nome, cpf, telefone, cidade, status'
            );

        if (error) {
          throw error;
        }

        const possiveisDuplicados = (clientes || [])
          .filter(
            (cliente: any) =>
              String(cliente.id) !== String(id || '') &&
              cliente.nome
          )
          .map((cliente: any) => ({
            ...cliente,
            similaridade: calcularSimilaridadeNome(
              nome,
              cliente.nome
            ),
          }))
          .filter(
            (cliente: any) =>
              cliente.similaridade >= 70
          )
          .sort(
            (a: any, b: any) =>
              b.similaridade - a.similaridade
          )
          .slice(0, 5);

        return res.json({
          tipo: 'NOME_SEMELHANTE',
          possiveisDuplicados,
        });
      }

      return res.json({
        tipo: 'OK',
        possiveisDuplicados: [],
      });

    } catch (error: any) {
      console.error(
        'Erro ao verificar duplicidade:',
        error
      );

      return res.status(500).json({
        error: 'Erro ao verificar duplicidade.',
        details: error?.message,
      });
    }
  }
);

/*
 * ---------------------------------------------------------
 * LISTAR CLIENTES
 * ---------------------------------------------------------
 */

app.get(
  '/api/clientes',
  authenticateToken,
  async (req, res) => {
    try {
      const {
        data: listaClientes,
        error,
      } = await supabase
        .from('clientes')
        .select('*')
        .order('nome', {
          ascending: true,
        });

      if (error) throw error;

      return res.json(listaClientes);
    } catch (error: any) {
      console.error(
        'Erro ao buscar clientes:',
        error
      );

      return res.status(500).json({
        error: 'Erro ao buscar clientes.',
        details: error.message,
      });
    }
  }
);

/*
 * ---------------------------------------------------------
 * CRIAR CLIENTE
 * ---------------------------------------------------------
 */

app.post(
  '/api/clientes',
  authenticateToken,
  async (req, res) => {
    try {
      const dadosCliente = {
        ...req.body,
        cpf: normalizarCPF(req.body.cpf),
      };

      /*
       * CPF vazio deve ser NULL.
       * Isso permite vários clientes sem CPF.
       */
      if (!dadosCliente.cpf) {
        dadosCliente.cpf = null;
      }

      /*
       * VERIFICAÇÃO ANTES DO INSERT
       */

      if (dadosCliente.cpf) {
        const {
          data: clienteExistente,
          error: buscaError,
        } = await supabase
          .from('clientes')
          .select(
            'id, nome, cpf, telefone, cidade, status'
          )
          .eq('cpf', dadosCliente.cpf)
          .limit(1);

        if (buscaError) {
          throw buscaError;
        }

        if (
          clienteExistente &&
          clienteExistente.length > 0
        ) {
          return res.status(409).json({
            tipo: 'CPF_DUPLICADO',
            message: 'Cliente já cadastrado.',
            cliente: clienteExistente[0],
          });
        }
      }

      /*
       * INSERT
       */

      const {
        data: novoCliente,
        error,
      } = await supabase
        .from('clientes')
        .insert([dadosCliente])
        .select();

      if (error) {

        /*
         * Proteção adicional contra corrida
         * entre dois cadastros simultâneos.
         */

        if (
          error.code === '23505' ||
          error.message
            ?.toLowerCase()
            .includes('duplicate')
        ) {
          const {
            data: clienteExistente,
          } = await supabase
            .from('clientes')
            .select(
              'id, nome, cpf, telefone, cidade, status'
            )
            .eq('cpf', dadosCliente.cpf)
            .limit(1);

          return res.status(409).json({
            tipo: 'CPF_DUPLICADO',
            message: 'Cliente já cadastrado.',
            cliente:
              clienteExistente?.[0] || null,
          });
        }

        throw error;
      }

      return res.status(201).json(
        novoCliente?.[0]
      );

    } catch (error: any) {
      console.error(
        'Erro ao cadastrar cliente:',
        error
      );

      return res.status(500).json({
        error: 'Erro ao cadastrar cliente.',
        details: error.message,
      });
    }
  }
);

/*
 * ---------------------------------------------------------
 * BUSCAR CLIENTE POR ID
 * ---------------------------------------------------------
 */

app.get(
  '/api/clientes/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const id = req.params.id;

      const {
        data: listaClientes,
        error: clientError,
      } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', id)
        .limit(1);

      if (
        clientError ||
        !listaClientes ||
        listaClientes.length === 0
      ) {
        return res.status(404).json({
          error: 'Cliente não encontrado.',
        });
      }

      const {
        data: valoresCustomizados,
      } = await supabase
        .from('clientCustomValues')
        .select(`
          fieldId,
          value,
          clientCustomFields (
            label,
            fieldName
          )
        `)
        .eq('clientId', String(id));

      return res.json({
        ...listaClientes[0],
        camposCustomizados:
          valoresCustomizados || [],
      });

    } catch (error: any) {
      return res.status(500).json({
        error:
          'Erro ao buscar detalhes do cliente.',
        details: error?.message,
      });
    }
  }
);

/*
 * ---------------------------------------------------------
 * ATUALIZAR CLIENTE
 * ---------------------------------------------------------
 */

app.put(
  '/api/clientes/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const id = req.params.id;

      const dadosAtualizados = {
        ...req.body,
        cpf: normalizarCPF(req.body.cpf),
      };

      delete dadosAtualizados.id;
      delete dadosAtualizados._id;

      if (!dadosAtualizados.cpf) {
        dadosAtualizados.cpf = null;
      }

      /*
       * Verifica se o CPF pertence a OUTRO cliente.
       */

      if (dadosAtualizados.cpf) {
        const {
          data: clienteCPF,
          error: cpfError,
        } = await supabase
          .from('clientes')
          .select(
            'id, nome, cpf, telefone, cidade, status'
          )
          .eq('cpf', dadosAtualizados.cpf)
          .neq('id', id)
          .limit(1);

        if (cpfError) {
          throw cpfError;
        }

        if (
          clienteCPF &&
          clienteCPF.length > 0
        ) {
          return res.status(409).json({
            tipo: 'CPF_DUPLICADO',
            message:
              'Este CPF já está cadastrado em outro cliente.',
            cliente: clienteCPF[0],
          });
        }
      }

      const {
        data: clienteAtualizado,
        error,
      } = await supabase
        .from('clientes')
        .update(dadosAtualizados)
        .eq('id', id)
        .select();

      if (error) {

        if (
          error.code === '23505' ||
          error.message
            ?.toLowerCase()
            .includes('duplicate')
        ) {
          return res.status(409).json({
            tipo: 'CPF_DUPLICADO',
            message:
              'Este CPF já está cadastrado em outro cliente.',
          });
        }

        throw error;
      }

      if (
        !clienteAtualizado ||
        clienteAtualizado.length === 0
      ) {
        return res.status(404).json({
          error:
            'Cliente não encontrado para atualização.',
        });
      }

      return res.json({
        message:
          'Cliente atualizado com sucesso!',
        client: clienteAtualizado[0],
      });

    } catch (error: any) {
      console.error(
        'Erro ao atualizar cliente:',
        error
      );

      return res.status(500).json({
        error:
          'Erro ao atualizar cliente.',
        details: error.message,
      });
    }
  }
);

// Excluir um cliente - permitido apenas para administrador e programador.
app.delete('/api/clientes/:id', authenticateToken, async (req: any, res) => {
  try {
    const role = String(req.user?.roleId || '').toLowerCase();
    let permitted = ['admin', 'administrador', 'programador', 'programmer', 'developer', '1', '2', '3'].includes(role);
    if (!permitted && req.user?.id) {
      const { data: profile } = await supabase.from('usuario_perfis').select('tipo_acesso').eq('user_id', req.user.id).maybeSingle();
      permitted = ['administrador', 'programador'].includes(String(profile?.tipo_acesso || '').toLowerCase());
    }
    if (!permitted) return res.status(403).json({ error: 'Apenas administradores e programadores podem excluir clientes.' });
    const clientId = req.params.id;
    await supabase.from('processos').update({ atendimento_id: null }).eq('cliente_id', clientId);
    await supabase.from('tarefas').delete().eq('cliente_id', clientId);
    await supabase.from('atendimentos').delete().eq('cliente_id', clientId);
    await supabase.from('processos').delete().eq('cliente_id', clientId);
    const { error } = await supabase.from('clientes').delete().eq('id', clientId);
    if (error) throw error;
    return res.json({ message: 'Cliente excluído com sucesso.' });
  } catch (error: any) {
    return res.status(500).json({ error: 'Não foi possível excluir o cliente.', details: error.message });
  }
});

// Atualizar um cliente específico
app.put('/api/clientes/:id', authenticateToken, async (req, res) => {
  try {
    const id = req.params.id;
    const dadosAtualizados = { ...req.body };

    // Evita a atualização de chaves primárias ou campos protegidos.
    delete dadosAtualizados.id;
    delete dadosAtualizados._id;

    const { data: clienteAtualizado, error } = await supabase
      .from('clientes')
      .update(dadosAtualizados)
      .eq('id', id)
      .select();

    if (error || !clienteAtualizado || clienteAtualizado.length === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado para atualização.' });
    }

    return res.json({
      message: "Cliente atualizado com sucesso!",
      client: clienteAtualizado[0]
    });
  } catch (error: any) {
    console.error('Erro ao atualizar cliente:', error);
    return res.status(500).json({ error: 'Erro ao atualizar cliente.', details: error.message });
  }
});

// 9. INICIALIZAÇÃO DO SERVIDOR
// Faz com que o Express comece a escutar requisições na porta definida.
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando com sucesso em http://localhost:${PORT}`);
});
