import request from 'supertest';
import {
  app, setupApp, registerUser, createConference, submitPaper,
  setReviewerProfile, submitReview, recordDecision, uniqueEmail,
  futureISO, pastISO,
} from './helpers';

let chairToken: string;
let authorToken: string;
let otherAuthorToken: string;
let reviewerToken: string;
let reviewerId: number;

beforeAll(async () => {
  await setupApp();

  const chair = await registerUser('Reb Chair', uniqueEmail('reb_chair'), 'pass123', 'chair');
  chairToken = chair.token;

  const author = await registerUser('Reb Author', uniqueEmail('reb_author'), 'pass123', 'author');
  authorToken = author.token;

  const other = await registerUser('Reb Other', uniqueEmail('reb_other'), 'pass123', 'author');
  otherAuthorToken = other.token;

  const reviewer = await registerUser('Reb Reviewer', uniqueEmail('reb_reviewer'), 'pass123', 'reviewer');
  reviewerToken = reviewer.token;
  reviewerId = reviewer.user.id;
});

describe('POST /api/papers/:paperId/rebuttal', () => {
  it('should submit a rebuttal and return 201 with paperId, rebuttalText, and submittedAt timestamp', async () => {
    const conf = await createConference(chairToken, { name: 'Rebuttal Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Rebuttal Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'RB1', affiliation: 'RBU', email: 'rb1_reb@rbu.edu' }]),
    });

    const res = await request(app)
      .post(`/api/papers/${paper.paperId}/rebuttal`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ rebuttalText: 'We respectfully disagree with the reviewer.' });

    expect(res.status).toBe(201);
    expect(res.body.paperId).toBe(paper.paperId);
    expect(res.body.rebuttalText).toBe('We respectfully disagree with the reviewer.');
    expect(res.body).toHaveProperty('submittedAt');
    expect(typeof res.body.submittedAt).toBe('string');
  });

  it('should return 409 when a final decision has already been recorded for the paper', async () => {
    const conf = await createConference(chairToken, { name: 'Rebuttal 409 Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Decided Rebuttal Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'DR1', affiliation: 'DRU', email: 'dr1_reb@dru.edu' }]),
    });
    await recordDecision(chairToken, paper.paperId, 'accept');

    const res = await request(app)
      .post(`/api/papers/${paper.paperId}/rebuttal`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ rebuttalText: 'Too late for rebuttal.' });

    expect(res.status).toBe(409);
  });

  it('should return 403 with error message when the rebuttal period has closed (after notificationDate)', async () => {
    const conf = await createConference(chairToken, {
      name: 'Rebuttal Closed Conf',
      topicAreas: ['AI'],
      notificationDate: pastISO(1),
    });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Late Rebuttal Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'LR1', affiliation: 'LRU', email: 'lr1_reb@lru.edu' }]),
    });

    const res = await request(app)
      .post(`/api/papers/${paper.paperId}/rebuttal`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ rebuttalText: 'Rebuttal period closed.' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Rebuttal period has closed');
  });

  it('should return 403 for a user who is not the paper submitting author', async () => {
    const conf = await createConference(chairToken, { name: 'Rebuttal Auth Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Auth Rebuttal Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'AR1', affiliation: 'ARU', email: 'ar1_reb@aru.edu' }]),
    });

    const res = await request(app)
      .post(`/api/papers/${paper.paperId}/rebuttal`)
      .set('Authorization', `Bearer ${otherAuthorToken}`)
      .send({ rebuttalText: 'Not my paper.' });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/papers/:paperId/rebuttal', () => {
  it('should return the stored rebuttal text and submittedAt for the chair role', async () => {
    const conf = await createConference(chairToken, { name: 'Get Rebuttal Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Get Rebuttal Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'GR1', affiliation: 'GRU', email: 'gr1_reb@gru.edu' }]),
    });

    await request(app)
      .post(`/api/papers/${paper.paperId}/rebuttal`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ rebuttalText: 'Here is our rebuttal.' });

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}/rebuttal`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(200);
    expect(res.body.paperId).toBe(paper.paperId);
    expect(res.body.rebuttalText).toBe('Here is our rebuttal.');
    expect(res.body).toHaveProperty('submittedAt');
  });

  it('should return 404 when no rebuttal has been submitted for the paper', async () => {
    const conf = await createConference(chairToken, { name: 'No Rebuttal Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'No Rebuttal Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'NR1', affiliation: 'NRU', email: 'nr1_reb@nru.edu' }]),
    });

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}/rebuttal`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(404);
  });

  it('should return 403 for non-chair roles', async () => {
    const conf = await createConference(chairToken, { name: 'Rebuttal Forbid Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Forbid Rebuttal Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'FB1', affiliation: 'FBU', email: 'fb1_reb@fbu.edu' }]),
    });

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}/rebuttal`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/papers/:paperId/reviews-for-rebuttal', () => {
  it('should return anonymized reviews with scores and recommendation, excluding confidentialNote, during the rebuttal phase', async () => {
    const conf = await createConference(chairToken, {
      name: 'ReviewsForReb Conf',
      topicAreas: ['AI'],
      notificationDate: futureISO(30),
    });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Reviews For Reb Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'RFR1', affiliation: 'RFRU', email: 'rfr1_reb@rfru.edu' }]),
    });

    await setReviewerProfile(reviewerToken, ['AI'], []);
    await request(app)
      .post(`/api/conferences/${conf.id}/assignments`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ paperId: paper.paperId, reviewerId });
    await submitReview(reviewerToken, paper.paperId, {
      originality: 3, technicalQuality: 4, clarity: 2, relevance: 5,
      recommendation: 'weak_reject',
      reviewText: 'Needs major revisions.',
      confidentialNote: 'This is confidential.',
    });

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}/reviews-for-rebuttal`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.paperId).toBe(paper.paperId);
    expect(Array.isArray(res.body.reviews)).toBe(true);
    expect(res.body.reviews.length).toBe(1);

    const review = res.body.reviews[0];
    expect(review).toHaveProperty('reviewText');
    expect(review).toHaveProperty('originality');
    expect(review).toHaveProperty('technicalQuality');
    expect(review).toHaveProperty('clarity');
    expect(review).toHaveProperty('relevance');
    expect(review).toHaveProperty('recommendation');
    expect(review).not.toHaveProperty('confidentialNote');
  });

  it('should return 403 when a final decision has already been recorded', async () => {
    const conf = await createConference(chairToken, {
      name: 'R4R Decided Conf',
      topicAreas: ['AI'],
      notificationDate: futureISO(30),
    });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'R4R Decided Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'R4D1', affiliation: 'R4DU', email: 'r4d1_reb@r4du.edu' }]),
    });
    await recordDecision(chairToken, paper.paperId, 'reject');

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}/reviews-for-rebuttal`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(403);
  });

  it('should return 403 when the current time is after the conference notificationDate', async () => {
    const conf = await createConference(chairToken, {
      name: 'R4R Expired Conf',
      topicAreas: ['AI'],
      notificationDate: pastISO(1),
    });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'R4R Expired Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'R4E1', affiliation: 'R4EU', email: 'r4e1_reb@r4eu.edu' }]),
    });

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}/reviews-for-rebuttal`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(403);
  });

  it('should return 403 for a user who is not the paper submitting author', async () => {
    const conf = await createConference(chairToken, {
      name: 'R4R Auth Conf',
      topicAreas: ['AI'],
      notificationDate: futureISO(30),
    });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'R4R Auth Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'R4A1', affiliation: 'R4AU', email: 'r4a1_reb@r4au.edu' }]),
    });

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}/reviews-for-rebuttal`)
      .set('Authorization', `Bearer ${otherAuthorToken}`);

    expect(res.status).toBe(403);
  });
});
