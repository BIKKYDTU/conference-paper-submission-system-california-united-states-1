import { Router, Response } from 'express';
import { getDb } from '../database';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

router.put('/profile', authenticate, authorize('reviewer'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const reviewerId = req.user!.id;
    const { expertise, conflicts } = req.body;

    const existing = db.prepare('SELECT reviewerId FROM reviewer_profiles WHERE reviewerId = ?').get(reviewerId);

    if (existing) {
      db.prepare(
        'UPDATE reviewer_profiles SET expertise = ?, conflicts = ? WHERE reviewerId = ?'
      ).run(JSON.stringify(expertise), JSON.stringify(conflicts), reviewerId);
    } else {
      db.prepare(
        'INSERT INTO reviewer_profiles (reviewerId, expertise, conflicts) VALUES (?, ?, ?)'
      ).run(reviewerId, JSON.stringify(expertise), JSON.stringify(conflicts));
    }

    res.status(200).json({
      reviewerId,
      expertise,
      conflicts,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/profile', authenticate, authorize('reviewer'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const reviewerId = req.user!.id;

    const profile = db.prepare('SELECT * FROM reviewer_profiles WHERE reviewerId = ?').get(reviewerId) as any;

    if (!profile) {
      res.status(200).json({ reviewerId, expertise: [], conflicts: [] });
      return;
    }

    res.status(200).json({
      reviewerId: profile.reviewerId,
      expertise: JSON.parse(profile.expertise),
      conflicts: JSON.parse(profile.conflicts),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.get('/assignments', authenticate, authorize('reviewer'), (req: AuthRequest, res: Response) => {
  try {
    const db = getDb();
    const reviewerId = req.user!.id;

    const assignedPapers = db.prepare(`
      SELECT a.paperId, p.title, p.conferenceId, p.pdfUrl
      FROM assignments a
      JOIN papers p ON a.paperId = p.paperId
      WHERE a.reviewerId = ?
    `).all(reviewerId) as Array<{ paperId: string; title: string; conferenceId: number; pdfUrl: string }>;

    const result = assignedPapers.map(ap => {
      const review = db.prepare(
        'SELECT id FROM reviews WHERE paperId = ? AND reviewerId = ?'
      ).get(ap.paperId, reviewerId);

      return {
        paperId: ap.paperId,
        title: ap.title,
        conferenceId: ap.conferenceId,
        pdfUrl: ap.pdfUrl,
        reviewed: !!review,
      };
    });

    res.status(200).json({ assignments: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get assignments' });
  }
});

export default router;
