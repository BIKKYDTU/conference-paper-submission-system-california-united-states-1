import React from 'react';

interface PaperAssignment {
  paperId: string;
  title: string;
  pdfUrl: string;
  reviewed: boolean;
}

interface ReviewerDashboardProps {
  papers: PaperAssignment[];
  onSelectPaper: (paperId: string) => void;
}

const ReviewerDashboard: React.FC<ReviewerDashboardProps> = ({ papers, onSelectPaper }) => {
  return (
    <div>
      <h2>Reviewer Dashboard</h2>
      {papers.length === 0 ? (
        <p>No papers assigned for review.</p>
      ) : (
        <ul>
          {papers.map(paper => (
            <li key={paper.paperId} onClick={() => onSelectPaper(paper.paperId)} style={{ cursor: 'pointer' }}>
              <div>
                <strong>{paper.title}</strong>
                <span style={{ marginLeft: '10px', color: paper.reviewed ? 'green' : 'orange' }}>
                  {paper.reviewed ? 'Reviewed' : 'Pending Review'}
                </span>
              </div>
              <a href={paper.pdfUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                View PDF
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReviewerDashboard;
