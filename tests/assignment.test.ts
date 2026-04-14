import request from 'supertest';
import {
  app, setupApp, registerUser, createConference, submitPaper,
  setReviewerProfile, submitReview, uniqueEmail,
} from './helpers';

let chairToken: string;
let authorToken: string;
let reviewer1Token: string;
let reviewer2Token: string;
let reviewer3Token: string;
let reviewer1Id: number;
let reviewer2Id: number;
let reviewer3Id: number;
let conferenceId: number;

beforeAll(async () => {
  await setupApp();

  const chair = await registerUser('Assign Chair', uniqueEmail('asgn_chair'), 'pass123', 'chair');
  chairToken = chair.token;

  const author = await registerUser('Assign Author', uniqueEmail('asgn_author'), 'pass123', 'author');
  authorToken = author.token;

  const r1 = await registerUser('Reviewer1', uniqueEmail('asgn_r1'), 'pass123', 'reviewer');
  reviewer1Token = r1.token;
  reviewer1Id = r1.user.id;

  const r2 = await registerUser('Reviewer2', uniqueEmail('asgn_r2'), 'pass123', 'reviewer');
  reviewer2Token = r2.token;
  reviewer2Id = r2.user.id;

  const r3 = await registerUser('Reviewer3', uniqueEmail('asgn_r3'), 'pass123', 'reviewer');
  reviewer3Token = r3.token;
  reviewer3Id = r3.user.id;

  const conf = await createConference(chairToken, {
    name: 'Assignment Conf',
    topicAreas: ['AI', 'NLP', 'Robotics'],
  });
  conferenceId = conf.id;
});

