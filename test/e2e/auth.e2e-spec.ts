import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { resetDatabase, testPrisma } from '../helpers/reset-db';
import { seedTestData } from '../helpers/seed-test-data';

describe('AuthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetDatabase();
    await seedTestData();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 30000);

  afterAll(async () => {
    await testPrisma.$disconnect();
    await app.close();
  }, 30000);

  it('should create a new user', () => {
    return request(app.getHttpServer())
      .post('/auth/local/signup')
      .send({
        email: 'newuser@test.com',
        username: 'newuser',
        password: 'SecurePass123!',
      })
      .expect(201);

    it('should reject duplicate email', () => {
      return request(app.getHttpServer())
        .post('/auth/local/signup')
        .send({
          email: 'admin@test.com',
          username: 'anotherusername',
          password: 'SecurePass123!',
        })
        .expect(409);
    });
  });
});
