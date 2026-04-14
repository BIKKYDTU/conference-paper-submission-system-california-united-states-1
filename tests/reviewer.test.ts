import request from 'supertest';
import { app, setupApp, registerUser, uniqueEmail } from './helpers';

let reviewerToken: string;
let authorToken: string;

beforeAll(async () => {
  await setupApp();
  const reviewer = await registerUser('Rev Profile', uniqueEmail('rev_profile'), 'pass123', 'reviewer');
  reviewerToken = reviewer.token;
  const author = await registerUser('Rev Author', uniqueEmail('rev_prof_author'), 'pass123', 'author');
  authorToken = author.token;
});

describe('PUT /api/reviewers/profile', () => {
  it('should save the reviewer profile and return 200 with reviewerId, expertise array, and conflicts array', async () => {
    const res = await request(app)
      .put('/api/reviewers/profile')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        expertise: ['AI', 'Robotics'],
        conflicts: ['conflicted@university.edu'],
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reviewerId');
    expect(typeof res.body.reviewerId).toBe('number');
    expect(res.body.expertise).toEqual(expect.arrayContaining(['AI', 'Robotics']));
    expect(res.body.conflicts).toEqual(expect.arrayContaining(['conflicted@university.edu']));
  });

  it('should return 403 for non-reviewer roles', async () => {
    const res = await request(app)
      .put('/api/reviewers/profile')
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ expertise: ['AI'], conflicts: [] });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/reviewers/profile', () => {
  it('should return the authenticated reviewer stored expertise and conflicts arrays', async () => {
    await request(app)
      .put('/api/reviewers/profile')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        expertise: ['NLP', 'CV'],
        conflicts: ['rival@uni.edu'],
      });

    const res = await request(app)
      .get('/api/reviewers/profile')
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('reviewerId');
    expect(res.body.expertise).toEqual(expect.arrayContaining(['NLP', 'CV']));
    expect(res.body.conflicts).toEqual(expect.arrayContaining(['rival@uni.edu']));
  });

  it('should return 403 for non-reviewer roles', async () => {
    const res = await request(app)
      .get('/api/reviewers/profile')
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(403);
  });
});
