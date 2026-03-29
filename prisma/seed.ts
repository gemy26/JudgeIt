import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await argon2.hash(process.env.ADMIN_PASSWORD || 'admin123');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@judgeit.io' },
    update: {},
    create: {
      email: 'admin@judgeit.io',
      username: 'admin',
      hash: adminHash,
      role: [Role.ADMIN],
    },
  });

  const problems = [
    {
      slug: 'two-sum',
      title: 'Two Sum',
      description:
        'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
      difficulty: 'easy',
      timeLimit: 2,
      memoryLimit: 256,
    },
    {
      slug: 'merge-intervals',
      title: 'Merge Intervals',
      description:
        'Given an array of intervals where intervals[i] = [starti, endi], merge all overlapping intervals.',
      difficulty: 'medium',
      timeLimit: 2,
      memoryLimit: 256,
    },
    {
      slug: 'longest-substring',
      title: 'Longest Substring Without Repeating Characters',
      description:
        'Given a string s, find the length of the longest substring without repeating characters.',
      difficulty: 'medium',
      timeLimit: 2,
      memoryLimit: 256,
    },
  ];
  for (const p of problems) {
    await prisma.problem.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        ...p,
        created_by: admin.id,
      },
    });
  }
  console.log(`Seeded: 1 admin + ${problems.length} problems`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
