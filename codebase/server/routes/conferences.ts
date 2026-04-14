import { Router, Response } from 'express';
import { getDb } from '../database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { assignReviewers } from '../services/assignment';

const router = Router();

router.post('/', authenticate, authorize('chair'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const { name, description, submissionDeadline, notificationDate, cameraReadyDeadline, topicAreas, submissionGuidelines } = req.body;

    const stmt = db.prepare(
      'INSERT INTO conferences (name, description, submissionDeadline, notificationDate, cameraReadyDeadline, topicAreas, submissionGuidelines) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(name, description, submissionDeadline, notificationDate, cameraReadyDeadline, JSON.stringify(topicAreas), submissionGuidelines);

    res.status(201).json({
      id: result.lastInsertRowid as number,
      name,
      description,
      submissionDeadline,
      notificationDate,
      cameraReadyDeadline,
      topicAreas,
      submissionGuidelines,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create conference' });
  }
});

router.get('/:id', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const conference = db.prepare('SELECT * FROM conferences WHERE id = ?').get(req.params.id) as any;

    if (!conference) {
      res.status(404).json({ error: 'Conference not found' });
      return;
    }

    res.status(200).json({
      id: conference.id,
      name: conference.name,
      description: conference.description,
      submissionDeadline: conference.submissionDeadline,
      notificationDate: conference.notificationDate,
      cameraReadyDeadline: conference.cameraReadyDeadline,
      topicAreas: JSON.parse(conference.topicAreas),
      submissionGuidelines: conference.submissionGuidelines,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get conference' });
  }
});

router.post('/:conferenceId/assign', authenticate, authorize('chair'), async (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const conferenceId = parseInt(req.params.conferenceId);
    const reviewersPerPaper = req.body?.reviewersPerPaper ?? 3;

    db.prepare("DELETE FROM assignments WHERE conferenceId = ? AND source = 'auto'").run(conferenceId);

    const result = await assignReviewers(conferenceId, reviewersPerPaper);

    const assignmentsWithIds = result.assignments.map(a => {
      const row = db.prepare(
        'SELECT id FROM assignments WHERE paperId = ? AND reviewerId = ? AND conferenceId = ?'
      ).get(a.paperId, a.reviewerId, conferenceId) as any;

      return {
        assignmentId: row.id,
        paperId: a.paperId,
        reviewerId: a.reviewerId,
      };
    });

    res.status(200).json({
      assignments: assignmentsWithIds,
      underAssignedPaperIds: result.underAssignedPaperIds,
      unassignedPaperIds: result.unassignedPaperIds,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to assign reviewers' });
  }
});

router.post('/:conferenceId/assignments', authenticate, authorize('chair'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const conferenceId = parseInt(req.params.conferenceId);
    const { paperId, reviewerId } = req.body;

    const stmt = db.prepare(
      "INSERT INTO assignments (paperId, reviewerId, conferenceId, source) VALUES (?, ?, ?, 'manual')"
    );
    const result = stmt.run(paperId, reviewerId, conferenceId);

    res.status(201).json({
      assignmentId: result.lastInsertRowid as number,
      paperId,
      reviewerId,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create manual assignment' });
  }
});

router.delete('/:conferenceId/assignments/:assignmentId', authenticate, authorize('chair'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const conferenceId = parseInt(req.params.conferenceId);
    const assignmentId = parseInt(req.params.assignmentId);

    const assignment = db.prepare(
      'SELECT id FROM assignments WHERE id = ? AND conferenceId = ?'
    ).get(assignmentId, conferenceId);

    if (!assignment) {
      res.status(404).json({ error: 'Assignment not found' });
      return;
    }

    db.prepare('DELETE FROM assignments WHERE id = ?').run(assignmentId);
    res.status(200).json({ message: 'Assignment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

router.get('/:conferenceId/stats', authenticate, authorize('chair'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const conferenceId = parseInt(req.params.conferenceId);

    const papers = db.prepare('SELECT paperId FROM papers WHERE conferenceId = ?').all(conferenceId) as Array<{ paperId: string }>;
    const totalPapers = papers.length;

    const acceptedRow = db.prepare(`
      SELECT COUNT(*) as count FROM decisions d
      JOIN papers p ON d.paperId = p.paperId
      WHERE p.conferenceId = ? AND d.decision = 'accept'
    `).get(conferenceId) as any;
    const accepted = acceptedRow.count;

    const rejectedRow = db.prepare(`
      SELECT COUNT(*) as count FROM decisions d
      JOIN papers p ON d.paperId = p.paperId
      WHERE p.conferenceId = ? AND d.decision = 'reject'
    `).get(conferenceId) as any;
    const rejected = rejectedRow.count;

    const acceptanceRate = totalPapers > 0 ? accepted / totalPapers : 0;

    const reviews = db.prepare(`
      SELECT r.originality, r.technicalQuality, r.clarity, r.relevance
      FROM reviews r
      JOIN papers p ON r.paperId = p.paperId
      WHERE p.conferenceId = ?
    `).all(conferenceId) as Array<{
      originality: number;
      technicalQuality: number;
      clarity: number;
      relevance: number;
    }>;

    const scoreDistributions = {
      originality: reviews.map(r => r.originality),
      technicalQuality: reviews.map(r => r.technicalQuality),
      clarity: reviews.map(r => r.clarity),
      relevance: reviews.map(r => r.relevance),
    };

    res.status(200).json({
      totalPapers,
      accepted,
      rejected,
      acceptanceRate,
      scoreDistributions,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

router.post('/:conferenceId/program', authenticate, authorize('chair'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const conferenceId = parseInt(req.params.conferenceId);
    const { sessions } = req.body;

    const insertSession = db.prepare(
      'INSERT INTO sessions (conferenceId, sessionName, startTime, endTime, room) VALUES (?, ?, ?, ?, ?)'
    );
    const insertSessionPaper = db.prepare(
      'INSERT INTO session_papers (sessionId, paperId) VALUES (?, ?)'
    );

    const resultSessions: any[] = [];

    const insertAll = db.transaction(() => {
      for (const session of sessions) {
        const result = insertSession.run(conferenceId, session.sessionName, session.startTime, session.endTime, session.room);
        const sessionId = result.lastInsertRowid as number;

        const sessionPapers: Array<{ paperId: string; title: string }> = [];
        for (const pid of session.paperIds) {
          insertSessionPaper.run(sessionId, pid);
          const paper = db.prepare('SELECT title FROM papers WHERE paperId = ?').get(pid) as any;
          sessionPapers.push({ paperId: pid, title: paper?.title || '' });
        }

        resultSessions.push({
          sessionId,
          sessionName: session.sessionName,
          startTime: session.startTime,
          endTime: session.endTime,
          room: session.room,
          papers: sessionPapers,
        });
      }
    });

    insertAll();

    res.status(201).json({ conferenceId, sessions: resultSessions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create program' });
  }
});

router.get('/:conferenceId/program', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const conferenceId = parseInt(req.params.conferenceId);

    const sessions = db.prepare(
      'SELECT * FROM sessions WHERE conferenceId = ?'
    ).all(conferenceId) as Array<{
      id: number;
      conferenceId: number;
      sessionName: string;
      startTime: string;
      endTime: string;
      room: string;
    }>;

    const result = sessions.map(s => {
      const sessionPapers = db.prepare(`
        SELECT sp.paperId, p.title
        FROM session_papers sp
        JOIN papers p ON sp.paperId = p.paperId
        WHERE sp.sessionId = ?
      `).all(s.id) as Array<{ paperId: string; title: string }>;

      return {
        sessionId: s.id,
        sessionName: s.sessionName,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room,
        papers: sessionPapers,
      };
    });

    res.status(200).json({ conferenceId, sessions: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get program' });
  }
});

export default router;
