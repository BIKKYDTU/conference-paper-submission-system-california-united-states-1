import request from 'supertest';
import {
  app, setupApp, registerUser, createConference, submitPaper,
  createTestPdfBuffer, recordDecision, uniqueEmail, pastISO,
} from './helpers';

let chairToken: string;
let authorToken: string;
let otherAuthorToken: string;

beforeAll(async () => {
  await setupApp();

  const chair = await registerUser('CR Chair', uniqueEmail('cr_chair'), 'pass123', 'chair');
  chairToken = chair.token;

  const author = await registerUser('CR Author', uniqueEmail('cr_author'), 'pass123', 'author');
  authorToken = author.token;

  const other = await registerUser('CR Other', uniqueEmail('cr_other'), 'pass123', 'author');
  otherAuthorToken = other.token;
});

describe('POST /api/papers/:paperId/camera-ready', () => {
  it('should upload a camera-ready PDF and return 200 with paperId, status "camera_ready", and cameraReadyUrl', async () => {
    const conf = await createConference(chairToken, { name: 'Camera Ready Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Camera Ready Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'CR1', affiliation: 'CRU', email: 'cr1@cru.edu' }]),
    });
    await recordDecision(chairToken, paper.paperId, 'accept');

    const res = await request(app)
      .post(`/api/papers/${paper.paperId}/camera-ready`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', createTestPdfBuffer(), 'camera-ready.pdf');

    expect(res.status).toBe(200);
    expect(res.body.paperId).toBe(paper.paperId);
    expect(res.body.status).toBe('camera_ready');
    expect(res.body).toHaveProperty('cameraReadyUrl');
    expect(typeof res.body.cameraReadyUrl).toBe('string');
  });

  it('should return 403 when the paper decision is not "accept"', async () => {
    const conf = await createConference(chairToken, { name: 'CR Rejected Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'CR Rejected Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'CRR1', affiliation: 'CRRU', email: 'crr1@crru.edu' }]),
    });
    await recordDecision(chairToken, paper.paperId, 'reject');

    const res = await request(app)
      .post(`/api/papers/${paper.paperId}/camera-ready`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', createTestPdfBuffer(), 'cr-rejected.pdf');

    expect(res.status).toBe(403);
  });

  it('should return 403 when no decision has been recorded for the paper', async () => {
    const conf = await createConference(chairToken, { name: 'CR No Decision Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'CR No Decision Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'CRND1', affiliation: 'CRNDU', email: 'crnd1@crndu.edu' }]),
    });

    const res = await request(app)
      .post(`/api/papers/${paper.paperId}/camera-ready`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', createTestPdfBuffer(), 'cr-nodec.pdf');

    expect(res.status).toBe(403);
  });

  it('should return 403 with error message when the camera-ready deadline has passed', async () => {
    const conf = await createConference(chairToken, {
      name: 'CR Deadline Conf',
      topicAreas: ['AI'],
      cameraReadyDeadline: pastISO(1),
    });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'CR Deadline Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'CRD1', affiliation: 'CRDU', email: 'crd1@crdu.edu' }]),
    });
    await recordDecision(chairToken, paper.paperId, 'accept');

    const res = await request(app)
      .post(`/api/papers/${paper.paperId}/camera-ready`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', createTestPdfBuffer(), 'cr-late.pdf');

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Camera-ready deadline has passed');
  });

  it('should update the paper status to "camera_ready", verifiable via GET paper', async () => {
    const conf = await createConference(chairToken, { name: 'CR Status Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'CR Status Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'CRS1', affiliation: 'CRSU', email: 'crs1@crsu.edu' }]),
    });
    await recordDecision(chairToken, paper.paperId, 'accept');

    await request(app)
      .post(`/api/papers/${paper.paperId}/camera-ready`)
      .set('Authorization', `Bearer ${authorToken}`)
      .attach('file', createTestPdfBuffer(), 'cr-status.pdf');

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('camera_ready');
  });

  it('should return 403 for a user who is not the paper submitting author', async () => {
    const conf = await createConference(chairToken, { name: 'CR Other Author Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'CR Other Author Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'CROA1', affiliation: 'CROAU', email: 'croa1@croau.edu' }]),
    });
    await recordDecision(chairToken, paper.paperId, 'accept');

    const res = await request(app)
      .post(`/api/papers/${paper.paperId}/camera-ready`)
      .set('Authorization', `Bearer ${otherAuthorToken}`)
      .attach('file', createTestPdfBuffer(), 'cr-other.pdf');

    expect(res.status).toBe(403);
  });
});
