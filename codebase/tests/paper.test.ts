import request from 'supertest';
import {
  app, setupApp, registerUser, createConference, submitPaper,
  createTestPdfBuffer, recordDecision, uniqueEmail, pastISO,
} from './helpers';

let chairToken: string;
let authorToken: string;
let reviewerToken: string;
let conferenceId: number;

beforeAll(async () => {
  await setupApp();
  const chair = await registerUser('Paper Chair', uniqueEmail('paper_chair'), 'pass123', 'chair');
  chairToken = chair.token;
  const author = await registerUser('Paper Author', uniqueEmail('paper_author'), 'pass123', 'author');
  authorToken = author.token;
  const reviewer = await registerUser('Paper Reviewer', uniqueEmail('paper_rev'), 'pass123', 'reviewer');
  reviewerToken = reviewer.token;

  const conf = await createConference(chairToken, { topicAreas: ['AI', 'NLP'] });
  conferenceId = conf.id;
});

describe('POST /api/conferences/:conferenceId/papers', () => {
  it('should submit a paper via multipart form-data and return 201 with paperId, title, conferenceId, and status "submitted"', async () => {
    const res = await request(app)
      .post(`/api/conferences/${conferenceId}/papers`)
      .set('Authorization', `Bearer ${authorToken}`)
      .field('title', 'My Research Paper')
      .field('abstract', 'An abstract about research.')
      .field('authors', JSON.stringify([{ name: 'A', affiliation: 'U', email: 'a@u.edu' }]))
      .field('topicAreas', JSON.stringify(['AI']))
      .field('keywords', 'deep learning')
      .attach('file', createTestPdfBuffer(), 'paper.pdf');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('paperId');
    expect(res.body.title).toBe('My Research Paper');
    expect(res.body.conferenceId).toBe(conferenceId);
    expect(res.body.status).toBe('submitted');
  });

  it('should accept a submission without the optional keywords field', async () => {
    const res = await request(app)
      .post(`/api/conferences/${conferenceId}/papers`)
      .set('Authorization', `Bearer ${authorToken}`)
      .field('title', 'No Keywords Paper')
      .field('abstract', 'Abstract without keywords.')
      .field('authors', JSON.stringify([{ name: 'C', affiliation: 'W', email: 'c@w.edu' }]))
      .field('topicAreas', JSON.stringify(['NLP']))
      .attach('file', createTestPdfBuffer(), 'nokw.pdf');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('paperId');
    expect(res.body.status).toBe('submitted');
  });

  it('should return 403 for non-author roles attempting to submit a paper', async () => {
    const res = await request(app)
      .post(`/api/conferences/${conferenceId}/papers`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .field('title', 'Reviewer Submitted Paper')
      .field('abstract', 'Should fail.')
      .field('authors', JSON.stringify([{ name: 'X', affiliation: 'Y', email: 'x@y.edu' }]))
      .field('topicAreas', JSON.stringify(['AI']))
      .attach('file', createTestPdfBuffer(), 'fail.pdf');

    expect(res.status).toBe(403);
  });

  it('should return 403 with error message when the submission deadline has passed', async () => {
    const pastConf = await createConference(chairToken, {
      name: 'Past Deadline Conf',
      submissionDeadline: pastISO(1),
    });

    const res = await request(app)
      .post(`/api/conferences/${pastConf.id}/papers`)
      .set('Authorization', `Bearer ${authorToken}`)
      .field('title', 'Late Paper')
      .field('abstract', 'Too late.')
      .field('authors', JSON.stringify([{ name: 'B', affiliation: 'V', email: 'b@v.edu' }]))
      .field('topicAreas', JSON.stringify(['AI']))
      .attach('file', createTestPdfBuffer(), 'late.pdf');

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('Submission deadline has passed');
  });

  it('should generate a unique paperId for each submitted paper', async () => {
    const p1 = await submitPaper(authorToken, conferenceId, {
      title: 'Unique ID Paper 1',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'UID1', affiliation: 'UU', email: 'uid1@uu.edu' }]),
    });
    const p2 = await submitPaper(authorToken, conferenceId, {
      title: 'Unique ID Paper 2',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'UID2', affiliation: 'UU', email: 'uid2@uu.edu' }]),
    });

    expect(p1.paperId).toBeDefined();
    expect(p2.paperId).toBeDefined();
    expect(p1.paperId).not.toBe(p2.paperId);
  });
});

