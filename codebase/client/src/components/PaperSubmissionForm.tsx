import React, { useState } from 'react';

interface Author {
  name: string;
  affiliation: string;
  email: string;
}

interface PaperSubmissionFormProps {
  conferenceId: number;
  topicAreas: string[];
  onSubmit: (data: FormData) => void;
}

const PaperSubmissionForm: React.FC<PaperSubmissionFormProps> = ({ conferenceId, topicAreas, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [authors, setAuthors] = useState<Author[]>([{ name: '', affiliation: '', email: '' }]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [keywords, setKeywords] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const addAuthor = () => {
    setAuthors([...authors, { name: '', affiliation: '', email: '' }]);
  };

  const updateAuthor = (index: number, field: keyof Author, value: string) => {
    const updated = [...authors];
    updated[index] = { ...updated[index], [field]: value };
    setAuthors(updated);
  };

  const removeAuthor = (index: number) => {
    if (authors.length > 1) {
      setAuthors(authors.filter((_, i) => i !== index));
    }
  };

  const handleTopicToggle = (topic: string) => {
    setSelectedTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('title', title);
    formData.append('abstract', abstract);
    formData.append('authors', JSON.stringify(authors));
    formData.append('topicAreas', JSON.stringify(selectedTopics));
    formData.append('keywords', keywords);
    if (file) {
      formData.append('file', file);
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Submit Paper</h2>

      <div>
        <label htmlFor="paper-title">Title</label>
        <input id="paper-title" type="text" value={title} onChange={e => setTitle(e.target.value)} required />
      </div>

      <div>
        <label htmlFor="paper-abstract">Abstract</label>
        <textarea id="paper-abstract" value={abstract} onChange={e => setAbstract(e.target.value)} required />
      </div>

      <div>
        <label>Authors</label>
        {authors.map((author, i) => (
          <div key={i}>
            <input type="text" placeholder="Name" value={author.name} onChange={e => updateAuthor(i, 'name', e.target.value)} required />
            <input type="text" placeholder="Affiliation" value={author.affiliation} onChange={e => updateAuthor(i, 'affiliation', e.target.value)} required />
            <input type="email" placeholder="Email" value={author.email} onChange={e => updateAuthor(i, 'email', e.target.value)} required />
            {authors.length > 1 && <button type="button" onClick={() => removeAuthor(i)}>Remove</button>}
          </div>
        ))}
        <button type="button" onClick={addAuthor}>Add Author</button>
      </div>

      <div>
        <label>Topic Areas</label>
        {topicAreas.map(topic => (
          <label key={topic}>
            <input type="checkbox" checked={selectedTopics.includes(topic)} onChange={() => handleTopicToggle(topic)} />
            {topic}
          </label>
        ))}
      </div>

      <div>
        <label htmlFor="paper-keywords">Keywords</label>
        <input id="paper-keywords" type="text" value={keywords} onChange={e => setKeywords(e.target.value)} />
      </div>

      <div>
        <label htmlFor="paper-file">PDF File</label>
        <input id="paper-file" type="file" accept=".pdf" onChange={e => setFile(e.target.files?.[0] || null)} required />
      </div>

      <button type="submit">Submit Paper</button>
    </form>
  );
};

export default PaperSubmissionForm;
