import { getDb } from '../database';

interface AssignmentResult {
  assignments: Array<{ paperId: string; reviewerId: number }>;
  underAssignedPaperIds: string[];
  unassignedPaperIds: string[];
}

export async function assignReviewers(
  conferenceId: number,
  reviewersPerPaper: number = 3
): Promise<AssignmentResult> {
  const db = getDb();

  const papers = db.prepare(
    'SELECT paperId, authors, topicAreas FROM papers WHERE conferenceId = ?'
  ).all(conferenceId) as Array<{ paperId: string; authors: string; topicAreas: string }>;

  const reviewerProfiles = db.prepare(`
    SELECT u.id as reviewerId, rp.expertise, rp.conflicts
    FROM users u
    JOIN reviewer_profiles rp ON u.id = rp.reviewerId
    WHERE u.role = 'reviewer'
  `).all() as Array<{ reviewerId: number; expertise: string; conflicts: string }>;

  const existingManualAssignments = db.prepare(
    "SELECT paperId, reviewerId FROM assignments WHERE conferenceId = ? AND source = 'manual'"
  ).all(conferenceId) as Array<{ paperId: string; reviewerId: number }>;

  const manualMap = new Map<string, Set<number>>();
  for (const ma of existingManualAssignments) {
    if (!manualMap.has(ma.paperId)) {
      manualMap.set(ma.paperId, new Set());
    }
    manualMap.get(ma.paperId)!.add(ma.reviewerId);
  }

  const eligibilityMap = new Map<string, number[]>();

  for (const paper of papers) {
    const paperTopics: string[] = JSON.parse(paper.topicAreas);
    const paperAuthors: Array<{ email: string }> = JSON.parse(paper.authors);
    const authorEmails = new Set(paperAuthors.map(a => a.email.toLowerCase()));

    const eligible: number[] = [];

    for (const reviewer of reviewerProfiles) {
      const expertise: string[] = JSON.parse(reviewer.expertise);
      const conflicts: string[] = JSON.parse(reviewer.conflicts);

      const hasTopicOverlap = paperTopics.some(t => expertise.includes(t));
      if (!hasTopicOverlap) continue;

      const hasConflict = conflicts.some(c => authorEmails.has(c.toLowerCase()));
      if (hasConflict) continue;

      const alreadyManual = manualMap.get(paper.paperId)?.has(reviewer.reviewerId);
      if (alreadyManual) continue;

      eligible.push(reviewer.reviewerId);
    }

    eligibilityMap.set(paper.paperId, eligible);
  }

  const assignments: Array<{ paperId: string; reviewerId: number }> = [];
  const underAssignedPaperIds: string[] = [];
  const unassignedPaperIds: string[] = [];

  const reviewerLoad = new Map<number, number>();
  for (const reviewer of reviewerProfiles) {
    reviewerLoad.set(reviewer.reviewerId, 0);
  }
  for (const ma of existingManualAssignments) {
    reviewerLoad.set(ma.reviewerId, (reviewerLoad.get(ma.reviewerId) || 0) + 1);
  }

  const paperNeeds = new Map<string, number>();
  for (const paper of papers) {
    const manualCount = manualMap.get(paper.paperId)?.size || 0;
    const needed = Math.max(0, reviewersPerPaper - manualCount);
    paperNeeds.set(paper.paperId, needed);
  }

  const sortedPapers = [...papers].sort((a, b) => {
    const eligA = eligibilityMap.get(a.paperId)?.length || 0;
    const eligB = eligibilityMap.get(b.paperId)?.length || 0;
    return eligA - eligB;
  });

  const paperAssigned = new Map<string, Set<number>>();

  for (const paper of sortedPapers) {
    const needed = paperNeeds.get(paper.paperId) || 0;
    const eligible = eligibilityMap.get(paper.paperId) || [];
    const assigned = new Set<number>();
    paperAssigned.set(paper.paperId, assigned);

    for (let i = 0; i < needed && eligible.length > 0; i++) {
      eligible.sort((a, b) => {
        const loadA = reviewerLoad.get(a) || 0;
        const loadB = reviewerLoad.get(b) || 0;
        return loadA - loadB;
      });

      const filtered = eligible.filter(r => !assigned.has(r));
      if (filtered.length === 0) break;

      filtered.sort((a, b) => {
        const loadA = reviewerLoad.get(a) || 0;
        const loadB = reviewerLoad.get(b) || 0;
        return loadA - loadB;
      });

      const chosen = filtered[0];
      assigned.add(chosen);
      assignments.push({ paperId: paper.paperId, reviewerId: chosen });
      reviewerLoad.set(chosen, (reviewerLoad.get(chosen) || 0) + 1);
    }
  }

  for (const paper of papers) {
    const autoCount = paperAssigned.get(paper.paperId)?.size || 0;
    const manualCount = manualMap.get(paper.paperId)?.size || 0;
    const totalCount = autoCount + manualCount;

    if (totalCount === 0) {
      unassignedPaperIds.push(paper.paperId);
    } else if (totalCount < reviewersPerPaper) {
      underAssignedPaperIds.push(paper.paperId);
    }
  }

  const insertAssignment = db.prepare(
    "INSERT INTO assignments (paperId, reviewerId, conferenceId, source) VALUES (?, ?, ?, 'auto')"
  );

  const insertMany = db.transaction((items: Array<{ paperId: string; reviewerId: number }>) => {
    for (const item of items) {
      insertAssignment.run(item.paperId, item.reviewerId, conferenceId);
    }
  });

  insertMany(assignments);

  return { assignments, underAssignedPaperIds, unassignedPaperIds };
}
