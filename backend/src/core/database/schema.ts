import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { or, like } from 'drizzle-orm';


// 1. SETORES (Ex: Comercial, Jurídico, Financeiro)
export const sectors = sqliteTable('sectors', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  description: text('description'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// 2. PERFIS DE ACESSO (Ex: Admin, Advogado, Recepcionista)
export const roles = sqliteTable('roles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  description: text('description'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// 3. USUÁRIOS
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  sectorId: integer('sector_id'),
  roleId: integer('role_id'),
});

// 4. PERMISSÕES CONFIGURÁVEIS
// Regra pode ser atribuída diretamente a:
// - usuário
// - perfil
// - setor
//
// Pelo menos um dos três escopos deverá ser informado pela aplicação.
export const permissions = sqliteTable(
  'permissions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),

    userId: text('user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),

    roleId: text('role_id').references(() => roles.id, {
      onDelete: 'cascade',
    }),

    sectorId: text('sector_id').references(() => sectors.id, {
      onDelete: 'cascade',
    }),

    module: text('module').notNull(),

    action: text('action').notNull(),

    // JSON:
    // ["financial_info", "gov_password"]
    restrictedFields: text('restricted_fields'),

    allowed: integer('allowed', {
      mode: 'boolean',
    }).notNull().default(true),

    createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  },

  (table) => [
    uniqueIndex('permissions_user_module_action_idx').on(
      table.userId,
      table.module,
      table.action,
    ),

    uniqueIndex('permissions_role_module_action_idx').on(
      table.roleId,
      table.module,
      table.action,
    ),

    uniqueIndex('permissions_sector_module_action_idx').on(
      table.sectorId,
      table.module,
      table.action,
    ),
  ],
);

// 5. AUDITORIA DE SEGURANÇA E ALTERAÇÕES
export const auditLogs = sqliteTable('audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').references(() => users.id),
  action: text('action').notNull(), // Ex: 'PERMISSION_CHANGE', 'DELETE_CLIENT'
  targetEntity: text('target_entity').notNull(), // Tabela afetada
  targetId: text('target_id'),
  oldValues: text('old_values'), // JSON do estado anterior
  newValues: text('new_values'), // JSON do novo estado
  ipAddress: text('ip_address'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// 6. CLIENTES (Dados Primários)
export const clientes = sqliteTable('clientes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nome: text('nome').notNull(),
  cpf: text('cpf'),
  rg: text('rg'),
  dataNascimento: text('data_nascimento'),
  nomeMae: text('nome_mae'),
  genero: text('genero'),
  nacionalidade: text('nacionalidade').default('Brasileira'),
  estadoCivil: text('estado_civil'),
  profissao: text('profissao'),
  telefone: text('telefone'),
  origem: text('origem'),
  cep: text('cep'),
  endereco: text('endereco'),
  bairro: text('bairro'),
  cidade: text('cidade'),
  estado: text('estado'),
  nomeRepresentante: text('nome_representante'),
  cpfRepresentante: text('cpf_representante'),
  senhaGov: text('senha_gov'),
  nis: text('nis'),
});

// 7. DEFINIÇÃO DE CAMPOS CUSTOMIZADOS DE CLIENTES
export const clientCustomFields = sqliteTable('client_custom_fields', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  label: text('label').notNull(), // Ex: "Possui Moléstia Grave?"
  fieldName: text('field_name').notNull().unique(), // Ex: "has_severe_disease"
  fieldType: text('field_type').notNull(), // Ex: "text", "number", "boolean", "date", "select"
  options: text('options'), // JSON com opções para campos do tipo 'select'
  required: integer('required', { mode: 'boolean' }).default(false),
  active: integer('active', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// 8. VALORES DOS CAMPOS CUSTOMIZADOS DOS CLIENTES
export const clientCustomValues = sqliteTable('client_custom_values', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  clientId: text('client_id').notNull().references(() => clientes.id, { onDelete: 'cascade' }),
  fieldId: text('field_id').notNull().references(() => clientCustomFields.id, { onDelete: 'cascade' }),
  value: text('value'), // Armazenado como string (interpretado de acordo com fieldType)
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});