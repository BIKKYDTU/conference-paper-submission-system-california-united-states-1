import React, { useState } from 'react';

interface CameraReadyUploadFormProps {
  paperId: string;
  onSubmit: (data: FormData) => void;
}

const CameraReadyUploadForm: React.FC<CameraReadyUploadFormProps> = ({ paperId, onSubmit }) => {
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Upload Camera-Ready Version: {paperId}</h2>

      <div>
        <label htmlFor="camera-ready-file">Camera-Ready PDF</label>
        <input
          id="camera-ready-file"
          type="file"
          accept=".pdf"
          onChange={e => setFile(e.target.files?.[0] || null)}
          required
        />
      </div>

      <button type="submit">Upload Camera-Ready</button>
    </form>
  );
};

export default CameraReadyUploadForm;
