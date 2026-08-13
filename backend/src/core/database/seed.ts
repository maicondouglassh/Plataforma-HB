import { db } from './index';
import { sectors, roles, users } from './schema';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Iniciando o seed do banco de dados...');

  // 1. Criar Setores
  const sectorsData = [
    { name: 'Comercial', description: 'Atendimento e captação de clientes' },
    { name: 'Documentação', description: 'Organização e solicitação de documentos' },
    { name: 'Protocolo', description: 'Protocolos administrativos e requerimentos' },
    { name: 'Perícia', description: 'Acompanhamento de perícias e avaliações' },
    { name: 'Financeiro', description: 'Gestão de honorários, RPV e pagamentos' },
    { name: 'Jurídico', description: 'Ações judiciais, recursos e petições' },
    { name: 'Gestão', description: 'Administração geral e gerência' },
  ];

  console.log('📌 Criando setores...');
  const insertedSectors = await db.insert(sectors).values(sectorsData).returning();
  
  const sectorMap = new Map(insertedSectors.map(s => [s.name, s.id]));

  // 2. Criar Perfis (Roles)
  const rolesData = [
    { name: 'Administrador', description: 'Acesso total ao sistema' },
    { name: 'Advogado', description: 'Gestão de processos judiciais e consultas' },
    { name: 'Analista Administrativo', description: 'Operacional de documentos, protocolos e rotinas' },
    { name: 'Recepcionista', description: 'Atendimento comercial e cadastro inicial' },
  ];

  console.log('🎭 Criando perfis de acesso...');
  const insertedRoles = await db.insert(roles).values(rolesData).returning();
  
  const roleMap = new Map(insertedRoles.map(r => [r.name, r.id]));

  // Senha padrão para a equipe inicial (deve ser alterada no primeiro acesso)
  const defaultPasswordHash = await bcrypt.hash('123456', 10);

  // 3. Cadastrar Equipe Inicial
  const teamMembers = [
    { name: 'Horlando', email: 'horlando@hb.adv.br', sector: 'Gestão', role: 'Administrador' },
    { name: 'Ana', email: 'ana@hb.adv.br', sector: 'Comercial', role: 'Recepcionista' },
    { name: 'Maicon', email: 'maicon@hb.adv.br', sector: 'Comercial', role: 'Analista Administrativo' },
    { name: 'Nadilene', email: 'nadilene@hb.adv.br', sector: 'Comercial', role: 'Recepcionista' },
    { name: 'Neto', email: 'neto@hb.adv.br', sector: 'Documentação', role: 'Analista Administrativo' },
    { name: 'Anderlane', email: 'anderlane@hb.adv.br', sector: 'Documentação', role: 'Analista Administrativo' },
    { name: 'Tyele', email: 'tyele@hb.adv.br', sector: 'Perícia', role: 'Analista Administrativo' },
    { name: 'Diego', email: 'diego@hb.adv.br', sector: 'Jurídico', role: 'Advogado' },
    { name: 'Mariana', email: 'mariana@hb.adv.br', sector: 'Jurídico', role: 'Advogado' },
  ];

  console.log('👥 Cadastrando equipe inicial...');
  for (const member of teamMembers) {
    await db.insert(users).values({
      name: member.name,
      email: member.email,
      passwordHash: defaultPasswordHash,
      sectorId: sectorMap.get(member.sector),
      roleId: roleMap.get(member.role),
    });
  }

  console.log('✅ Seed concluído com sucesso!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Erro ao executar o seed:', err);
  process.exit(1);
});