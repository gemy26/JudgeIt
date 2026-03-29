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
}
export { prisma as testPrisma };
