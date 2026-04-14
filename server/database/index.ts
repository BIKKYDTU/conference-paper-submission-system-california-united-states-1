import Database from 'better-sqlite3';
import path from 'path';

let db: Database.Database | null = null;

export async function initializeDatabase(): Promise<void> {
  if (db) return;

  const dbPath = process.env.DB_PATH || ':memory:';
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('chair', 'reviewer', 'author'))
    );

    CREATE TABLE IF NOT EXISTS conferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      submissionDeadline TEXT NOT NULL,
      notificationDate TEXT NOT NULL,
      cameraReadyDeadline TEXT NOT NULL,
      topicAreas TEXT NOT NULL,
      submissionGuidelines TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS papers (
      paperId TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      abstract TEXT NOT NULL,
      authors TEXT NOT NULL,
      topicAreas TEXT NOT NULL,
      keywords TEXT DEFAULT '',
      conferenceId INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      pdfUrl TEXT NOT NULL,
      submitterId INTEGER NOT NULL,
      cameraReadyUrl TEXT,
      FOREIGN KEY (conferenceId) REFERENCES conferences(id),
      FOREIGN KEY (submitterId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reviewer_profiles (
      reviewerId INTEGER PRIMARY KEY,
      expertise TEXT NOT NULL DEFAULT '[]',
      conflicts TEXT NOT NULL DEFAULT '[]',
      FOREIGN KEY (reviewerId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paperId TEXT NOT NULL,
      reviewerId INTEGER NOT NULL,
      conferenceId INTEGER NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('auto', 'manual')) DEFAULT 'auto',
      UNIQUE(paperId, reviewerId),
      FOREIGN KEY (paperId) REFERENCES papers(paperId),
      FOREIGN KEY (reviewerId) REFERENCES users(id),
      FOREIGN KEY (conferenceId) REFERENCES conferences(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paperId TEXT NOT NULL,
      reviewerId INTEGER NOT NULL,
      originality INTEGER NOT NULL,
      technicalQuality INTEGER NOT NULL,
      clarity INTEGER NOT NULL,
      relevance INTEGER NOT NULL,
      recommendation TEXT NOT NULL CHECK(recommendation IN ('accept', 'weak_accept', 'weak_reject', 'reject')),
      reviewText TEXT NOT NULL,
      confidentialNote TEXT NOT NULL,
      FOREIGN KEY (paperId) REFERENCES papers(paperId),
      FOREIGN KEY (reviewerId) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS decisions (
      paperId TEXT PRIMARY KEY,
      decision TEXT NOT NULL CHECK(decision IN ('accept', 'reject')),
      FOREIGN KEY (paperId) REFERENCES papers(paperId)
    );

    CREATE TABLE IF NOT EXISTS rebuttals (
      paperId TEXT PRIMARY KEY,
      rebuttalText TEXT NOT NULL,
      submittedAt TEXT NOT NULL,
      FOREIGN KEY (paperId) REFERENCES papers(paperId)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conferenceId INTEGER NOT NULL,
      sessionName TEXT NOT NULL,
      startTime TEXT NOT NULL,
      endTime TEXT NOT NULL,
      room TEXT NOT NULL,
      FOREIGN KEY (conferenceId) REFERENCES conferences(id)
    );

    CREATE TABLE IF NOT EXISTS session_papers (
      sessionId INTEGER NOT NULL,
      paperId TEXT NOT NULL,
      PRIMARY KEY (sessionId, paperId),
      FOREIGN KEY (sessionId) REFERENCES sessions(id),
      FOREIGN KEY (paperId) REFERENCES papers(paperId)
    );
  `);
}

export function getDb(): Database.Database {
  if (!db) {
    throw new Error('Database has not been initialized. Call initializeDatabase() first.');
  }
  return db;
}
