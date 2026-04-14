import React from 'react';

interface Review {
  reviewText: string;
  originality: number;
  technicalQuality: number;
  clarity: number;
  relevance: number;
  recommendation: string;
}

interface Notification {
  paperId: string;
  decision: 'accept' | 'reject' | 'pending';
  decisionFinal: boolean;
  reviews: Review[];
}

interface AuthorNotificationViewProps {
  notification: Notification;
}

const AuthorNotificationView: React.FC<AuthorNotificationViewProps> = ({ notification }) => {
  const { paperId, decision, decisionFinal, reviews } = notification;

  return (
    <div>
      <h2>Paper Notification: {paperId}</h2>

      <div>
        <h3>Decision Status</h3>
        {decisionFinal ? (
          <p style={{ color: decision === 'accept' ? 'green' : 'red', fontWeight: 'bold' }}>
            Final Decision: {decision.toUpperCase()}
          </p>
        ) : (
          <p style={{ color: 'orange' }}>
            Decision is still pending. Reviews below are available for rebuttal purposes.
          </p>
        )}
      </div>

      <div>
        <h3>Reviews ({reviews.length})</h3>
        {reviews.length === 0 ? (
          <p>No reviews submitted yet.</p>
        ) : (
          reviews.map((review, i) => (
            <div key={i} style={{ border: '1px solid #ddd', padding: '12px', marginBottom: '12px' }}>
              <p>Originality: {review.originality} | Technical Quality: {review.technicalQuality} | Clarity: {review.clarity} | Relevance: {review.relevance}</p>
              <p>Recommendation: {review.recommendation}</p>
              <p>{review.reviewText}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AuthorNotificationView;
