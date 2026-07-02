import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Carrega as variáveis do arquivo .env
dotenv.config();

const prisma = new PrismaClient();

async function main() {
  // Busca do .env ou usa o valor padrão caso você esqueça de preencher
  const email = process.env.ADMIN_EMAIL || "admin@admin.com";
  const senhaPura = process.env.ADMIN_PASSWORD;

  if (!senhaPura) {
    console.error("❌ Erro: Você precisa definir a variável ADMIN_PASSWORD no seu arquivo .env");
    process.exit(1);
  }

  const senhaCripto = await bcrypt.hash(senhaPura, 10);

  // Verifica se já não existe um admin com esse e-mail para não duplicar
  const adminExiste = await prisma.saas_admins.findUnique({
    where: { email }
  });

  if (adminExiste) {
    console.log("ℹ️ Um administrador com este e-mail já existe no banco de dados.");
    return;
  }

  await prisma.saas_admins.create({
    data: {
      nome: "Super Administrador",
      email,
      senha: senhaCripto
    }
  });

  console.log(`🚀 Usuário Master do SaaS (${email}) gerado com sucesso!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());