describe('POST /api/conferences/:conferenceId/assign (auto-assignment)', () => {
  it('should assign reviewers whose expertise overlaps with paper topic areas and return assignments with assignmentId, paperId, and reviewerId', async () => {
    const conf = await createConference(chairToken, { name: 'Overlap Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'AI Paper for Assignment',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'A1', affiliation: 'U1', email: 'a1_asgn@u.edu' }]),
    });

    await setReviewerProfile(reviewer1Token, ['AI'], []);

    const res = await request(app)
      .post(`/api/conferences/${conf.id}/assign`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ reviewersPerPaper: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('assignments');
    expect(Array.isArray(res.body.assignments)).toBe(true);

    const assignment = res.body.assignments.find((a: any) => a.paperId === paper.paperId);
    expect(assignment).toBeDefined();
    expect(assignment).toHaveProperty('assignmentId');
    expect(typeof assignment.assignmentId).toBe('number');
    expect(assignment).toHaveProperty('paperId');
    expect(assignment).toHaveProperty('reviewerId');
  });

  it('should not assign a reviewer whose expertise does not overlap with the paper topic areas', async () => {
    const conf = await createConference(chairToken, { name: 'No Overlap Conf', topicAreas: ['Quantum Computing'] });
    await submitPaper(authorToken, conf.id, {
      title: 'Quantum Paper',
      topicAreas: JSON.stringify(['Quantum Computing']),
      authors: JSON.stringify([{ name: 'Q1', affiliation: 'QU', email: 'q1@qu.edu' }]),
    });

    await setReviewerProfile(reviewer2Token, ['Robotics'], []);

    const res = await request(app)
      .post(`/api/conferences/${conf.id}/assign`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ reviewersPerPaper: 1 });

    expect(res.status).toBe(200);
    const r2Assignments = res.body.assignments.filter((a: any) => a.reviewerId === reviewer2Id);
    expect(r2Assignments.length).toBe(0);
  });

  it('should not assign a reviewer who has a declared conflict with any of the paper authors', async () => {
    const conflictEmail = 'conflict_author_asgn@test.edu';
    const conf = await createConference(chairToken, { name: 'Conflict Test Conf', topicAreas: ['AI'] });
    await submitPaper(authorToken, conf.id, {
      title: 'Conflict Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'Conflicted', affiliation: 'CU', email: conflictEmail }]),
    });

    await setReviewerProfile(reviewer3Token, ['AI'], [conflictEmail]);

    const res = await request(app)
      .post(`/api/conferences/${conf.id}/assign`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ reviewersPerPaper: 1 });

    expect(res.status).toBe(200);
    const r3Assignments = res.body.assignments.filter((a: any) => a.reviewerId === reviewer3Id);
    expect(r3Assignments.length).toBe(0);
  });

  it('should list papers with zero eligible reviewers in unassignedPaperIds', async () => {
    const conf = await createConference(chairToken, { name: 'Unassigned Conf', topicAreas: ['Astrobiology'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Lonely Paper',
      topicAreas: JSON.stringify(['Astrobiology']),
      authors: JSON.stringify([{ name: 'L1', affiliation: 'LU', email: 'l1@lu.edu' }]),
    });

    const res = await request(app)
      .post(`/api/conferences/${conf.id}/assign`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ reviewersPerPaper: 1 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('unassignedPaperIds');
    expect(Array.isArray(res.body.unassignedPaperIds)).toBe(true);
    expect(res.body.unassignedPaperIds).toContain(paper.paperId);
  });

  it('should list papers that received fewer than reviewersPerPaper eligible reviewers in underAssignedPaperIds', async () => {
    const conf = await createConference(chairToken, { name: 'UnderAssign Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Under Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'U1', affiliation: 'UU', email: 'u1_under@uu.edu' }]),
    });

    await setReviewerProfile(reviewer1Token, ['AI'], []);

    const res = await request(app)
      .post(`/api/conferences/${conf.id}/assign`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ reviewersPerPaper: 3 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('underAssignedPaperIds');
    expect(Array.isArray(res.body.underAssignedPaperIds)).toBe(true);
    expect(res.body.underAssignedPaperIds).toContain(paper.paperId);
  });

  it('should default reviewersPerPaper to 3 when the body does not specify it', async () => {
    const conf = await createConference(chairToken, { name: 'Default RPP Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Default RPP Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'D1', affiliation: 'DU', email: 'd1_def@du.edu' }]),
    });

    await setReviewerProfile(reviewer1Token, ['AI'], []);

    const res = await request(app)
      .post(`/api/conferences/${conf.id}/assign`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(200);
    expect(res.body.underAssignedPaperIds).toContain(paper.paperId);
  });

  it('should distribute assignments as evenly as possible across eligible reviewers', async () => {
    const conf = await createConference(chairToken, { name: 'Balance Conf', topicAreas: ['AI'] });

    for (let i = 0; i < 3; i++) {
      await submitPaper(authorToken, conf.id, {
        title: `Balance Paper ${i}`,
        topicAreas: JSON.stringify(['AI']),
        authors: JSON.stringify([{ name: `BP${i}`, affiliation: 'BU', email: `bp${i}_bal@bu.edu` }]),
      });
    }

    const revs = [];
    for (let i = 0; i < 3; i++) {
      const r = await registerUser(`BalRev${i}`, uniqueEmail(`asgn_balrev${i}`), 'pass123', 'reviewer');
      await setReviewerProfile(r.token, ['AI'], []);
      revs.push(r);
    }

    const res = await request(app)
      .post(`/api/conferences/${conf.id}/assign`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ reviewersPerPaper: 1 });

    expect(res.status).toBe(200);

    const loadMap: Record<number, number> = {};
    for (const a of res.body.assignments) {
      loadMap[a.reviewerId] = (loadMap[a.reviewerId] || 0) + 1;
    }
    const loads = Object.values(loadMap);
    const maxLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);
    expect(maxLoad - minLoad).toBeLessThanOrEqual(1);
  });

  it('should produce the same assignment count when auto-assign is re-run, replacing previous auto assignments', async () => {
    const conf = await createConference(chairToken, { name: 'Idempotent Conf', topicAreas: ['AI'] });

    for (let i = 0; i < 2; i++) {
      await submitPaper(authorToken, conf.id, {
        title: `Idempotent Paper ${i}`,
        topicAreas: JSON.stringify(['AI']),
        authors: JSON.stringify([{ name: `IP${i}`, affiliation: 'IU', email: `ip${i}_idem@iu.edu` }]),
      });
    }

    const rev = await registerUser('IdempRev', uniqueEmail('asgn_idemrev'), 'pass123', 'reviewer');
    await setReviewerProfile(rev.token, ['AI'], []);

    const res1 = await request(app)
      .post(`/api/conferences/${conf.id}/assign`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ reviewersPerPaper: 1 });

    expect(res1.status).toBe(200);
    const firstCount = res1.body.assignments.length;
    expect(firstCount).toBeGreaterThan(0);

    const res2 = await request(app)
      .post(`/api/conferences/${conf.id}/assign`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ reviewersPerPaper: 1 });

    expect(res2.status).toBe(200);
    expect(res2.body.assignments.length).toBe(firstCount);
  });

  it('should count existing manual assignments toward the reviewersPerPaper target', async () => {
    const conf = await createConference(chairToken, { name: 'ManualCount Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'ManualCount Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'MC1', affiliation: 'MCU', email: 'mc1_cnt@mcu.edu' }]),
    });

    const rev1 = await registerUser('CountRev1', uniqueEmail('asgn_cntrev1'), 'pass123', 'reviewer');
    const rev2 = await registerUser('CountRev2', uniqueEmail('asgn_cntrev2'), 'pass123', 'reviewer');
    await setReviewerProfile(rev1.token, ['AI'], []);
    await setReviewerProfile(rev2.token, ['AI'], []);

    await request(app)
      .post(`/api/conferences/${conf.id}/assignments`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ paperId: paper.paperId, reviewerId: rev1.user.id });

    const res = await request(app)
      .post(`/api/conferences/${conf.id}/assign`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ reviewersPerPaper: 2 });

    expect(res.status).toBe(200);
    expect(res.body.underAssignedPaperIds || []).not.toContain(paper.paperId);
    expect(res.body.unassignedPaperIds || []).not.toContain(paper.paperId);
  });

  it('should assign up to reviewersPerPaper eligible reviewers to each paper', async () => {
    const conf = await createConference(chairToken, { name: 'Exact RPP Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Exact RPP Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'ER1', affiliation: 'ERU', email: 'er1_rpp@eru.edu' }]),
    });

    for (let i = 0; i < 3; i++) {
      const r = await registerUser(`RPPRev${i}`, uniqueEmail(`asgn_rpprev${i}`), 'pass123', 'reviewer');
      await setReviewerProfile(r.token, ['AI'], []);
    }

    const res = await request(app)
      .post(`/api/conferences/${conf.id}/assign`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ reviewersPerPaper: 2 });

    expect(res.status).toBe(200);
    const paperAssignments = res.body.assignments.filter((a: any) => a.paperId === paper.paperId);
    expect(paperAssignments.length).toBe(2);
  });

  it('should return 403 for non-chair roles', async () => {
    const res = await request(app)
      .post(`/api/conferences/${conferenceId}/assign`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(403);
  });
});

