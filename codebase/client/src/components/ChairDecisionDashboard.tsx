import React from 'react';

interface Review {
  originality: number;
  technicalQuality: number;
  clarity: number;
  relevance: number;
  recommendation: string;
  reviewText: string;
  confidentialNote: string;
}

interface Paper {
  paperId: string;
  title: string;
  reviews: Review[];
  decision?: string;
}

interface Stats {
  totalPapers: number;
  accepted: number;
  rejected: number;
  acceptanceRate: number;
  scoreDistributions: {
    originality: number[];
    technicalQuality: number[];
    clarity: number[];
    relevance: number[];
  };
}

interface ChairDecisionDashboardProps {
  papers: Paper[];
  stats: Stats;
  onDecide: (paperId: string, decision: 'accept' | 'reject') => void;
}

const ChairDecisionDashboard: React.FC<ChairDecisionDashboardProps> = ({ papers, stats, onDecide }) => {
  return (
    <div>
      <h2>Chair Decision Dashboard</h2>

      <section>
        <h3>Conference Statistics</h3>
        <p>Total Papers: {stats.totalPapers}</p>
        <p>Accepted: {stats.accepted}</p>
        <p>Rejected: {stats.rejected}</p>
        <p>Acceptance Rate: {(stats.acceptanceRate * 100).toFixed(1)}%</p>

        <h4>Score Distributions</h4>
        <p>Originality: {stats.scoreDistributions.originality.join(', ')}</p>
        <p>Technical Quality: {stats.scoreDistributions.technicalQuality.join(', ')}</p>
        <p>Clarity: {stats.scoreDistributions.clarity.join(', ')}</p>
        <p>Relevance: {stats.scoreDistributions.relevance.join(', ')}</p>
      </section>

      <section>
        <h3>Papers</h3>
        {papers.map(paper => (
          <div key={paper.paperId} style={{ border: '1px solid #ccc', padding: '16px', marginBottom: '16px' }}>
            <h4>{paper.title}</h4>
            <p>Decision: {paper.decision || 'Pending'}</p>

            <h5>Reviews ({paper.reviews.length})</h5>
            {paper.reviews.map((review, i) => (
              <div key={i} style={{ marginLeft: '16px', marginBottom: '8px' }}>
                <p>Originality: {review.originality} | Technical Quality: {review.technicalQuality} | Clarity: {review.clarity} | Relevance: {review.relevance}</p>
                <p>Recommendation: {review.recommendation}</p>
                <p>Review: {review.reviewText}</p>
                <p><em>Confidential Note: {review.confidentialNote}</em></p>
              </div>
            ))}

            {!paper.decision && (
              <div>
                <button onClick={() => onDecide(paper.paperId, 'accept')}>Accept</button>
                <button onClick={() => onDecide(paper.paperId, 'reject')}>Reject</button>
              </div>
            )}
          </div>
        ))}
      </section>
    </div>
  );
};

export default ChairDecisionDashboard;
