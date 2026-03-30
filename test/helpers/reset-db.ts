import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function resetDatabase() {
  await prisma.$transaction([
    prisma.submissionResult.deleteMany(),
    prisma.submission.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.account.deleteMany(),
    prisma.problem.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  const sequences = await prisma.$queryRaw<{ sequencename: string }[]>`
    SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
  `;
  for (const { sequencename } of sequences) {
    await prisma.$executeRawUnsafe(
      `ALTER SEQUENCE "${sequencename}" RESTART WITH 1`,
    );
  }
}
export { prisma as testPrisma };
