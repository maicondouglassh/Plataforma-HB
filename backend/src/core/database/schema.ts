import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

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
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  sectorId: text('sector_id').references(() => sectors.id),
  roleId: text('role_id').references(() => roles.id),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

// 4. PERMISSÕES CONFIGURÁVEIS (Módulo, Ação, Perfil, Setor, Restrições de Campos)
export const permissions = sqliteTable('permissions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  roleId: text('role_id').references(() => roles.id),
  sectorId: text('sector_id').references(() => sectors.id),
  module: text('module').notNull(), // Ex: 'finance', 'clients', 'processes'
  action: text('action').notNull(), // Ex: 'view', 'create', 'edit', 'delete', 'export'
  restrictedFields: text('restricted_fields'), // JSON com campos ocultos ex: ["financial_info"]
  allowed: integer('allowed', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});

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
export const clients = sqliteTable('clients', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  cpfCnpj: text('cpf_cnpj').notNull().unique(),
  rg: text('rg'),
  birthDate: text('birth_date'),
  motherName: text('mother_name'),
  nitPis: text('nit_pis'),
  phone: text('phone'),
  email: text('email'),
  address: text('address'),
  status: text('status').notNull().default('Ativo'), // Ex: 'Em Prospecção', 'Ativo', 'Arquivado'
  notes: text('notes'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
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
  clientId: text('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  fieldId: text('field_id').notNull().references(() => clientCustomFields.id, { onDelete: 'cascade' }),
  value: text('value'), // Armazenado como string (interpretado de acordo com fieldType)
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`),
});