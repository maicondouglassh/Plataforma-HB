import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { eq, sql } from 'drizzle-orm';

import { db } from './core/database';
import { 
  users, 
  clientes, 
  clientCustomFields, 
  clientCustomValues 
} from './core/database/schema';
import { AuthenticatedRequest } from './core/auth/auth.middleware';
import { checkPermission } from './core/permissions/permission.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secreto_alterar_em_producao';

app.use(cors());
app.use(express.json());

// Middleware de Autenticação Local
const authenticateToken = (
  req: express.Request, 
  res: express.Response, 
  next: express.NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    (req as any).user = payload;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Token inválido ou expirado.' });
    return;
  }
};

// --- HEALTH CHECK ---
app.get('/health', (req, res) => {
  try {
    db.run(sql`SELECT 1`);
    res.json({
      status: 'OK',
      message: 'Plataforma HB Backend rodando e conectado ao SQLite!',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ status: 'ERROR', message: 'Falha na conexão com o banco', error: error?.message || error });
  }
});

// -----------------------------------------------------------------------------
// ROTA DE LOGIN
// -----------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const userList = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const user = userList[0];

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    // Corrigido para jwt.sign
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, roleId: user.roleId },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        sectorId: user.sectorId,
        roleId: user.roleId,
      },
    });
  } catch (error: any) {
    console.error('Erro no login:', error);
    return res.status(500).json({ error: 'Erro interno no servidor ao realizar login.', details: error.message });
  }
});

// Rota ME (Usuário logado)
app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// --- USUÁRIOS ---
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      sectorId: users.sectorId,
      roleId: users.roleId,
      // 'active' foi removido porque não existe na tabela users no schema.ts
    }).from(users);

    res.json(allUsers);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar usuários.' });
  }
});

// --- MÓDULO DE CLIENTES ---

// Listar todos os clientes
app.get('/api/clientes', authenticateToken, async (req, res) => {
  try {
    const listaClientes = await db.select().from(clientes);
    return res.json(listaClientes);
  } catch (error: any) {
    console.error('Erro ao buscar clientes:', error);
    return res.status(500).json({ error: 'Erro ao buscar clientes.', details: error.message });
  }
});

// Cadastrar novo cliente
app.post('/api/clientes', authenticateToken, async (req, res) => {
  try {
    const novoCliente = await db.insert(clientes).values(req.body).returning();
    return res.status(201).json(novoCliente[0]);
  } catch (error: any) {
    console.error('Erro ao cadastrar cliente:', error);
    return res.status(500).json({ error: 'Erro ao cadastrar cliente.', details: error.message });
  }
});

// Detalhes do Cliente
app.get('/api/clientes/:id', authenticateToken, checkPermission('clientes', 'view'), async (req, res) => {
  try {
    // 1. Convertemos para Número para buscar na tabela 'clientes' (onde id é integer)
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID do cliente inválido.' });
    }

    const listaClientes = await db.select().from(clientes).where(eq(clientes.id, id)).limit(1);

    if (!listaClientes[0]) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    // 2. Convertemos para String aqui porque clientId na 'clientCustomValues' é texto (SQLiteText)
    const valoresCustomizados = await db
      .select({
        fieldId: clientCustomValues.fieldId,
        label: clientCustomFields.label,
        fieldName: clientCustomFields.fieldName,
        value: clientCustomValues.value,
      })
      .from(clientCustomValues)
      .innerJoin(clientCustomFields, eq(clientCustomValues.fieldId, clientCustomFields.id))
      .where(eq(clientCustomValues.clientId, String(id))); // <-- AQUI FOI ALTERADO PARA String(id)

    return res.json({
      ...listaClientes[0],
      camposCustomizados: valoresCustomizados,
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao buscar detalhes do cliente.', details: error?.message });
  }
});

// --- ATUALIZAR CLIENTE ---
app.put('/api/clientes/:id', authenticateToken, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'ID do cliente inválido.' });
    }

    const dadosAtualizados = req.body;

    // Remove o id do corpo para evitar sobrescrever a chave primária acidentalmente
    delete dadosAtualizados.id;
    delete dadosAtualizados._id;

    // Executa o update usando Drizzle ORM
    const clienteAtualizado = await db
      .update(clientes)
      .set(dadosAtualizados)
      .where(eq(clientes.id, id))
      .returning();

    if (!clienteAtualizado[0]) {
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

// --- INICIALIZAÇÃO DO SERVIDOR ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando com sucesso em http://localhost:${PORT}`);
});