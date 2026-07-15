import { PrismaClient, AgentRole } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@neurorecode.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'change-me-admin';
  const name = process.env.SEED_ADMIN_NAME ?? 'Neuro Recode Admin';

  const existing = await prisma.agent.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin agent already exists: ${email}`);
    return;
  }

  const passwordHash = await argon2.hash(password);
  await prisma.agent.create({
    data: { name, email, passwordHash, role: AgentRole.admin, presence: 'offline' },
  });
  console.log(`Seeded admin agent: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
