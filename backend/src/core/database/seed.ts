import bcrypt from 'bcryptjs';
import { db } from './index'; // ou ajuste o caminho do seu export 'db'
import { users } from './schema';

async function main() {
  console.log('🌱 Criando usuário administrador inicial...');

  // Criptografa a senha do administrador
  const passwordHash = await bcrypt.hash('123456', 10);

  // Insere o usuário padrão no SQLite
  await db.insert(users).values({
    name: 'Administrador HB',
    email: 'admin@hb.com',
    passwordHash: passwordHash,
  });

  console.log('✅ Usuário administrador criado com sucesso!');
  console.log('-------------------------------------------');
  console.log('E-mail: admin@hb.com');
  console.log('Senha:  123456');
  console.log('-------------------------------------------');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Erro ao rodar o seed:', err);
    process.exit(1);
  });
