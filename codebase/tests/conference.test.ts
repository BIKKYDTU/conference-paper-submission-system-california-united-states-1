import request from 'supertest';
import { app, setupApp, registerUser, createConference, uniqueEmail, futureISO } from './helpers';

let chairToken: string;
let authorToken: string;

beforeAll(async () => {
  await setupApp();
  const chair = await registerUser('Conf Chair', uniqueEmail('conf_chair'), 'pass123', 'chair');
  chairToken = chair.token;
  const author = await registerUser('Conf Author', uniqueEmail('conf_author'), 'pass123', 'author');
  authorToken = author.token;
});

describe('POST /api/conferences', () => {
  it('should create a conference and return 201 with id and all provided fields including topicAreas as a JSON array', async () => {
    const data = {
      name: 'ICML 2026',
      description: 'International Conference on Machine Learning',
      submissionDeadline: futureISO(30),
      notificationDate: futureISO(60),
      cameraReadyDeadline: futureISO(90),
      topicAreas: ['Deep Learning', 'Reinforcement Learning'],
      submissionGuidelines: 'Papers must be in PDF format, max 10 pages.',
    };

    const res = await request(app)
      .post('/api/conferences')
      .set('Authorization', `Bearer ${chairToken}`)
      .send(data);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(typeof res.body.id).toBe('number');
    expect(res.body.name).toBe(data.name);
    expect(res.body.description).toBe(data.description);
    expect(res.body.submissionDeadline).toBe(data.submissionDeadline);
    expect(res.body.notificationDate).toBe(data.notificationDate);
    expect(res.body.cameraReadyDeadline).toBe(data.cameraReadyDeadline);
    expect(res.body.submissionGuidelines).toBe(data.submissionGuidelines);
    expect(Array.isArray(res.body.topicAreas)).toBe(true);
    expect(res.body.topicAreas).toEqual(expect.arrayContaining(data.topicAreas));
  });

  it('should return 403 for non-chair roles', async () => {
    const res = await request(app)
      .post('/api/conferences')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        name: 'Unauthorized Conf',
        description: 'Should fail',
        submissionDeadline: futureISO(30),
        notificationDate: futureISO(60),
        cameraReadyDeadline: futureISO(90),
        topicAreas: ['AI'],
        submissionGuidelines: 'None',
      });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/conferences/:id', () => {
  it('should return the full conference record including all stored fields by ID', async () => {
    const created = await createConference(chairToken, { name: 'Retrieval Conf' });

    const res = await request(app)
      .get(`/api/conferences/${created.id}`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
    expect(res.body.name).toBe('Retrieval Conf');
    expect(res.body).toHaveProperty('description');
    expect(res.body).toHaveProperty('submissionDeadline');
    expect(res.body).toHaveProperty('notificationDate');
    expect(res.body).toHaveProperty('cameraReadyDeadline');
    expect(Array.isArray(res.body.topicAreas)).toBe(true);
    expect(res.body).toHaveProperty('submissionGuidelines');
  });

  it('should return 404 for a non-existent conference ID', async () => {
    const res = await request(app)
      .get('/api/conferences/999999')
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(404);
  });

  it('should be accessible by any authenticated user, not only chairs', async () => {
    const created = await createConference(chairToken, { name: 'Any User Conf' });

    const res = await request(app)
      .get(`/api/conferences/${created.id}`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
    expect(res.body.name).toBe('Any User Conf');
  });
});
