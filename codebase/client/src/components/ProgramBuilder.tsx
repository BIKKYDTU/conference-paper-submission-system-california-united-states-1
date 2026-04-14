import React, { useState } from 'react';

interface AcceptedPaper {
  paperId: string;
  title: string;
}

interface Session {
  sessionName: string;
  startTime: string;
  endTime: string;
  room: string;
  paperIds: string[];
}

interface ProgramBuilderProps {
  conferenceId: number;
  acceptedPapers: AcceptedPaper[];
  onSave: (sessions: Session[]) => void;
}

const ProgramBuilder: React.FC<ProgramBuilderProps> = ({ conferenceId, acceptedPapers, onSave }) => {
  const [sessions, setSessions] = useState<Session[]>([]);

  const addSession = () => {
    setSessions([...sessions, { sessionName: '', startTime: '', endTime: '', room: '', paperIds: [] }]);
  };

  const updateSession = (index: number, field: keyof Session, value: any) => {
    const updated = [...sessions];
    updated[index] = { ...updated[index], [field]: value };
    setSessions(updated);
  };

  const togglePaper = (sessionIndex: number, paperId: string) => {
    const session = sessions[sessionIndex];
    const paperIds = session.paperIds.includes(paperId)
      ? session.paperIds.filter(id => id !== paperId)
      : [...session.paperIds, paperId];
    updateSession(sessionIndex, 'paperIds', paperIds);
  };

  const removeSession = (index: number) => {
    setSessions(sessions.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(sessions);
  };

  return (
    <div>
      <h2>Program Builder - Conference {conferenceId}</h2>

      {sessions.map((session, i) => (
        <div key={i} style={{ border: '1px solid #ccc', padding: '16px', marginBottom: '16px' }}>
          <div>
            <label>Session Name</label>
            <input type="text" value={session.sessionName} onChange={e => updateSession(i, 'sessionName', e.target.value)} />
          </div>
          <div>
            <label>Start Time</label>
            <input type="datetime-local" value={session.startTime} onChange={e => updateSession(i, 'startTime', e.target.value)} />
          </div>
          <div>
            <label>End Time</label>
            <input type="datetime-local" value={session.endTime} onChange={e => updateSession(i, 'endTime', e.target.value)} />
          </div>
          <div>
            <label>Room</label>
            <input type="text" value={session.room} onChange={e => updateSession(i, 'room', e.target.value)} />
          </div>
          <div>
            <label>Papers</label>
            {acceptedPapers.map(paper => (
              <label key={paper.paperId} style={{ display: 'block' }}>
                <input
                  type="checkbox"
                  checked={session.paperIds.includes(paper.paperId)}
                  onChange={() => togglePaper(i, paper.paperId)}
                />
                {paper.title}
              </label>
            ))}
          </div>
          <button type="button" onClick={() => removeSession(i)}>Remove Session</button>
        </div>
      ))}

      <button type="button" onClick={addSession}>Add Session</button>
      <button type="button" onClick={handleSave}>Save Program</button>
    </div>
  );
};

export default ProgramBuilder;
