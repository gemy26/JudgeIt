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

  it('should register a new user successfully', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'newuser@test.com',
        username: 'newuser',
        password: 'SecurePass123!',
      })
      .expect(HttpStatus.CREATED);
  });

  it('should reject registration with a duplicate email', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'admin@test.com',
        username: 'anotherusername',
        password: 'SecurePass123!',
      })
      .expect(HttpStatus.CONFLICT);
  });

  it('should reject registration with missing required fields', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'incomplete@test.com' })
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('should login as admin and return tokens with cookies', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'admin@test.com',
      username: 'testadmin',
      password: 'Test1234!',
    });

    expect(res.statusCode).toBe(HttpStatus.OK);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
    expect(res.headers['set-cookie']).toBeDefined();

    adminCookies = res.headers['set-cookie'];
    adminAccessToken = res.body.access_token;
  });

  it('should login as regular user and return tokens with cookies', async () => {
    const res = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'newuser@test.com',
      username: 'newuser',
      password: 'SecurePass123!',
    });

    expect(res.statusCode).toBe(HttpStatus.OK);
    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
    expect(res.headers['set-cookie']).toBeDefined();

    userCookies = res.headers['set-cookie'];
    userAccessToken = res.body.access_token;
  });

  it('should reject login with invalid credentials', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'wrongpass',
        username: 'testadmin',
      })
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('should refresh tokens using a valid refresh cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', adminCookies)
      .expect(HttpStatus.OK);

    expect(res.body).toHaveProperty('access_token');
    expect(res.body).toHaveProperty('refresh_token');
  });

  it('should reject token refresh when no cookie is provided', () => {
    return request(app.getHttpServer())
      .post('/auth/refresh')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('should allow admin to access admin-only route', () => {
    return request(app.getHttpServer())
      .get('/auth/admin')
      .set('Cookie', adminCookies)
      .expect(HttpStatus.OK)
      .expect((res) => expect(res.text).toBe('Hello, Admin'));
  });

  it('should deny regular user access to admin-only route', () => {
    return request(app.getHttpServer())
      .get('/auth/admin')
      .set('Cookie', userCookies)
      .expect(HttpStatus.FORBIDDEN);
  });

  it('should logout user successfully', () => {
    return request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', userCookies)
      .expect(HttpStatus.OK);
  });

  it('should reject token refresh after logout', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', adminCookies);

    return request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', adminCookies)
      .expect(HttpStatus.FORBIDDEN);
  });

  it('should reject forgot-password request with no email provided', () => {
    return request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({})
      .expect(HttpStatus.BAD_REQUEST);
  });

  it('should respond silently for unknown email (security best practice)', () => {
    return request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: 'unknown@test.com' })
      .expect(HttpStatus.CREATED);
  });

  it('should reject reset password token verification with an invalid token', () => {
    return request(app.getHttpServer())
      .get('/auth/reset-password/verify')
      .query({ token: 'invalidtoken' })
      .expect(HttpStatus.FORBIDDEN);
  });

  it('should reject change password request from unauthenticated user', () => {
    return request(app.getHttpServer())
      .patch('/auth/password')
      .send({ oldPass: 'old', newPass: 'new' })
      .expect(HttpStatus.UNAUTHORIZED);
  });
});
