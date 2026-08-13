import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Aponta corretamente para a pasta 'database' na raiz do projeto
const dbPath = path.resolve(process.cwd(), '../database/plataforma-hb.sqlite');

const sqlite = new Database(dbPath);

export const db = drizzle(sqlite);