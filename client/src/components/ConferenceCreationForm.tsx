import React, { useState } from 'react';

interface ConferenceData {
  name: string;
  description: string;
  submissionDeadline: string;
  notificationDate: string;
  cameraReadyDeadline: string;
  topicAreas: string[];
  submissionGuidelines: string;
}

interface ConferenceCreationFormProps {
  onSubmit: (data: ConferenceData) => void;
}

const ConferenceCreationForm: React.FC<ConferenceCreationFormProps> = ({ onSubmit }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submissionDeadline, setSubmissionDeadline] = useState('');
  const [notificationDate, setNotificationDate] = useState('');
  const [cameraReadyDeadline, setCameraReadyDeadline] = useState('');
  const [topicAreas, setTopicAreas] = useState<string[]>([]);
  const [topicInput, setTopicInput] = useState('');
  const [submissionGuidelines, setSubmissionGuidelines] = useState('');

  const addTopicArea = () => {
    if (topicInput.trim()) {
      setTopicAreas([...topicAreas, topicInput.trim()]);
      setTopicInput('');
    }
  };

  const removeTopicArea = (index: number) => {
    setTopicAreas(topicAreas.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      description,
      submissionDeadline,
      notificationDate,
      cameraReadyDeadline,
      topicAreas,
      submissionGuidelines,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create Conference</h2>

      <div>
        <label htmlFor="conf-name">Conference Name</label>
        <input id="conf-name" type="text" value={name} onChange={e => setName(e.target.value)} required />
      </div>

      <div>
        <label htmlFor="conf-desc">Description</label>
        <textarea id="conf-desc" value={description} onChange={e => setDescription(e.target.value)} required />
      </div>

      <div>
        <label htmlFor="sub-deadline">Submission Deadline</label>
        <input id="sub-deadline" type="datetime-local" value={submissionDeadline} onChange={e => setSubmissionDeadline(e.target.value)} required />
      </div>

      <div>
        <label htmlFor="notif-date">Notification Date</label>
        <input id="notif-date" type="datetime-local" value={notificationDate} onChange={e => setNotificationDate(e.target.value)} required />
      </div>

      <div>
        <label htmlFor="cr-deadline">Camera-Ready Deadline</label>
        <input id="cr-deadline" type="datetime-local" value={cameraReadyDeadline} onChange={e => setCameraReadyDeadline(e.target.value)} required />
      </div>

      <div>
        <label>Topic Areas</label>
        <div>
          <input type="text" value={topicInput} onChange={e => setTopicInput(e.target.value)} placeholder="Add topic area" />
          <button type="button" onClick={addTopicArea}>Add</button>
        </div>
        <ul>
          {topicAreas.map((topic, i) => (
            <li key={i}>
              {topic} <button type="button" onClick={() => removeTopicArea(i)}>Remove</button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <label htmlFor="guidelines">Submission Guidelines</label>
        <textarea id="guidelines" value={submissionGuidelines} onChange={e => setSubmissionGuidelines(e.target.value)} required />
      </div>

      <button type="submit">Create Conference</button>
    </form>
  );
};

export default ConferenceCreationForm;
