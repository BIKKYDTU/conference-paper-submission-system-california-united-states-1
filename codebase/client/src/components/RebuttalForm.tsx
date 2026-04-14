import React, { useState } from 'react';

interface RebuttalFormProps {
  paperId: string;
  initialText?: string;
  onSubmit: (payload: { rebuttalText: string }) => void;
}

const RebuttalForm: React.FC<RebuttalFormProps> = ({ paperId, initialText, onSubmit }) => {
  const [rebuttalText, setRebuttalText] = useState(initialText || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ rebuttalText });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Submit Rebuttal for Paper: {paperId}</h2>

      <div>
        <label htmlFor="rebuttal-text">Rebuttal Text</label>
        <textarea
          id="rebuttal-text"
          value={rebuttalText}
          onChange={e => setRebuttalText(e.target.value)}
          rows={10}
          required
        />
      </div>

      <button type="submit">Submit Rebuttal</button>
    </form>
  );
};

export default RebuttalForm;
