import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

export async function seedTestData() {
  const hash = await argon2.hash('Test1234!');
  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      username: 'testadmin',
      hash,
      role: [Role.ADMIN],
    },
  });
  const user = await prisma.user.create({
    data: {
      email: 'user@test.com',
      username: 'testuser',
      hash,
      role: [Role.USER],
    },
  });
  const problem = await prisma.problem.create({
    data: {
      title: 'Test Problem',
      slug: 'test-problem',
      description: 'A test problem for E2E tests',
      difficulty: 'easy',
      timeLimit: 2,
      memoryLimit: 256,
      created_by: admin.id,
    },
  });
  return { admin, user, problem };
}
