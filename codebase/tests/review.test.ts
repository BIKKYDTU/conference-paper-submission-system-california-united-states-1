import request from 'supertest';
import {
  app, setupApp, registerUser, createConference, submitPaper,
  setReviewerProfile, submitReview, uniqueEmail,
} from './helpers';

let chairToken: string;
let authorToken: string;
let reviewerToken: string;
let reviewerId: number;
let unassignedReviewerToken: string;
let conferenceId: number;
let paperId: string;

beforeAll(async () => {
  await setupApp();

  const chair = await registerUser('Review Chair', uniqueEmail('rev_chair'), 'pass123', 'chair');
  chairToken = chair.token;

  const author = await registerUser('Review Author', uniqueEmail('rev_author'), 'pass123', 'author');
  authorToken = author.token;

  const reviewer = await registerUser('Review Reviewer', uniqueEmail('rev_reviewer'), 'pass123', 'reviewer');
  reviewerToken = reviewer.token;
  reviewerId = reviewer.user.id;

  const unassigned = await registerUser('Unassigned Rev', uniqueEmail('rev_unassigned'), 'pass123', 'reviewer');
  unassignedReviewerToken = unassigned.token;

  const conf = await createConference(chairToken, { name: 'Review Conf', topicAreas: ['AI'] });
  conferenceId = conf.id;

  const paper = await submitPaper(authorToken, conferenceId, {
    title: 'Reviewable Paper',
    topicAreas: JSON.stringify(['AI']),
    authors: JSON.stringify([{ name: 'RA1', affiliation: 'RU', email: 'ra1_rev@ru.edu' }]),
  });
  paperId = paper.paperId;

  await setReviewerProfile(reviewerToken, ['AI'], []);

  await request(app)
    .post(`/api/conferences/${conferenceId}/assignments`)
    .set('Authorization', `Bearer ${chairToken}`)
    .send({ paperId, reviewerId });
});

describe('POST /api/papers/:paperId/reviews', () => {
  it('should submit a review and return 201 with reviewId, paperId, reviewerId, and recommendation', async () => {
    const reviewData = {
      originality: 4,
      technicalQuality: 3,
      clarity: 5,
      relevance: 4,
      recommendation: 'weak_accept',
      reviewText: 'Interesting work with some minor issues.',
      confidentialNote: 'Author may have a conflict with Reviewer X.',
    };

    const res = await request(app)
      .post(`/api/papers/${paperId}/reviews`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send(reviewData);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('reviewId');
    expect(typeof res.body.reviewId).toBe('number');
    expect(res.body.paperId).toBe(paperId);
    expect(res.body.reviewerId).toBe(reviewerId);
    expect(res.body.recommendation).toBe('weak_accept');
  });

  it('should return 403 for non-reviewer roles attempting to submit a review', async () => {
    const res = await request(app)
      .post(`/api/papers/${paperId}/reviews`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        originality: 4,
        technicalQuality: 4,
        clarity: 4,
        relevance: 4,
        recommendation: 'accept',
        reviewText: 'Nice paper.',
        confidentialNote: 'n/a',
      });

    expect(res.status).toBe(403);
  });

  it('should return 403 when the reviewer has no assignment for that paper', async () => {
    const res = await request(app)
      .post(`/api/papers/${paperId}/reviews`)
      .set('Authorization', `Bearer ${unassignedReviewerToken}`)
      .send({
        originality: 3,
        technicalQuality: 3,
        clarity: 3,
        relevance: 3,
        recommendation: 'reject',
        reviewText: 'Not good.',
        confidentialNote: 'n/a',
      });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/papers/:paperId/reviews', () => {
  it('should return all reviews with complete fields including confidentialNote for the chair', async () => {
    const res = await request(app)
      .get(`/api/papers/${paperId}/reviews`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reviews');
    expect(Array.isArray(res.body.reviews)).toBe(true);
    expect(res.body.reviews.length).toBeGreaterThan(0);

    const review = res.body.reviews[0];
    expect(review).toHaveProperty('reviewId');
    expect(review).toHaveProperty('reviewerId');
    expect(review).toHaveProperty('originality');
    expect(review).toHaveProperty('technicalQuality');
    expect(review).toHaveProperty('clarity');
    expect(review).toHaveProperty('relevance');
    expect(review).toHaveProperty('recommendation');
    expect(review).toHaveProperty('reviewText');
    expect(review).toHaveProperty('confidentialNote');
  });

  it('should persist all score fields and return matching values when retrieved by the chair', async () => {
    const conf = await createConference(chairToken, { name: 'Score Verify Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Score Verify Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'SV1', affiliation: 'SVU', email: 'sv1_rev@svu.edu' }]),
    });

    const rev = await registerUser('ScoreRev', uniqueEmail('rev_score'), 'pass123', 'reviewer');
    await setReviewerProfile(rev.token, ['AI'], []);
    await request(app)
      .post(`/api/conferences/${conf.id}/assignments`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ paperId: paper.paperId, reviewerId: rev.user.id });

    await submitReview(rev.token, paper.paperId, {
      originality: 2, technicalQuality: 5, clarity: 3, relevance: 1,
      recommendation: 'weak_reject',
      reviewText: 'Detailed feedback for verification.',
      confidentialNote: 'Chair eyes only note.',
    });

    const res = await request(app)
      .get(`/api/papers/${paper.paperId}/reviews`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(200);
    const review = res.body.reviews[0];
    expect(review.originality).toBe(2);
    expect(review.technicalQuality).toBe(5);
    expect(review.clarity).toBe(3);
    expect(review.relevance).toBe(1);
    expect(review.recommendation).toBe('weak_reject');
    expect(review.reviewText).toBe('Detailed feedback for verification.');
    expect(review.confidentialNote).toBe('Chair eyes only note.');
  });

  it('should return 403 for non-chair roles', async () => {
    const res = await request(app)
      .get(`/api/papers/${paperId}/reviews`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(403);
  });
});
