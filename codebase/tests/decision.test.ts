import request from 'supertest';
import {
  app, setupApp, registerUser, createConference, submitPaper,
  setReviewerProfile, submitReview, recordDecision, uniqueEmail,
} from './helpers';

let chairToken: string;
let authorToken: string;
let conferenceId: number;

beforeAll(async () => {
  await setupApp();

  const chair = await registerUser('Dec Chair', uniqueEmail('dec_chair'), 'pass123', 'chair');
  chairToken = chair.token;

  const author = await registerUser('Dec Author', uniqueEmail('dec_author'), 'pass123', 'author');
  authorToken = author.token;

  const conf = await createConference(chairToken, { name: 'Decision Conf', topicAreas: ['AI'] });
  conferenceId = conf.id;
});

describe('POST /api/papers/:paperId/decision', () => {
  it('should record an accept decision and return paperId, decision "accept", and status "accepted"', async () => {
    const paper = await submitPaper(authorToken, conferenceId, {
      title: 'Accept Decision Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'AD1', affiliation: 'AU', email: 'ad1_dec@au.edu' }]),
    });

    const res = await request(app)
      .post(`/api/papers/${paper.paperId}/decision`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ decision: 'accept' });

    expect(res.status).toBe(200);
    expect(res.body.paperId).toBe(paper.paperId);
    expect(res.body.decision).toBe('accept');
    expect(res.body.status).toBe('accepted');
  });

  it('should record a reject decision and return status "rejected"', async () => {
    const paper = await submitPaper(authorToken, conferenceId, {
      title: 'Reject Decision Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'RD1', affiliation: 'RU', email: 'rd1_dec@ru.edu' }]),
    });

    const res = await request(app)
      .post(`/api/papers/${paper.paperId}/decision`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ decision: 'reject' });

    expect(res.status).toBe(200);
    expect(res.body.paperId).toBe(paper.paperId);
    expect(res.body.decision).toBe('reject');
    expect(res.body.status).toBe('rejected');
  });

  it('should persist the decision and update the paper status, verifiable via GET paper', async () => {
    const paper = await submitPaper(authorToken, conferenceId, {
      title: 'Status Persist Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'SP1', affiliation: 'SPU', email: 'sp1_dec@spu.edu' }]),
    });

    await recordDecision(chairToken, paper.paperId, 'accept');

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('accepted');
  });

  it('should return 403 for non-chair roles', async () => {
    const paper = await submitPaper(authorToken, conferenceId, {
      title: 'Auth Dec Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'ADP', affiliation: 'AU', email: 'adp_dec@au.edu' }]),
    });

    const res = await request(app)
      .post(`/api/papers/${paper.paperId}/decision`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ decision: 'accept' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/conferences/:conferenceId/stats', () => {
  let statsConfId: number;

  beforeAll(async () => {
    const statsConf = await createConference(chairToken, { name: 'Stats Conf', topicAreas: ['AI'] });
    statsConfId = statsConf.id;

    const reviewer = await registerUser('StatsRev', uniqueEmail('dec_statsrev'), 'pass123', 'reviewer');
    await setReviewerProfile(reviewer.token, ['AI'], []);

    const p1 = await submitPaper(authorToken, statsConfId, {
      title: 'Stats Paper 1',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'SP1', affiliation: 'SU', email: 'sp1_stats@su.edu' }]),
    });
    const p2 = await submitPaper(authorToken, statsConfId, {
      title: 'Stats Paper 2',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'SP2', affiliation: 'SU', email: 'sp2_stats@su.edu' }]),
    });

    await request(app)
      .post(`/api/conferences/${statsConfId}/assignments`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ paperId: p1.paperId, reviewerId: reviewer.user.id });
    await request(app)
      .post(`/api/conferences/${statsConfId}/assignments`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ paperId: p2.paperId, reviewerId: reviewer.user.id });

    await submitReview(reviewer.token, p1.paperId, {
      originality: 5, technicalQuality: 4, clarity: 3, relevance: 5,
      recommendation: 'accept', reviewText: 'Great', confidentialNote: 'ok',
    });
    await submitReview(reviewer.token, p2.paperId, {
      originality: 2, technicalQuality: 2, clarity: 4, relevance: 3,
      recommendation: 'reject', reviewText: 'Weak', confidentialNote: 'poor',
    });

    await recordDecision(chairToken, p1.paperId, 'accept');
    await recordDecision(chairToken, p2.paperId, 'reject');
  });

  it('should return aggregate stats with totalPapers, accepted, rejected, acceptanceRate, and scoreDistributions per criterion', async () => {
    const res = await request(app)
      .get(`/api/conferences/${statsConfId}/stats`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalPapers).toBe(2);
    expect(res.body.accepted).toBe(1);
    expect(res.body.rejected).toBe(1);
    expect(res.body.acceptanceRate).toBeCloseTo(0.5);
    expect(res.body).toHaveProperty('scoreDistributions');
    expect(res.body.scoreDistributions).toHaveProperty('originality');
    expect(res.body.scoreDistributions).toHaveProperty('technicalQuality');
    expect(res.body.scoreDistributions).toHaveProperty('clarity');
    expect(res.body.scoreDistributions).toHaveProperty('relevance');
    expect(Array.isArray(res.body.scoreDistributions.originality)).toBe(true);
    expect(res.body.scoreDistributions.originality.length).toBe(2);
  });

  it('should return acceptanceRate as 0 when totalPapers is 0', async () => {
    const emptyConf = await createConference(chairToken, { name: 'Empty Stats Conf', topicAreas: ['AI'] });

    const res = await request(app)
      .get(`/api/conferences/${emptyConf.id}/stats`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalPapers).toBe(0);
    expect(res.body.acceptanceRate).toBe(0);
  });

  it('should return 403 for non-chair roles', async () => {
    const res = await request(app)
      .get(`/api/conferences/${statsConfId}/stats`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(403);
  });
});
