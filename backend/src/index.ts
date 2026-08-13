import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sql, eq } from 'drizzle-orm';
import { db } from './core/database';
import { users, sectors, roles } from './core/database/schema';
import { authenticateToken, AuthenticatedRequest } from './core/auth/auth.middleware';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health Check
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

// 1. ROTA DE LOGIN
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
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

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email,
        sectorId: user.sectorId,
        roleId: user.roleId,
      },
      process.env.JWT_SECRET || 'super_secreto_alterar_em_producao',
      { expiresIn: '8h' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        sectorId: user.sectorId,
        roleId: user.roleId,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro no servidor durante o login.', details: error?.message });
  }
});

// 2. ROTA ME (Saber quem está logado)
app.get('/api/auth/me', authenticateToken, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

// 3. ROTA LISTAR USUÁRIOS
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      active: users.active,
      sectorId: users.sectorId,
      roleId: users.roleId,
    }).from(users);

    res.json(allUsers);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar usuários.' });
  }
});

import { clients, clientCustomFields, clientCustomValues } from './core/database/schema';
import { checkPermission } from './core/permissions/permission.middleware';

// --- MÓDULO DE CLIENTES ---

// 1. Cadastrar Cliente
app.post('/api/clients', authenticateToken, checkPermission('clients', 'create'), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, cpfCnpj, rg, birthDate, motherName, nitPis, phone, email, address, notes, customValues } = req.body;

    if (!name || !cpfCnpj) {
      return res.status(400).json({ error: 'Nome e CPF/CNPJ são obrigatórios.' });
    }

    const [newClient] = await db.insert(clients).values({
      name,
      cpfCnpj,
      rg,
      birthDate,
      motherName,
      nitPis,
      phone,
      email,
      address,
      notes,
      createdBy: req.user?.id,
    }).returning();

    // Salvar campos customizados caso fornecidos
    if (customValues && typeof customValues === 'object') {
      for (const [fieldId, val] of Object.entries(customValues)) {
        await db.insert(clientCustomValues).values({
          clientId: newClient.id,
          fieldId,
          value: String(val),
        });
      }
    }

    res.status(201).json(newClient);
  } catch (error: any) {
    if (error?.message?.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Já existe um cliente cadastrado com este CPF/CNPJ.' });
    }
    res.status(500).json({ error: 'Erro ao cadastrar cliente.', details: error?.message });
  }
});

// 2. Listar Clientes
app.get('/api/clients', authenticateToken, checkPermission('clients', 'view'), async (req, res) => {
  try {
    const allClients = await db.select().from(clients);
    res.json(allClients);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar clientes.' });
  }
});

// 3. Obter Detalhes do Cliente (com campos dinâmicos)
app.get('/api/clients/:id', authenticateToken, checkPermission('clients', 'view'), async (req, res) => {
  try {
    const { id } = req.params;
    const clientList = await db.select().from(clients).where(eq(clients.id, id)).limit(1);

    if (!clientList[0]) {
      return res.status(404).json({ error: 'Cliente não encontrado.' });
    }

    const customVals = await db
      .select({
        fieldId: clientCustomValues.fieldId,
        label: clientCustomFields.label,
        fieldName: clientCustomFields.fieldName,
        value: clientCustomValues.value,
      })
      .from(clientCustomValues)
      .innerJoin(clientCustomFields, eq(clientCustomValues.fieldId, clientCustomFields.id))
      .where(eq(clientCustomValues.clientId, id));

    res.json({
      ...clientList[0],
      customFields: customVals,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao buscar detalhes do cliente.' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando localmente em http://localhost:${PORT}`);
});