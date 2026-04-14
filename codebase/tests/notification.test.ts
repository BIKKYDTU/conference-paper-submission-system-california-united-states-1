import request from 'supertest';
import {
  app, setupApp, registerUser, createConference, submitPaper,
  setReviewerProfile, submitReview, recordDecision, uniqueEmail,
} from './helpers';

let chairToken: string;
let authorToken: string;
let otherAuthorToken: string;
let conferenceId: number;

beforeAll(async () => {
  await setupApp();

  const chair = await registerUser('Notif Chair', uniqueEmail('notif_chair'), 'pass123', 'chair');
  chairToken = chair.token;

  const author = await registerUser('Notif Author', uniqueEmail('notif_author'), 'pass123', 'author');
  authorToken = author.token;

  const other = await registerUser('Other Author', uniqueEmail('notif_other'), 'pass123', 'author');
  otherAuthorToken = other.token;

  const conf = await createConference(chairToken, { name: 'Notification Conf', topicAreas: ['AI'] });
  conferenceId = conf.id;
});

describe('GET /api/papers/:paperId/notification', () => {
  it('should return decision "pending" and decisionFinal false when no decision has been recorded', async () => {
    const paper = await submitPaper(authorToken, conferenceId, {
      title: 'Pending Notif Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'PN1', affiliation: 'NU', email: 'pn1_notif@nu.edu' }]),
    });

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}/notification`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.paperId).toBe(paper.paperId);
    expect(res.body.decision).toBe('pending');
    expect(res.body.decisionFinal).toBe(false);
  });

  it('should return reviews even before a final decision is recorded, allowing rebuttal-phase viewing', async () => {
    const paper = await submitPaper(authorToken, conferenceId, {
      title: 'Early Reviews Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'ER1', affiliation: 'EU', email: 'er1_notif@eu.edu' }]),
    });

    const reviewer = await registerUser('NotifRev', uniqueEmail('notif_rev'), 'pass123', 'reviewer');
    await setReviewerProfile(reviewer.token, ['AI'], []);
    await request(app)
      .post(`/api/conferences/${conferenceId}/assignments`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ paperId: paper.paperId, reviewerId: reviewer.user.id });
    await submitReview(reviewer.token, paper.paperId, {
      originality: 4, technicalQuality: 3, clarity: 5, relevance: 4,
      recommendation: 'weak_accept',
      reviewText: 'Solid work.',
      confidentialNote: 'Minor issues.',
    });

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}/notification`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('pending');
    expect(res.body.decisionFinal).toBe(false);
    expect(res.body.reviews.length).toBeGreaterThan(0);
  });

  it('should return decisionFinal true and the final decision after the chair records it', async () => {
    const paper = await submitPaper(authorToken, conferenceId, {
      title: 'Final Notif Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'FN1', affiliation: 'FU', email: 'fn1_notif@fu.edu' }]),
    });
    await recordDecision(chairToken, paper.paperId, 'accept');

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}/notification`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('accept');
    expect(res.body.decisionFinal).toBe(true);
  });

  it('should include reviewText, per-criterion scores, and recommendation in each review, and exclude confidentialNote', async () => {
    const paper = await submitPaper(authorToken, conferenceId, {
      title: 'Fields Notif Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'FF1', affiliation: 'FFU', email: 'ff1_notif@ffu.edu' }]),
    });

    const reviewer = await registerUser('NotifFieldRev', uniqueEmail('notif_fieldrev'), 'pass123', 'reviewer');
    await setReviewerProfile(reviewer.token, ['AI'], []);
    await request(app)
      .post(`/api/conferences/${conferenceId}/assignments`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ paperId: paper.paperId, reviewerId: reviewer.user.id });
    await submitReview(reviewer.token, paper.paperId, {
      originality: 2, technicalQuality: 5, clarity: 3, relevance: 1,
      recommendation: 'reject', reviewText: 'Needs work.',
      confidentialNote: 'hidden note',
    });

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}/notification`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    const review = res.body.reviews[0];
    expect(review).toHaveProperty('reviewText');
    expect(review).toHaveProperty('originality');
    expect(review).toHaveProperty('technicalQuality');
    expect(review).toHaveProperty('clarity');
    expect(review).toHaveProperty('relevance');
    expect(review).toHaveProperty('recommendation');
    expect(review).not.toHaveProperty('confidentialNote');
  });

  it('should include reviews alongside the final decision when both exist', async () => {
    const paper = await submitPaper(authorToken, conferenceId, {
      title: 'Reviews After Decision Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'RAD1', affiliation: 'RDU', email: 'rad1_notif@rdu.edu' }]),
    });

    const reviewer = await registerUser('NotifDecRev', uniqueEmail('notif_decrev'), 'pass123', 'reviewer');
    await setReviewerProfile(reviewer.token, ['AI'], []);
    await request(app)
      .post(`/api/conferences/${conferenceId}/assignments`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ paperId: paper.paperId, reviewerId: reviewer.user.id });
    await submitReview(reviewer.token, paper.paperId);
    await recordDecision(chairToken, paper.paperId, 'accept');

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}/notification`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('accept');
    expect(res.body.decisionFinal).toBe(true);
    expect(Array.isArray(res.body.reviews)).toBe(true);
    expect(res.body.reviews.length).toBeGreaterThan(0);
  });

  it('should include a reviews array in the response even when no reviews have been submitted', async () => {
    const paper = await submitPaper(authorToken, conferenceId, {
      title: 'Empty Reviews Notif Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'ERN1', affiliation: 'ERNU', email: 'ern1_notif@ernu.edu' }]),
    });

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}/notification`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.reviews)).toBe(true);
    expect(res.body.reviews.length).toBe(0);
  });

  it('should return 403 for a user who is not the paper submitting author', async () => {
    const paper = await submitPaper(authorToken, conferenceId, {
      title: 'Forbidden Notif Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'FBN', affiliation: 'FBU', email: 'fbn_notif@fbu.edu' }]),
    });

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}/notification`)
      .set('Authorization', `Bearer ${otherAuthorToken}`);

    expect(res.status).toBe(403);
  });
});
