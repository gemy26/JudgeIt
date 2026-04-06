import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { resetDatabase, testPrisma } from '../helpers/reset-db';
import { seedTestData } from '../helpers/seed-test-data';

describe('Submissions Flow (e2e)', () => {
  let app: INestApplication;
  let seededProblemId: number;
  let userCookies: string[];

  const login = async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'user@test.com',
      username: 'testuser',
      password: 'Test1234!',
    });
    userCookies = res.headers['set-cookie'];
    return res;
  };

  const submitSolution = (cookies: string[], problemId = seededProblemId) =>
    request(app.getHttpServer())
      .post('/submissions/submit/')
      .set('Cookie', cookies)
      .send({
        problemId,
        sourceCode: 'a, b = map(int, input().split())\nprint(a + b)',
        language: 'python',
      });

  beforeAll(async () => {
    await resetDatabase();
    const { problem } = await seedTestData();
    seededProblemId = problem.id;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'user@test.com',
        username: 'testuser',
        password: 'Test1234!',
      });

    userCookies = loginRes.headers['set-cookie'];
  }, 30000);

  afterAll(async () => {
    await testPrisma.$disconnect();
    await app.close();
  }, 30000);

  describe('POST /submissions/submit', () => {
    it('should submit a solution successfully (201)', async () => {
      await login();
      const res = await submitSolution(userCookies).expect(HttpStatus.CREATED);

      expect(res.body).toMatchObject({
        problem_id: seededProblemId,
        language: 'python',
      });
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('created_at');
    });

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .post('/submissions/submit/')
        .send({
          problemId: seededProblemId,
          sourceCode: 'print("hello")',
          language: 'python',
        })
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 400 when body is missing required fields', async () => {
      await login();
      await request(app.getHttpServer())
        .post('/submissions/submit/')
        .set('Cookie', userCookies)
        .send({}) // missing problemId, sourceCode, language
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 for unsupported language', async () => {
      await login();
      await request(app.getHttpServer())
        .post('/submissions/submit/')
        .set('Cookie', userCookies)
        .send({
          problemId: seededProblemId,
          sourceCode: 'console.log("hi")',
          language: 'javascript', // unsupported
        })
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 404 for non-existent problem', async () => {
      await login();
      await submitSolution(userCookies, 999999).expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('GET /submissions/userSubmissions', () => {
    beforeAll(async () => {
      await resetDatabase();
      const { problem } = await seedTestData();
      seededProblemId = problem.id;
      await login();

      for (let i = 0; i < 5; i++) {
        await submitSolution(userCookies);
      }
    });

    it('should return paginated response shape', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions/userSubmissions')
        .set('Cookie', userCookies)
        .expect(HttpStatus.OK);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toMatchObject({
        total: expect.any(Number),
        total_pages: expect.any(Number),
        page: expect.any(Number),
        per_page: expect.any(Number),
      });
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should use default limit=10 and offset=0 when no query params passed', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions/userSubmissions')
        .set('Cookie', userCookies)
        .expect(HttpStatus.OK);

      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.per_page).toBe(10);
    });

    it('should return correct number of items for limit=1', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions/userSubmissions?limit=1&offset=0')
        .set('Cookie', userCookies)
        .expect(HttpStatus.OK);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.page).toBe(1);
      expect(res.body.pagination.per_page).toBe(1);
    });

    it('should return correct page number for offset=2 limit=2', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions/userSubmissions?limit=2&offset=2')
        .set('Cookie', userCookies)
        .expect(HttpStatus.OK);

      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.per_page).toBe(2);
    });

    it('should return different data for different offsets (pages are distinct)', async () => {
      const page1 = await request(app.getHttpServer())
        .get('/submissions/userSubmissions?limit=2&offset=0')
        .set('Cookie', userCookies)
        .expect(HttpStatus.OK);

      const page2 = await request(app.getHttpServer())
        .get('/submissions/userSubmissions?limit=2&offset=2')
        .set('Cookie', userCookies)
        .expect(HttpStatus.OK);

      const page1Ids = page1.body.data.map((s: any) => s.id);
      const page2Ids = page2.body.data.map((s: any) => s.id);

      expect(page1Ids.some((id: number) => page2Ids.includes(id))).toBe(false);
    });

    it('should return empty data array when offset exceeds total', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions/userSubmissions?limit=10&offset=9999')
        .set('Cookie', userCookies)
        .expect(HttpStatus.OK);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination.total).toBeGreaterThan(0); // total still correct
    });

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/submissions/userSubmissions')
        .expect(HttpStatus.UNAUTHORIZED);
    });

    it('should return 400 for invalid limit value', async () => {
      await request(app.getHttpServer())
        .get('/submissions/userSubmissions?limit=abc')
        .set('Cookie', userCookies)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('each submission item should include user and problem fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions/userSubmissions?limit=1&offset=0')
        .set('Cookie', userCookies)
        .expect(HttpStatus.OK);

      const item = res.body.data[0];
      expect(item).toHaveProperty('user');
      expect(item.user).toHaveProperty('username');
      expect(item).toHaveProperty('problem');
      expect(item.problem).toHaveProperty('title');
    });
  });

  describe('GET /submissions/filtered', () => {
    it('should return only submissions matching the verdict', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions/filtered?verdict=Accepted')
        .set('Cookie', userCookies)
        .expect(HttpStatus.OK);

      expect(Array.isArray(res.body.data)).toBe(true);
      res.body.data.forEach((s: any) => {
        expect(s.verdicate).toBe('Accepted');
      });
    });

    it('should return all submissions when no verdict filter passed', async () => {
      const allRes = await request(app.getHttpServer())
        .get('/submissions/userSubmissions')
        .set('Cookie', userCookies)
        .expect(HttpStatus.OK);

      const filteredRes = await request(app.getHttpServer())
        .get('/submissions/filtered')
        .set('Cookie', userCookies)
        .expect(HttpStatus.OK);

      expect(filteredRes.body.pagination.total).toBe(
        allRes.body.pagination.total,
      );
    });

    it('should return empty data for verdict with no matches', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions/filtered?verdict=NonExistentVerdict')
        .set('Cookie', userCookies)
        .expect(HttpStatus.OK);

      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination.total).toBe(0);
    });

    it('should respect pagination params alongside verdict filter', async () => {
      const res = await request(app.getHttpServer())
        .get('/submissions/filtered?verdict=Accepted&limit=1&offset=0')
        .set('Cookie', userCookies)
        .expect(HttpStatus.OK);

      expect(res.body.data.length).toBeLessThanOrEqual(1);
      expect(res.body.pagination.per_page).toBe(1);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get('/submissions/filtered?verdict=Accepted')
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('GET /submissions/:submissionId', () => {
    let submissionId: number;

    beforeAll(async () => {
      await login();
      const res = await submitSolution(userCookies).expect(HttpStatus.CREATED);
      submissionId = res.body.id;
    });

    it('should return submission details by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/submissions/${submissionId}`)
        .set('Cookie', userCookies)
        .expect(HttpStatus.OK);

      expect(res.body).toMatchObject({
        id: submissionId,
        language: 'python',
      });
      expect(res.body).toHaveProperty('source_code');
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('problem');
    });

    it('should return 404 for non-existent submission id', async () => {
      await request(app.getHttpServer())
        .get('/submissions/999999')
        .set('Cookie', userCookies)
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 400 for non-numeric submission id', async () => {
      await request(app.getHttpServer())
        .get('/submissions/abc')
        .set('Cookie', userCookies)
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 401 when not authenticated', async () => {
      await request(app.getHttpServer())
        .get(`/submissions/${submissionId}`)
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });
});
