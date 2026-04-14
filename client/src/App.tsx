import React, { useCallback, useEffect, useState } from 'react';
import AuthForm from './components/AuthForm';
import ConferenceCreationForm from './components/ConferenceCreationForm';
import PaperSubmissionForm from './components/PaperSubmissionForm';

type User = { id: number; name: string; email: string; role: 'chair' | 'reviewer' | 'author' };

const TOKEN_KEY = 'conference_token';

async function parseJson(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [message, setMessage] = useState<string>('');
  const [conferenceIdInput, setConferenceIdInput] = useState('');
  const [loadedConference, setLoadedConference] = useState<{
    id: number;
    topicAreas: string[];
  } | null>(null);
  const [createdConferenceId, setCreatedConferenceId] = useState<number | null>(null);

  const api = useCallback(
    (path: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      return fetch(path, { ...init, headers });
    },
    [token]
  );

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    (async () => {
      const res = await api('/api/auth/me');
      if (res.ok) {
        const data = await parseJson(res);
        setUser(data.user);
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
    })();
  }, [token, api]);

  const handleAuth = async (credentials: {
    name?: string;
    email: string;
    password: string;
    role?: 'chair' | 'reviewer' | 'author';
  }) => {
    setMessage('');
    const path = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    const data = await parseJson(res);
    if (!res.ok) {
      setMessage(typeof data.error === 'string' ? data.error : 'Authentication failed');
      return;
    }
    const t = data.token as string;
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setLoadedConference(null);
    setCreatedConferenceId(null);
  };

  const handleCreateConference = async (body: {
    name: string;
    description: string;
    submissionDeadline: string;
    notificationDate: string;
    cameraReadyDeadline: string;
    topicAreas: string[];
    submissionGuidelines: string;
  }) => {
    setMessage('');
    const res = await api('/api/conferences', { method: 'POST', body: JSON.stringify(body) });
    const data = await parseJson(res);
    if (!res.ok) {
      setMessage(typeof data.error === 'string' ? data.error : 'Create failed');
      return;
    }
    setCreatedConferenceId(data.id);
    setMessage(`Conference created (id ${data.id}).`);
  };

  const loadConferenceForAuthor = async () => {
    setMessage('');
    const id = parseInt(conferenceIdInput, 10);
    if (Number.isNaN(id)) {
      setMessage('Enter a numeric conference id.');
      return;
    }
    const res = await api(`/api/conferences/${id}`);
    const data = await parseJson(res);
    if (!res.ok) {
      setMessage(typeof data.error === 'string' ? data.error : 'Load failed');
      setLoadedConference(null);
      return;
    }
    setLoadedConference({ id: data.id, topicAreas: data.topicAreas || [] });
    setMessage(`Loaded conference ${data.name || id}.`);
  };

  const handlePaperSubmit = async (formData: FormData) => {
    if (!loadedConference) return;
    setMessage('');
    const res = await api(`/api/conferences/${loadedConference.id}/papers`, {
      method: 'POST',
      body: formData,
    });
    const data = await parseJson(res);
    if (!res.ok) {
      setMessage(typeof data.error === 'string' ? data.error : 'Submit failed');
      return;
    }
    setMessage(`Paper submitted: ${data.paperId}`);
  };

  if (!token || !user) {
    return (
      <div>
        <AuthForm
          mode={authMode}
          onSubmit={handleAuth}
          onToggleMode={() => setAuthMode(m => (m === 'login' ? 'register' : 'login'))}
        />
        {message && <p role="alert">{message}</p>}
      </div>
    );
  }

  return (
    <div>
      <p>
        Signed in as <strong>{user.email}</strong> ({user.role}){' '}
        <button type="button" onClick={logout}>
          Log out
        </button>
      </p>
      {message && <p role="status">{message}</p>}

      {user.role === 'chair' && (
        <section>
          <ConferenceCreationForm onSubmit={handleCreateConference} />
          {createdConferenceId != null && (
            <p>
              <strong>Tip:</strong> share conference id <code>{createdConferenceId}</code> with authors.
            </p>
          )}
        </section>
      )}

      {user.role === 'author' && (
        <section>
          <h2>Load conference</h2>
          <div>
            <input
              type="number"
              min={1}
              value={conferenceIdInput}
              onChange={e => setConferenceIdInput(e.target.value)}
              placeholder="Conference id"
            />
            <button type="button" onClick={loadConferenceForAuthor}>
              Load
            </button>
          </div>
          {loadedConference && (
            <PaperSubmissionForm
              conferenceId={loadedConference.id}
              topicAreas={loadedConference.topicAreas}
              onSubmit={handlePaperSubmit}
            />
          )}
        </section>
      )}

      {user.role === 'reviewer' && (
        <p>Reviewer workflows use the API (assignments, reviews). Open the backend panel to probe endpoints.</p>
      )}
    </div>
  );
};

export default App;
