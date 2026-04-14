import request from 'supertest';

let _app: any;
let _initializeDatabase: (() => Promise<void>) | null = null;

try {
  const serverApp = require('../server/app');
  _app = serverApp.default || serverApp;
} catch (e) {
  _app = null;
}

try {
  const db = require('../server/database');
  _initializeDatabase = db.initializeDatabase;
} catch (e) {
  _initializeDatabase = null;
}

if (!_app) {
  const express = require('express');
  const stub = express();
  stub.use(express.json());
  stub.all('*', (_req: any, res: any) => {
    res.status(500).json({ error: 'Solution not implemented' });
  });
  _app = stub;
}

const app = _app;
export { app };

let initialized = false;

export async function setupApp() {
  if (!initialized && _initializeDatabase) {
    await _initializeDatabase();
    initialized = true;
  }
  return app;
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  role: 'chair' | 'reviewer' | 'author'
): Promise<{ token: string; user: { id: number; name: string; email: string; role: string } }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name, email, password, role })
    .expect(201);
  return res.body;
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ token: string; user: { id: number; name: string; email: string; role: string } }> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email, password })
    .expect(200);
  return res.body;
}

export async function createConference(
  token: string,
  overrides: Record<string, any> = {}
) {
  const data = {
    name: 'Test Conference',
    description: 'A test conference for academic papers',
    submissionDeadline: futureISO(30),
    notificationDate: futureISO(60),
    cameraReadyDeadline: futureISO(90),
    topicAreas: ['AI', 'Machine Learning', 'NLP'],
    submissionGuidelines: 'Submit papers in PDF format.',
    ...overrides,
  };
  const res = await request(app)
    .post('/api/conferences')
    .set('Authorization', `Bearer ${token}`)
    .send(data)
    .expect(201);
  return res.body;
}

export function createTestPdfBuffer(): Buffer {
  return Buffer.from('%PDF-1.4 test content for unit testing');
}

export async function submitPaper(
  token: string,
  conferenceId: number,
  overrides: Record<string, any> = {}
) {
  const defaults = {
    title: 'Test Paper Title',
    abstract: 'This is a test abstract for the paper.',
    authors: JSON.stringify([
      { name: 'Author One', affiliation: 'University A', email: 'author1@university.edu' },
    ]),
    topicAreas: JSON.stringify(['AI']),
    keywords: 'testing, AI',
  };
  const fields = { ...defaults, ...overrides };
  const req = request(app)
    .post(`/api/conferences/${conferenceId}/papers`)
    .set('Authorization', `Bearer ${token}`);

  for (const [key, value] of Object.entries(fields)) {
    if (key !== 'file') {
      req.field(key, value);
    }
  }
  req.attach('file', createTestPdfBuffer(), 'test-paper.pdf');

  const res = await req.expect(201);
  return res.body;
}

export async function setReviewerProfile(
  token: string,
  expertise: string[],
  conflicts: string[]
) {
  const res = await request(app)
    .put('/api/reviewers/profile')
    .set('Authorization', `Bearer ${token}`)
    .send({ expertise, conflicts })
    .expect(200);
  return res.body;
}

export async function submitReview(
  token: string,
  paperId: string,
  overrides: Record<string, any> = {}
) {
  const data = {
    originality: 4,
    technicalQuality: 3,
    clarity: 5,
    relevance: 4,
    recommendation: 'accept',
    reviewText: 'Good paper with solid contributions.',
    confidentialNote: 'No major concerns.',
    ...overrides,
  };
  const res = await request(app)
    .post(`/api/papers/${paperId}/reviews`)
    .set('Authorization', `Bearer ${token}`)
    .send(data)
    .expect(201);
  return res.body;
}

export async function recordDecision(
  token: string,
  paperId: string,
  decision: 'accept' | 'reject'
) {
  const res = await request(app)
    .post(`/api/papers/${paperId}/decision`)
    .set('Authorization', `Bearer ${token}`)
    .send({ decision })
    .expect(200);
  return res.body;
}

export function futureISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function pastISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@test.com`;
}
