import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, INestApplication } from '@nestjs/common';
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

  let adminAccessToken: string;
  let userAccessToken: string;
  let adminCookies: string[];
  let userCookies: string[];

  it('should create a new user', () => {
    return request(app.getHttpServer())
      .post('/auth/local/signup')
      .send({
        email: 'newuser@test.com',
        username: 'newuser',
        password: 'SecurePass123!',
      })
      .expect(201);
  });

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
  it('should signin as admin and return tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/local/signin')
      .send({
        email: 'admin@test.com',
        username: 'testadmin',
        password: 'Test1234!',
      });

    console.log('Cookies', res.headers['set-cookie']);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
    expect(res.headers['set-cookie']).toBeDefined();

    adminCookies = res.headers['set-cookie'];
    adminAccessToken = res.body.access_token;

    expect(adminCookies).toBeDefined();
  });

  it('should signin as regular user and return tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/local/signin')
      .send({
        email: 'newuser@test.com',
        username: 'newuser',
        password: 'SecurePass123!',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
    expect(res.headers['set-cookie']).toBeDefined();

    userCookies = res.headers['set-cookie'];
    userAccessToken = res.body.access_token;
  });

  it('should refresh tokens using cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/local/refresh')
      .set('Cookie', adminCookies)
      .expect(HttpStatus.OK);

    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
  });

  it('should access admin route with admin token', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/admin')
      .set('Cookie', adminCookies)
      .expect(HttpStatus.OK);

    expect(res.text).toBe('Hello, Admin');
  });

  it('should deny regular user from accessing admin route', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/admin')
      .set('Cookie', userCookies)
      .expect(HttpStatus.FORBIDDEN);
  });

  it('should forbiden non found user from reset password', async () => {
    await request(app.getHttpServer())
      .get('/auth/forget-password')
      .send({
        email: 'haha@gmail.com',
      })
      .expect(HttpStatus.NOT_FOUND);
  });
});
