import request from 'supertest';
import {
  app, setupApp, registerUser, createConference, submitPaper,
  recordDecision, uniqueEmail,
} from './helpers';

let chairToken: string;
let authorToken: string;
let reviewerToken: string;
let conferenceId: number;
let acceptedPaperId1: string;
let acceptedPaperId2: string;
let acceptedTitle1: string;
let acceptedTitle2: string;

beforeAll(async () => {
  await setupApp();

  const chair = await registerUser('Prog Chair', uniqueEmail('prog_chair'), 'pass123', 'chair');
  chairToken = chair.token;

  const author = await registerUser('Prog Author', uniqueEmail('prog_author'), 'pass123', 'author');
  authorToken = author.token;

  const reviewer = await registerUser('Prog Reviewer', uniqueEmail('prog_reviewer'), 'pass123', 'reviewer');
  reviewerToken = reviewer.token;

  const conf = await createConference(chairToken, { name: 'Program Conf', topicAreas: ['AI', 'NLP'] });
  conferenceId = conf.id;

  acceptedTitle1 = 'Accepted Program Paper 1';
  acceptedTitle2 = 'Accepted Program Paper 2';

  const p1 = await submitPaper(authorToken, conferenceId, {
    title: acceptedTitle1,
    topicAreas: JSON.stringify(['AI']),
    authors: JSON.stringify([{ name: 'PP1', affiliation: 'PU', email: 'pp1_prog@pu.edu' }]),
  });
  acceptedPaperId1 = p1.paperId;

  const p2 = await submitPaper(authorToken, conferenceId, {
    title: acceptedTitle2,
    topicAreas: JSON.stringify(['NLP']),
    authors: JSON.stringify([{ name: 'PP2', affiliation: 'PU', email: 'pp2_prog@pu.edu' }]),
  });
  acceptedPaperId2 = p2.paperId;

  await recordDecision(chairToken, acceptedPaperId1, 'accept');
  await recordDecision(chairToken, acceptedPaperId2, 'accept');
});

describe('POST /api/conferences/:conferenceId/program', () => {
  it('should create conference sessions and return 201 with conferenceId, sessions containing sessionId, details, and paper titles', async () => {
    const sessions = [
      {
        sessionName: 'Morning AI Session',
        startTime: '2026-07-01T09:00:00Z',
        endTime: '2026-07-01T10:30:00Z',
        room: 'Room A',
        paperIds: [acceptedPaperId1],
      },
      {
        sessionName: 'Afternoon NLP Session',
        startTime: '2026-07-01T14:00:00Z',
        endTime: '2026-07-01T15:30:00Z',
        room: 'Room B',
        paperIds: [acceptedPaperId2],
      },
    ];

    const res = await request(app)
      .post(`/api/conferences/${conferenceId}/program`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ sessions });

    expect(res.status).toBe(201);
    expect(res.body.conferenceId).toBe(conferenceId);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBe(2);

    const session1 = res.body.sessions.find((s: any) => s.sessionName === 'Morning AI Session');
    expect(session1).toBeDefined();
    expect(session1).toHaveProperty('sessionId');
    expect(typeof session1.sessionId).toBe('number');
    expect(session1).toHaveProperty('startTime');
    expect(session1).toHaveProperty('endTime');
    expect(session1.room).toBe('Room A');
    expect(Array.isArray(session1.papers)).toBe(true);

    const paperInSession = session1.papers.find((p: any) => p.paperId === acceptedPaperId1);
    expect(paperInSession).toBeDefined();
    expect(paperInSession.title).toBe(acceptedTitle1);
  });

  it('should return 403 for non-chair roles', async () => {
    const res = await request(app)
      .post(`/api/conferences/${conferenceId}/program`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({
        sessions: [{
          sessionName: 'Unauthorized',
          startTime: '2026-07-01T09:00:00Z',
          endTime: '2026-07-01T10:30:00Z',
          room: 'X',
          paperIds: [],
        }],
      });

    expect(res.status).toBe(403);
  });
});

describe('GET /api/conferences/:conferenceId/program', () => {
  it('should return the full conference program with sessions and associated paper details', async () => {
    const progConf = await createConference(chairToken, { name: 'Get Program Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, progConf.id, {
      title: 'Get Program Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'GP1', affiliation: 'GPU', email: 'gp1_prog@gpu.edu' }]),
    });
    await recordDecision(chairToken, paper.paperId, 'accept');

    await request(app)
      .post(`/api/conferences/${progConf.id}/program`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({
        sessions: [{
          sessionName: 'Keynote',
          startTime: '2026-08-01T09:00:00Z',
          endTime: '2026-08-01T10:00:00Z',
          room: 'Main Hall',
          paperIds: [paper.paperId],
        }],
      });

    const res = await request(app)
      .get(`/api/conferences/${progConf.id}/program`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.conferenceId).toBe(progConf.id);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions.length).toBe(1);

    const session = res.body.sessions[0];
    expect(session).toHaveProperty('sessionId');
    expect(session.sessionName).toBe('Keynote');
    expect(session).toHaveProperty('startTime');
    expect(session).toHaveProperty('endTime');
    expect(session).toHaveProperty('room');
    expect(Array.isArray(session.papers)).toBe(true);
    expect(session.papers[0]).toHaveProperty('paperId');
    expect(session.papers[0]).toHaveProperty('title');
  });

  it('should be accessible by any authenticated user including reviewers', async () => {
    const progConf = await createConference(chairToken, { name: 'Reviewer Program Conf', topicAreas: ['AI'] });

    await request(app)
      .post(`/api/conferences/${progConf.id}/program`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ sessions: [] });

    const res = await request(app)
      .get(`/api/conferences/${progConf.id}/program`)
      .set('Authorization', `Bearer ${reviewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.conferenceId).toBe(progConf.id);
  });
});
