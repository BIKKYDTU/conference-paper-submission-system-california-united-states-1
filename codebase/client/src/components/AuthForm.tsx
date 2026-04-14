import React, { useState } from 'react';

interface AuthFormProps {
  mode: 'login' | 'register';
  onSubmit: (credentials: { name?: string; email: string; password: string; role?: 'chair' | 'reviewer' | 'author' }) => void;
  onToggleMode: () => void;
}

const AuthForm: React.FC<AuthFormProps> = ({ mode, onSubmit, onToggleMode }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'chair' | 'reviewer' | 'author'>('author');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'register') {
      onSubmit({ name, email, password, role });
    } else {
      onSubmit({ email, password });
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>{mode === 'login' ? 'Login' : 'Register'}</h2>

      {mode === 'register' && (
        <div>
          <label htmlFor="name">Name</label>
          <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} required />
        </div>
      )}

      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
      </div>

      {mode === 'register' && (
        <div>
          <label htmlFor="role">Role</label>
          <select id="role" value={role} onChange={e => setRole(e.target.value as any)}>
            <option value="author">Author</option>
            <option value="reviewer">Reviewer</option>
            <option value="chair">Chair</option>
          </select>
        </div>
      )}

      <button type="submit">{mode === 'login' ? 'Login' : 'Register'}</button>
      <button type="button" onClick={onToggleMode}>
        {mode === 'login' ? 'Switch to Register' : 'Switch to Login'}
      </button>
    </form>
  );
};

export default AuthForm;
