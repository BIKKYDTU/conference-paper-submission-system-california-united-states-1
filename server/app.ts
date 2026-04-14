import express from 'express';
import path from 'path';
import { initializeDatabase } from './database';
import authRoutes from './routes/auth';
import conferenceRoutes from './routes/conferences';
import paperRoutes from './routes/papers';
import reviewerRoutes from './routes/reviewers';

const app = express();

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'conference-api', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/conferences', conferenceRoutes);
app.use('/api', paperRoutes);
app.use('/api/reviewers', reviewerRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
});

export default app;