describe('GET /api/conferences/:conferenceId/papers', () => {
  it('should return all papers for the conference with full metadata when requested by chair', async () => {
    const res = await request(app)
      .get(`/api/conferences/${conferenceId}/papers`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('papers');
    expect(Array.isArray(res.body.papers)).toBe(true);
    expect(res.body.papers.length).toBeGreaterThan(0);

    const paper = res.body.papers[0];
    expect(paper).toHaveProperty('paperId');
    expect(paper).toHaveProperty('title');
    expect(paper).toHaveProperty('abstract');
    expect(paper).toHaveProperty('authors');
    expect(Array.isArray(paper.authors)).toBe(true);
    expect(paper.authors.length).toBeGreaterThan(0);
    expect(paper.authors[0]).toHaveProperty('name');
    expect(paper.authors[0]).toHaveProperty('affiliation');
    expect(paper.authors[0]).toHaveProperty('email');
    expect(paper).toHaveProperty('topicAreas');
    expect(paper).toHaveProperty('keywords');
    expect(paper).toHaveProperty('conferenceId');
    expect(paper).toHaveProperty('status');
    expect(paper).toHaveProperty('pdfUrl');
  });

  it('should return an empty array when no papers have been submitted to the conference', async () => {
    const emptyConf = await createConference(chairToken, { name: 'Empty Papers Conf' });

    const res = await request(app)
      .get(`/api/conferences/${emptyConf.id}/papers`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('papers');
    expect(Array.isArray(res.body.papers)).toBe(true);
    expect(res.body.papers.length).toBe(0);
  });

  it('should include the decision field for papers that have received a chair decision', async () => {
    const decConf = await createConference(chairToken, { name: 'Decision List Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, decConf.id);
    await recordDecision(chairToken, paper.paperId, 'accept');

    const res = await request(app)
      .get(`/api/conferences/${decConf.id}/papers`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(200);
    const found = res.body.papers.find((p: any) => p.paperId === paper.paperId);
    expect(found).toBeDefined();
    expect(found.decision).toBe('accept');
  });

  it('should return 403 for non-chair roles', async () => {
    const res = await request(app)
      .get(`/api/conferences/${conferenceId}/papers`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/papers/:paperId', () => {
  let paperId: string;

  beforeAll(async () => {
    const paper = await submitPaper(authorToken, conferenceId, {
      title: 'Visibility Test Paper',
      authors: JSON.stringify([{ name: 'Visible', affiliation: 'Uni', email: 'visible@uni.edu' }]),
    });
    paperId = paper.paperId;
  });

  it('should return the paper record with metadata and pdfUrl, and include authors for the chair role', async () => {
    const res = await request(app)
      .get(`/api/papers/${paperId}`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(200);
    expect(res.body.paperId).toBe(paperId);
    expect(res.body).toHaveProperty('title');
    expect(res.body).toHaveProperty('abstract');
    expect(res.body).toHaveProperty('topicAreas');
    expect(res.body).toHaveProperty('keywords');
    expect(res.body).toHaveProperty('conferenceId');
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('pdfUrl');
    expect(res.body).toHaveProperty('authors');
    expect(Array.isArray(res.body.authors)).toBe(true);
    expect(res.body.authors.length).toBeGreaterThan(0);
    const author = res.body.authors[0];
    expect(author).toHaveProperty('name');
    expect(author).toHaveProperty('affiliation');
    expect(author).toHaveProperty('email');
  });

  it('should include authors field when requested by the submitting author', async () => {
    const res = await request(app)
      .get(`/api/papers/${paperId}`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('authors');
  });

  it('should omit authors field when requested by a reviewer to preserve review integrity', async () => {
    const res = await request(app)
      .get(`/api/papers/${paperId}`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('authors');
  });
});