describe('Re-running auto-assign preserves manual assignments', () => {
  it('should keep manually-created assignments intact when auto-assign is re-run', async () => {
    const conf = await createConference(chairToken, { name: 'Rerun Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Rerun Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'R1', affiliation: 'RU', email: 'r1_rerun@ru.edu' }]),
    });

    await setReviewerProfile(reviewer1Token, ['AI'], []);
    await setReviewerProfile(reviewer2Token, ['AI'], []);

    const manualRes = await request(app)
      .post(`/api/conferences/${conf.id}/assignments`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ paperId: paper.paperId, reviewerId: reviewer2Id });
    expect(manualRes.status).toBe(201);

    await request(app)
      .post(`/api/conferences/${conf.id}/assign`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ reviewersPerPaper: 2 });

    const reviewerAssignments = await request(app)
      .get('/api/reviewers/assignments')
      .set('Authorization', `Bearer ${reviewer2Token}`);

    const stillAssigned = reviewerAssignments.body.assignments.some(
      (a: any) => a.paperId === paper.paperId
    );
    expect(stillAssigned).toBe(true);
  });
});

describe('POST /api/conferences/:conferenceId/assignments (manual)', () => {
  it('should create a manual assignment and return 201 with assignmentId, paperId, and reviewerId', async () => {
    const conf = await createConference(chairToken, { name: 'Manual Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Manual Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'M1', affiliation: 'MU', email: 'm1_manual@mu.edu' }]),
    });

    const res = await request(app)
      .post(`/api/conferences/${conf.id}/assignments`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ paperId: paper.paperId, reviewerId: reviewer1Id });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('assignmentId');
    expect(typeof res.body.assignmentId).toBe('number');
    expect(res.body.paperId).toBe(paper.paperId);
    expect(res.body.reviewerId).toBe(reviewer1Id);
  });

  it('should return 403 for non-chair roles', async () => {
    const res = await request(app)
      .post(`/api/conferences/${conferenceId}/assignments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ paperId: 'any', reviewerId: reviewer1Id });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/conferences/:conferenceId/assignments/:assignmentId', () => {
  it('should delete an assignment and return 200 with a message', async () => {
    const conf = await createConference(chairToken, { name: 'Delete Assign Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Delete Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'D1', affiliation: 'DU', email: 'd1_del@du.edu' }]),
    });
    const manual = await request(app)
      .post(`/api/conferences/${conf.id}/assignments`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ paperId: paper.paperId, reviewerId: reviewer1Id });

    const res = await request(app)
      .delete(`/api/conferences/${conf.id}/assignments/${manual.body.assignmentId}`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });

  it('should return 404 when the assignment does not exist', async () => {
    const res = await request(app)
      .delete(`/api/conferences/${conferenceId}/assignments/999999`)
      .set('Authorization', `Bearer ${chairToken}`);

    expect(res.status).toBe(404);
  });

  it('should return 403 for non-chair roles', async () => {
    const res = await request(app)
      .delete(`/api/conferences/${conferenceId}/assignments/1`)
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/reviewers/assignments', () => {
  it('should return assigned papers with paperId, title, conferenceId, pdfUrl, and reviewed boolean', async () => {
    const conf = await createConference(chairToken, { name: 'Dashboard Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Dashboard Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'DB1', affiliation: 'DBU', email: 'db1@dbu.edu' }]),
    });

    const newReviewer = await registerUser('DashRev', uniqueEmail('asgn_dashrev'), 'pass123', 'reviewer');
    await setReviewerProfile(newReviewer.token, ['AI'], []);

    await request(app)
      .post(`/api/conferences/${conf.id}/assignments`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ paperId: paper.paperId, reviewerId: newReviewer.user.id });

    const res = await request(app)
      .get('/api/reviewers/assignments')
      .set('Authorization', `Bearer ${newReviewer.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('assignments');
    expect(Array.isArray(res.body.assignments)).toBe(true);

    const assigned = res.body.assignments.find((a: any) => a.paperId === paper.paperId);
    expect(assigned).toBeDefined();
    expect(assigned).toHaveProperty('paperId');
    expect(assigned).toHaveProperty('title');
    expect(assigned).toHaveProperty('conferenceId');
    expect(assigned).toHaveProperty('pdfUrl');
    expect(assigned.reviewed).toBe(false);
  });

  it('should set reviewed to true after a review is submitted for the assigned paper', async () => {
    const conf = await createConference(chairToken, { name: 'Reviewed Flag Conf', topicAreas: ['AI'] });
    const paper = await submitPaper(authorToken, conf.id, {
      title: 'Reviewed Flag Paper',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'RF1', affiliation: 'RFU', email: 'rf1@rfu.edu' }]),
    });

    const rev = await registerUser('RevFlagUser', uniqueEmail('asgn_revflag'), 'pass123', 'reviewer');
    await setReviewerProfile(rev.token, ['AI'], []);

    await request(app)
      .post(`/api/conferences/${conf.id}/assignments`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ paperId: paper.paperId, reviewerId: rev.user.id });

    await submitReview(rev.token, paper.paperId);

    const res = await request(app)
      .get('/api/reviewers/assignments')
      .set('Authorization', `Bearer ${rev.token}`);

    const assigned = res.body.assignments.find((a: any) => a.paperId === paper.paperId);
    expect(assigned.reviewed).toBe(true);
  });

  it('should return assignments from multiple conferences for a single reviewer', async () => {
    const conf1 = await createConference(chairToken, { name: 'Multi Conf 1', topicAreas: ['AI'] });
    const conf2 = await createConference(chairToken, { name: 'Multi Conf 2', topicAreas: ['AI'] });

    const paper1 = await submitPaper(authorToken, conf1.id, {
      title: 'Multi Paper 1',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'MP1', affiliation: 'MPU', email: 'mp1_multi@mpu.edu' }]),
    });
    const paper2 = await submitPaper(authorToken, conf2.id, {
      title: 'Multi Paper 2',
      topicAreas: JSON.stringify(['AI']),
      authors: JSON.stringify([{ name: 'MP2', affiliation: 'MPU', email: 'mp2_multi@mpu.edu' }]),
    });

    const rev = await registerUser('MultiRev', uniqueEmail('asgn_multirev'), 'pass123', 'reviewer');
    await setReviewerProfile(rev.token, ['AI'], []);

    await request(app)
      .post(`/api/conferences/${conf1.id}/assignments`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ paperId: paper1.paperId, reviewerId: rev.user.id });
    await request(app)
      .post(`/api/conferences/${conf2.id}/assignments`)
      .set('Authorization', `Bearer ${chairToken}`)
      .send({ paperId: paper2.paperId, reviewerId: rev.user.id });

    const res = await request(app)
      .get('/api/reviewers/assignments')
      .set('Authorization', `Bearer ${rev.token}`);

    expect(res.status).toBe(200);
    const paperIds = res.body.assignments.map((a: any) => a.paperId);
    expect(paperIds).toContain(paper1.paperId);
    expect(paperIds).toContain(paper2.paperId);
  });

  it('should return 403 for non-reviewer roles', async () => {
    const res = await request(app)
      .get('/api/reviewers/assignments')
      .set('Authorization', `Bearer ${authorToken}`);

    expect(res.status).toBe(403);
  });
});
