import request from 'supertest';
import { app, setupApp, uniqueEmail } from './helpers';

beforeAll(async () => {
  await setupApp();
});

describe('POST /api/auth/register', () => {
  it('should register a new user and return 201 with a signed JWT token and a user object containing id, name, email, and role', async () => {
    const email = uniqueEmail('reg');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Alice Chair', email, password: 'securePass1', role: 'chair' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body).toHaveProperty('user');
    expect(typeof res.body.user.id).toBe('number');
    expect(res.body.user.name).toBe('Alice Chair');
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe('chair');
  });

  it('should register users with each of the three roles: chair, reviewer, author', async () => {
    const roles: Array<'chair' | 'reviewer' | 'author'> = ['chair', 'reviewer', 'author'];
    for (const role of roles) {
      const email = uniqueEmail(`role_${role}`);
      const res = await request(app)
        .post('/api/auth/register')
        .send({ name: `User ${role}`, email, password: 'pass123', role });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe(role);
      expect(res.body).toHaveProperty('token');
    }
  });
});

describe('POST /api/auth/login', () => {
  const loginEmail = uniqueEmail('login');
  const loginPassword = 'loginPass456';

  beforeAll(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Login User', email: loginEmail, password: loginPassword, role: 'author' });
  });

  it('should authenticate with valid credentials and return 200 with a JWT token and user object', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: loginEmail, password: loginPassword });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.email).toBe(loginEmail);
    expect(res.body.user.role).toBe('author');
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user).toHaveProperty('name');
  });

  it('should return 401 for an unrecognized email address', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@nowhere.com', password: loginPassword });

    expect(res.status).toBe(401);
  });

  it('should return 401 for an incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: loginEmail, password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });
});

describe('JWT authentication middleware', () => {
  it('should return 401 when the Authorization header is absent', async () => {
    const res = await request(app).get('/api/reviewers/profile');
    expect(res.status).toBe(401);
  });

  it('should return 401 when the token is invalid or malformed', async () => {
    const res = await request(app)
      .get('/api/reviewers/profile')
      .set('Authorization', 'Bearer invalid.token.value');

    expect(res.status).toBe(401);
  });

  it('should return 401 when the token is expired', async () => {
    const jwt = require('jsonwebtoken');
    const expiredToken = jwt.sign(
      { id: 1, role: 'reviewer' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '-1h' }
    );

    const res = await request(app)
      .get('/api/reviewers/profile')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });
});
