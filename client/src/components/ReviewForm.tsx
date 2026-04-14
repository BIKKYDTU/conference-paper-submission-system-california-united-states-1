import React, { useState } from 'react';

interface ReviewData {
  originality: number;
  technicalQuality: number;
  clarity: number;
  relevance: number;
  recommendation: string;
  reviewText: string;
  confidentialNote: string;
}

interface ReviewFormProps {
  paperId: string;
  onSubmit: (review: ReviewData) => void;
}

const ReviewForm: React.FC<ReviewFormProps> = ({ paperId, onSubmit }) => {
  const [originality, setOriginality] = useState(3);
  const [technicalQuality, setTechnicalQuality] = useState(3);
  const [clarity, setClarity] = useState(3);
  const [relevance, setRelevance] = useState(3);
  const [recommendation, setRecommendation] = useState('weak_accept');
  const [reviewText, setReviewText] = useState('');
  const [confidentialNote, setConfidentialNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      originality,
      technicalQuality,
      clarity,
      relevance,
      recommendation,
      reviewText,
      confidentialNote,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Review Paper: {paperId}</h2>

      <div>
        <label htmlFor="originality">Originality (1-5)</label>
        <input id="originality" type="number" min={1} max={5} value={originality} onChange={e => setOriginality(parseInt(e.target.value))} required />
      </div>

      <div>
        <label htmlFor="technicalQuality">Technical Quality (1-5)</label>
        <input id="technicalQuality" type="number" min={1} max={5} value={technicalQuality} onChange={e => setTechnicalQuality(parseInt(e.target.value))} required />
      </div>

      <div>
        <label htmlFor="clarity">Clarity (1-5)</label>
        <input id="clarity" type="number" min={1} max={5} value={clarity} onChange={e => setClarity(parseInt(e.target.value))} required />
      </div>

      <div>
        <label htmlFor="relevance">Relevance (1-5)</label>
        <input id="relevance" type="number" min={1} max={5} value={relevance} onChange={e => setRelevance(parseInt(e.target.value))} required />
      </div>

      <div>
        <label htmlFor="recommendation">Recommendation</label>
        <select id="recommendation" value={recommendation} onChange={e => setRecommendation(e.target.value)}>
          <option value="accept">Accept</option>
          <option value="weak_accept">Weak Accept</option>
          <option value="weak_reject">Weak Reject</option>
          <option value="reject">Reject</option>
        </select>
      </div>

      <div>
        <label htmlFor="reviewText">Review Text</label>
        <textarea id="reviewText" value={reviewText} onChange={e => setReviewText(e.target.value)} required />
      </div>

      <div>
        <label htmlFor="confidentialNote">Confidential Note (Chair Only)</label>
        <textarea id="confidentialNote" value={confidentialNote} onChange={e => setConfidentialNote(e.target.value)} />
      </div>

      <button type="submit">Submit Review</button>
    </form>
  );
};

export default ReviewForm;
