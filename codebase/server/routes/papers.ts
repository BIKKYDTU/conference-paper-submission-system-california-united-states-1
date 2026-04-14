import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads'));
  },
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

router.post('/conferences/:conferenceId/papers', authenticate, authorize('author'), upload.single('file'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const conferenceId = parseInt(req.params.conferenceId);
    const submitterId = req.user!.id;

    const conference = db.prepare('SELECT submissionDeadline FROM conferences WHERE id = ?').get(conferenceId) as any;
    if (!conference) {
      res.status(404).json({ error: 'Conference not found' });
      return;
    }

    if (new Date() > new Date(conference.submissionDeadline)) {
      res.status(403).json({ error: 'Submission deadline has passed' });
      return;
    }

    const { title, abstract, authors, topicAreas, keywords } = req.body;
    const paperId = uuidv4();
    const pdfUrl = `/uploads/${req.file!.filename}`;

    db.prepare(
      'INSERT INTO papers (paperId, title, abstract, authors, topicAreas, keywords, conferenceId, status, pdfUrl, submitterId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(paperId, title, abstract, authors, topicAreas, keywords || '', conferenceId, 'submitted', pdfUrl, submitterId);

    res.status(201).json({
      paperId,
      title,
      conferenceId,
      status: 'submitted',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit paper' });
  }
});

router.get('/conferences/:conferenceId/papers', authenticate, authorize('chair'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const conferenceId = parseInt(req.params.conferenceId);

    const papers = db.prepare('SELECT * FROM papers WHERE conferenceId = ?').all(conferenceId) as any[];

    const result = papers.map(p => {
      const decision = db.prepare('SELECT decision FROM decisions WHERE paperId = ?').get(p.paperId) as any;
      return {
        paperId: p.paperId,
        title: p.title,
        abstract: p.abstract,
        authors: JSON.parse(p.authors),
        topicAreas: JSON.parse(p.topicAreas),
        keywords: p.keywords,
        conferenceId: p.conferenceId,
        status: p.status,
        decision: decision?.decision,
        pdfUrl: p.pdfUrl,
      };
    });

    res.status(200).json({ papers: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get papers' });
  }
});

router.get('/papers/:paperId', authenticate, (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const paper = db.prepare('SELECT * FROM papers WHERE paperId = ?').get(req.params.paperId) as any;

    if (!paper) {
      res.status(404).json({ error: 'Paper not found' });
      return;
    }

    const response: any = {
      paperId: paper.paperId,
      title: paper.title,
      abstract: paper.abstract,
      topicAreas: JSON.parse(paper.topicAreas),
      keywords: paper.keywords,
      conferenceId: paper.conferenceId,
      status: paper.status,
      pdfUrl: paper.pdfUrl,
    };

    const userRole = req.user!.role;
    const userId = req.user!.id;

    if (userRole === 'chair' || userId === paper.submitterId) {
      response.authors = JSON.parse(paper.authors);
    }

    res.status(200).json(response);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get paper' });
  }
});

router.post('/papers/:paperId/reviews', authenticate, authorize('reviewer'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const paperId = req.params.paperId;
    const reviewerId = req.user!.id;

    const assignment = db.prepare(
      'SELECT id FROM assignments WHERE paperId = ? AND reviewerId = ?'
    ).get(paperId, reviewerId);

    if (!assignment) {
      res.status(403).json({ error: 'No assignment found for this paper' });
      return;
    }

    const { originality, technicalQuality, clarity, relevance, recommendation, reviewText, confidentialNote } = req.body;

    const result = db.prepare(
      'INSERT INTO reviews (paperId, reviewerId, originality, technicalQuality, clarity, relevance, recommendation, reviewText, confidentialNote) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(paperId, reviewerId, originality, technicalQuality, clarity, relevance, recommendation, reviewText, confidentialNote);

    res.status(201).json({
      reviewId: result.lastInsertRowid as number,
      paperId,
      reviewerId,
      recommendation,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

router.get('/papers/:paperId/reviews', authenticate, authorize('chair'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const paperId = req.params.paperId;

    const reviews = db.prepare(
      'SELECT id as reviewId, reviewerId, originality, technicalQuality, clarity, relevance, recommendation, reviewText, confidentialNote FROM reviews WHERE paperId = ?'
    ).all(paperId) as any[];

    res.status(200).json({ reviews });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get reviews' });
  }
});

router.post('/papers/:paperId/decision', authenticate, authorize('chair'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const paperId = req.params.paperId;
    const { decision } = req.body;

    const existingDecision = db.prepare('SELECT paperId FROM decisions WHERE paperId = ?').get(paperId);
    if (existingDecision) {
      db.prepare('UPDATE decisions SET decision = ? WHERE paperId = ?').run(decision, paperId);
    } else {
      db.prepare('INSERT INTO decisions (paperId, decision) VALUES (?, ?)').run(paperId, decision);
    }

    const newStatus = decision === 'accept' ? 'accepted' : 'rejected';
    db.prepare('UPDATE papers SET status = ? WHERE paperId = ?').run(newStatus, paperId);

    res.status(200).json({
      paperId,
      decision,
      status: newStatus,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record decision' });
  }
});

router.get('/papers/:paperId/notification', authenticate, authorize('author'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const paperId = req.params.paperId;
    const userId = req.user!.id;

    const paper = db.prepare('SELECT submitterId FROM papers WHERE paperId = ?').get(paperId) as any;
    if (!paper || paper.submitterId !== userId) {
      res.status(403).json({ error: 'Not authorized to view this notification' });
      return;
    }

    const decisionRow = db.prepare('SELECT decision FROM decisions WHERE paperId = ?').get(paperId) as any;
    const decision = decisionRow?.decision || 'pending';
    const decisionFinal = decision !== 'pending';

    const reviews = db.prepare(
      'SELECT reviewText, originality, technicalQuality, clarity, relevance, recommendation FROM reviews WHERE paperId = ?'
    ).all(paperId) as any[];

    res.status(200).json({
      paperId,
      decision,
      decisionFinal,
      reviews,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get notification' });
  }
});

router.get('/papers/:paperId/reviews-for-rebuttal', authenticate, authorize('author'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const paperId = req.params.paperId;
    const userId = req.user!.id;

    const paper = db.prepare('SELECT submitterId, conferenceId FROM papers WHERE paperId = ?').get(paperId) as any;
    if (!paper || paper.submitterId !== userId) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const decisionRow = db.prepare('SELECT decision FROM decisions WHERE paperId = ?').get(paperId) as any;
    if (decisionRow) {
      res.status(403).json({ error: 'A final decision has already been recorded' });
      return;
    }

    const conference = db.prepare('SELECT notificationDate FROM conferences WHERE id = ?').get(paper.conferenceId) as any;
    if (new Date() > new Date(conference.notificationDate)) {
      res.status(403).json({ error: 'Rebuttal period has closed' });
      return;
    }

    const reviews = db.prepare(
      'SELECT reviewText, originality, technicalQuality, clarity, relevance, recommendation FROM reviews WHERE paperId = ?'
    ).all(paperId) as any[];

    res.status(200).json({ paperId, reviews });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get reviews for rebuttal' });
  }
});

router.post('/papers/:paperId/rebuttal', authenticate, authorize('author'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const paperId = req.params.paperId;
    const userId = req.user!.id;

    const paper = db.prepare('SELECT submitterId, conferenceId FROM papers WHERE paperId = ?').get(paperId) as any;
    if (!paper || paper.submitterId !== userId) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const conference = db.prepare('SELECT notificationDate FROM conferences WHERE id = ?').get(paper.conferenceId) as any;
    if (new Date() > new Date(conference.notificationDate)) {
      res.status(403).json({ error: 'Rebuttal period has closed' });
      return;
    }

    const decisionRow = db.prepare('SELECT decision FROM decisions WHERE paperId = ?').get(paperId) as any;
    if (decisionRow) {
      res.status(409).json({ error: 'A final decision has already been recorded' });
      return;
    }

    const { rebuttalText } = req.body;
    const submittedAt = new Date().toISOString();

    const existing = db.prepare('SELECT paperId FROM rebuttals WHERE paperId = ?').get(paperId);
    if (existing) {
      db.prepare('UPDATE rebuttals SET rebuttalText = ?, submittedAt = ? WHERE paperId = ?').run(rebuttalText, submittedAt, paperId);
    } else {
      db.prepare('INSERT INTO rebuttals (paperId, rebuttalText, submittedAt) VALUES (?, ?, ?)').run(paperId, rebuttalText, submittedAt);
    }

    res.status(201).json({ paperId, rebuttalText, submittedAt });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit rebuttal' });
  }
});

router.get('/papers/:paperId/rebuttal', authenticate, authorize('chair'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const paperId = req.params.paperId;

    const rebuttal = db.prepare('SELECT * FROM rebuttals WHERE paperId = ?').get(paperId) as any;
    if (!rebuttal) {
      res.status(404).json({ error: 'No rebuttal found' });
      return;
    }

    res.status(200).json({
      paperId: rebuttal.paperId,
      rebuttalText: rebuttal.rebuttalText,
      submittedAt: rebuttal.submittedAt,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get rebuttal' });
  }
});

router.post('/papers/:paperId/camera-ready', authenticate, authorize('author'), upload.single('file'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const paperId = req.params.paperId;
    const userId = req.user!.id;

    const paper = db.prepare('SELECT submitterId, conferenceId FROM papers WHERE paperId = ?').get(paperId) as any;
    if (!paper || paper.submitterId !== userId) {
      res.status(403).json({ error: 'Not authorized' });
      return;
    }

    const decisionRow = db.prepare('SELECT decision FROM decisions WHERE paperId = ?').get(paperId) as any;
    if (!decisionRow || decisionRow.decision !== 'accept') {
      res.status(403).json({ error: 'Paper decision is not accept' });
      return;
    }

    const conference = db.prepare('SELECT cameraReadyDeadline FROM conferences WHERE id = ?').get(paper.conferenceId) as any;
    if (new Date() > new Date(conference.cameraReadyDeadline)) {
      res.status(403).json({ error: 'Camera-ready deadline has passed' });
      return;
    }

    const cameraReadyUrl = `/uploads/${req.file!.filename}`;
    db.prepare('UPDATE papers SET status = ?, cameraReadyUrl = ? WHERE paperId = ?').run('camera_ready', cameraReadyUrl, paperId);

    res.status(200).json({
      paperId,
      status: 'camera_ready',
      cameraReadyUrl,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to upload camera-ready version' });
  }
});

export default router;
