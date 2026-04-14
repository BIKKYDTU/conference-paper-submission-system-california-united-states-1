import React, { useState, useEffect } from 'react';

interface ReviewerProfileFormProps {
  existingProfile?: { expertise: string[]; conflicts: string[] };
  onSubmit: (profile: { expertise: string[]; conflicts: string[] }) => void;
}

const ReviewerProfileForm: React.FC<ReviewerProfileFormProps> = ({ existingProfile, onSubmit }) => {
  const [expertise, setExpertise] = useState<string[]>(existingProfile?.expertise || []);
  const [conflicts, setConflicts] = useState<string[]>(existingProfile?.conflicts || []);
  const [expertiseInput, setExpertiseInput] = useState('');
  const [conflictInput, setConflictInput] = useState('');

  useEffect(() => {
    if (existingProfile) {
      setExpertise(existingProfile.expertise);
      setConflicts(existingProfile.conflicts);
    }
  }, [existingProfile]);

  const addExpertise = () => {
    if (expertiseInput.trim()) {
      setExpertise([...expertise, expertiseInput.trim()]);
      setExpertiseInput('');
    }
  };

  const removeExpertise = (index: number) => {
    setExpertise(expertise.filter((_, i) => i !== index));
  };

  const addConflict = () => {
    if (conflictInput.trim()) {
      setConflicts([...conflicts, conflictInput.trim()]);
      setConflictInput('');
    }
  };

  const removeConflict = (index: number) => {
    setConflicts(conflicts.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ expertise, conflicts });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Reviewer Profile</h2>

      <div>
        <label>Expertise Areas</label>
        <div>
          <input type="text" value={expertiseInput} onChange={e => setExpertiseInput(e.target.value)} placeholder="Add expertise" />
          <button type="button" onClick={addExpertise}>Add</button>
        </div>
        <ul>
          {expertise.map((exp, i) => (
            <li key={i}>{exp} <button type="button" onClick={() => removeExpertise(i)}>Remove</button></li>
          ))}
        </ul>
      </div>

      <div>
        <label>Conflicts of Interest (Author Emails)</label>
        <div>
          <input type="email" value={conflictInput} onChange={e => setConflictInput(e.target.value)} placeholder="Add conflict email" />
          <button type="button" onClick={addConflict}>Add</button>
        </div>
        <ul>
          {conflicts.map((conflict, i) => (
            <li key={i}>{conflict} <button type="button" onClick={() => removeConflict(i)}>Remove</button></li>
          ))}
        </ul>
      </div>

      <button type="submit">Save Profile</button>
    </form>
  );
};

export default ReviewerProfileForm;
