# Build Academic Conference Paper Submission and Peer Review System

## Description

I need a complete full-stack web application for managing academic conference paper submissions and peer review workflows built from scratch. The system supports three authenticated user roles -- `chair`, `reviewer`, and `author` -- each with dedicated functionality. Conference chairs create and manage conferences, authors submit papers for review, reviewers evaluate assigned papers, and the chair makes final accept/reject decisions and publishes a conference program. All data persists in SQLite and all routes are secured with JWT-based authentication and role-based access control.

## Tech Stack

- **Frontend:** React 18 with TypeScript 5
- **Backend:** Node.js 20 LTS with TypeScript 5 using Express.js 4
- **Database:** SQLite3
- **Authentication:** JWT (JSON Web Tokens) supporting three roles: `chair`, `reviewer`, `author`
- **File Handling:** PDF upload and storage via multipart/form-data

## Current State

Empty repository with test files only.

## Required Implementation

### 1. Conference Management (Chair Role)

The chair creates a conference record containing: `name`, `description`, `submissionDeadline` (ISO date string), `notificationDate` (ISO date string), `cameraReadyDeadline` (ISO date string), `topicAreas` (array of strings), and `submissionGuidelines` (string). The system stores and retrieves full conference details by ID.

### 2. Paper Submission (Author Role)

Authors submit papers by uploading a PDF file together with structured metadata: `title`, `abstract`, an `authors` list where each entry contains `name`, `affiliation`, and `email`, `topicAreas` (selected from the conference topic areas list), and an optional `keywords` string. Upon successful submission, the system generates a unique `paperId` and returns it to the author along with a `status` of `"submitted"`.

### 3. Reviewer Profile and Conflict Declaration (Reviewer Role)

Registered reviewers save a profile specifying their `expertise` (array of topic area strings) and their `conflicts` list (array of author email addresses representing declared conflicts of interest). The system stores and retrieves the profile per reviewer.

### 4. Automatic Review Assignment (Chair Role)

The chair triggers automatic assignment of papers to reviewers for a conference. The assignment algorithm applies constraints in priority order:

- **Hard constraint 1:** Every assignment pairs a reviewer with a paper where at least one topic area overlaps with the reviewer's declared expertise. Papers with no eligible reviewer are left unassigned.
- **Hard constraint 2:** Every assignment pairs a reviewer exclusively with papers where the reviewer holds conflict-free status with all of the paper's listed authors. Papers where all eligible reviewers have conflicts are left unassigned.
- **Best-effort target:** The algorithm assigns up to `reviewersPerPaper` (default 3) eligible reviewers to each paper. Papers with at least 1 but fewer than `reviewersPerPaper` eligible reviewers are still included in `assignments` with as many reviewers as available and are additionally listed in `underAssignedPaperIds`. Papers with zero eligible reviewers (due to unsatisfied hard constraints 1 and 2) receive no assignments and are listed in `unassignedPaperIds`.
- **Best-effort objective:** Subject to the two hard constraints and the reviewer-count target, the algorithm distributes assignments as evenly as possible across eligible reviewers, minimizing the difference between the most-loaded and least-loaded reviewer.

The system persists the resulting assignments, returns the assignment list, returns an `underAssignedPaperIds` array identifying papers that received fewer than `reviewersPerPaper` reviewers so the chair knows which papers need manual supplementation, and returns an `unassignedPaperIds` array identifying papers with truly zero eligible reviewers. The chair manually creates or deletes individual assignments to resolve under-assigned or unassigned papers.

### 5. Reviewer Dashboard and Review Submission (Reviewer Role)

Reviewers access a list of papers assigned to them, with the PDF accessible via a stored file URL. For each assigned paper, reviewers submit a review form containing:

- `originality`: integer score 1–5
- `technicalQuality`: integer score 1–5
- `clarity`: integer score 1–5
- `relevance`: integer score 1–5
- `recommendation`: one of the four values `"accept"`, `"weak_accept"`, `"weak_reject"`, `"reject"`
- `reviewText`: detailed string feedback intended for the authors
- `confidentialNote`: string note visible exclusively to the chair

### 6. Chair Decision Dashboard (Chair Role)

The chair views all submitted reviews for each paper, including scores, recommendations, reviewer text, and confidential notes. The chair records a final decision of `"accept"` | `"reject"` for each paper. The dashboard exposes aggregate conference statistics: total papers, accepted count, rejected count, acceptance rate (accepted / total), and score distributions per criterion (one value per review).

### 7. Author Notification (Author Role)

Authors retrieve the chair's decision status for their paper along with the anonymized review content through a single notification endpoint. Reviews are returned whenever they exist, regardless of whether a final decision has been recorded — this allows authors to view feedback during the rebuttal phase before a decision is made, as well as after the final decision. The response includes the decision (`"accept"`, `"reject"`, or `"pending"`), a `decisionFinal` boolean indicating whether the decision is final, and for each review, exactly these fields: `reviewText`, per-criterion scores (`originality`, `technicalQuality`, `clarity`, `relevance`), and `recommendation`. The `confidentialNote` is stored as a chair-only field and is returned exclusively through the chair-accessible reviews endpoint.

### 8. Rebuttal Phase -- Optional (Author Role)

Authors submit a text rebuttal response to their reviews before final decisions are made. The rebuttal is stored per paper with a submission timestamp and is accessible to the chair.

### 9. Camera-Ready Submission (Author Role)

Authors of accepted papers upload a revised PDF as the camera-ready version. The system stores the revised file on disk, updates the paper's `status` to `"camera_ready"`, and stores the file path as `cameraReadyUrl`. The endpoint accepts uploads exclusively for papers with a `decision` of `"accept"` and returns HTTP 403 for papers with any other decision status.

### 10. Conference Program Builder (Chair Role)

The chair organizes accepted papers into conference sessions. Each session contains a `sessionName`, `startTime` (ISO datetime), `endTime` (ISO datetime), `room` assignment, and a list of `paperIds`. The system persists sessions and returns them with full paper title details. The program is retrievable by any authenticated user.

### 11. Data Persistence and Authentication

All entities are stored in SQLite with a normalized schema and appropriate foreign key constraints. JWT authentication middleware validates tokens on all protected endpoints and returns HTTP 401 for missing tokens and HTTP 401 for invalid tokens. Role-based enforcement returns HTTP 403 when a user's role is insufficient for the requested operation.

---

## Expected Interface

### Server Application Entry Point

---

- **Path:** `server/app.ts`
- **Name:** `app` (default export)
- **Type:** Express Application
- **Input:** None
- **Output:** `Express.Application`
- **Description:** Creates and configures the Express application instance. Registers JSON body parsing middleware, static file serving for uploaded PDFs, the `authenticate` and `authorize` middleware, and all route handlers (`auth`, `conferences`, `papers`, `reviewers`). Calls `initializeDatabase()` during startup before routes are served. The configured `app` is exported as the default export so that both the production server entry point and automated test suites can import it.

---

### Database Initialization and Access

---

- **Path:** `server/database/index.ts`
- **Name:** `initializeDatabase`
- **Type:** function
- **Input:** None
- **Output:** `Promise<void>`
- **Description:** Creates and initializes the SQLite database with a normalized schema covering all entities: users, conferences, papers, reviewer_profiles, assignments, reviews, rebuttals, decisions, and sessions. Enables foreign key constraints (`PRAGMA foreign_keys = ON`). The assignments table includes a `source` column (`TEXT NOT NULL CHECK(source IN ('auto', 'manual')) DEFAULT 'auto'`) to distinguish auto-generated assignments from manually-created ones. Applies a UNIQUE constraint on `(paperId, reviewerId)` in the assignments table to prevent duplicate assignment rows. Creates all tables if they do not already exist. Called once on server startup before any routes are served.

---

- **Path:** `server/database/index.ts`
- **Name:** `getDb`
- **Type:** function
- **Input:** None
- **Output:** `Database` (the `better-sqlite3` `Database` instance)
- **Description:** Returns the SQLite database connection that was created and configured during `initializeDatabase()`. Used by route handlers and the `assignReviewers` service to execute SQL queries against the database. Must be called after `initializeDatabase()` has completed. Throws an error if the database has not been initialized.

---

### Authentication Middleware

---

- **Path:** `server/middleware/auth.ts`
- **Name:** `authenticate`
- **Type:** Express middleware function
- **Input:** Express `Request` with `Authorization: Bearer <token>` header, `Response`, `NextFunction`
- **Output:** Calls `next()` with `req.user` set to `{ id: number, role: string }` on success. Returns HTTP 401 `{ error: string }` when the `Authorization` header is absent. Returns HTTP 401 `{ error: string }` when the token fails signature verification. Returns HTTP 401 `{ error: string }` when the token is expired.
- **Description:** Extracts the JWT from the `Authorization` header, verifies its signature and expiry, and attaches the decoded user payload (`id`, `role`) to the request object. Returns HTTP 401 when the `Authorization` header is absent. Returns HTTP 401 when the token is malformed. Returns HTTP 401 when the token is invalid. Returns HTTP 401 when the token is expired.

---

- **Path:** `server/middleware/auth.ts`
- **Name:** `authorize`
- **Type:** function (returns Express middleware)
- **Input:** `...roles: Array<"chair" | "reviewer" | "author">` (at least one role string from the set `"chair"`, `"reviewer"`, `"author"`)
- **Output:** Express middleware that calls `next()` if `req.user.role` is included in the allowed roles; sends HTTP 403 `{ error: string }` otherwise
- **Description:** Factory function that returns an Express middleware enforcing role-based access control. Must be applied after `authenticate`. Returns HTTP 403 when the authenticated user's role is not among the specified allowed roles.

---

### Authentication Endpoints

---

- **Path:** `server/routes/auth.ts`
- **Name:** `POST /api/auth/register`
- **Type:** API Endpoint
- **Input:** JSON body `{ name: string, email: string, password: string, role: "chair" | "reviewer" | "author" }`
- **Output:** HTTP 201 `{ token: string, user: { id: number, name: string, email: string, role: string } }`
- **Description:** Registers a new user, inserts a record into the database with the password stored as a bcrypt hash, and returns a signed JWT token encoding the user's ID and role.

---

- **Path:** `server/routes/auth.ts`
- **Name:** `POST /api/auth/login`
- **Type:** API Endpoint
- **Input:** JSON body `{ email: string, password: string }`
- **Output:** HTTP 200 `{ token: string, user: { id: number, name: string, email: string, role: string } }` | HTTP 401 on invalid credentials
- **Description:** Verifies the submitted password against the stored bcrypt hash and returns a signed JWT token on success. Returns HTTP 401 for an unrecognized email address and HTTP 401 for an incorrect password.

---

### Conference Management

---

- **Path:** `server/routes/conferences.ts`
- **Name:** `POST /api/conferences`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (chair role), JSON body `{ name: string, description: string, submissionDeadline: string, notificationDate: string, cameraReadyDeadline: string, topicAreas: string[], submissionGuidelines: string }`
- **Output:** HTTP 201 `{ id: number, name: string, description: string, submissionDeadline: string, notificationDate: string, cameraReadyDeadline: string, topicAreas: string[], submissionGuidelines: string }` | HTTP 403 for non-chair roles
- **Description:** Creates a conference record, persists all fields to the database with `topicAreas` stored and returned as a JSON array, and returns the created record. Returns HTTP 403 for non-chair tokens.

---

- **Path:** `server/routes/conferences.ts`
- **Name:** `GET /api/conferences/:id`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>`, URL param `id: number`
- **Output:** HTTP 200 `{ id: number, name: string, description: string, submissionDeadline: string, notificationDate: string, cameraReadyDeadline: string, topicAreas: string[], submissionGuidelines: string }` | HTTP 404 for a non-existent conference ID
- **Description:** Returns the full conference record for the given ID. Returns HTTP 404 for a non-existent conference ID.

---

### Paper Submission

---

- **Path:** `server/routes/papers.ts`
- **Name:** `POST /api/conferences/:conferenceId/papers`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (author role), URL param `conferenceId: number`, multipart/form-data: `file` (PDF binary), `title: string`, `abstract: string`, `authors: string` (JSON-encoded `Array<{ name: string, affiliation: string, email: string }>`), `topicAreas: string` (JSON-encoded `string[]`), `keywords?: string`
- **Output:** HTTP 201 `{ paperId: string, title: string, conferenceId: number, status: "submitted" }`
- **Description:** Checks the conference's `submissionDeadline` against the current server time; returns HTTP 403 `{ error: "Submission deadline has passed" }` if the current time is after the `submissionDeadline`. Otherwise, generates a unique `paperId` for the submission, stores the uploaded PDF on disk, persists all metadata fields to the database, and returns the `paperId` with a `status` of `"submitted"`.

---

- **Path:** `server/routes/papers.ts`
- **Name:** `GET /api/conferences/:conferenceId/papers`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (chair role), URL param `conferenceId: number`
- **Output:** HTTP 200 `{ papers: Array<{ paperId: string, title: string, abstract: string, authors: Array<{ name: string, affiliation: string, email: string }>, topicAreas: string[], keywords: string, conferenceId: number, status: string, decision?: string, pdfUrl: string }> }` | HTTP 403 for non-chair roles
- **Description:** Returns all papers submitted to the specified conference. Each entry includes the full paper metadata, the current `status`, the chair's `decision` if one has been recorded, and the `pdfUrl`. Returns an empty array if no papers have been submitted to the conference. Returns HTTP 403 for non-chair tokens.

---

- **Path:** `server/routes/papers.ts`
- **Name:** `GET /api/papers/:paperId`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>`, URL param `paperId: string`
- **Output:** HTTP 200 `{ paperId: string, title: string, abstract: string, authors?: Array<{ name: string, affiliation: string, email: string }>, topicAreas: string[], keywords: string, conferenceId: number, status: string, pdfUrl: string }`
- **Description:** Returns the paper record including submitted metadata fields and the stored `pdfUrl`. The `authors` array is included only when the requesting user's role is `chair` or when the requesting user is the paper's submitting author. For reviewers, the `authors` field is omitted from the response to preserve review integrity and prevent unauthorized access to author identity metadata.

---

### Reviewer Profile

---

- **Path:** `server/routes/reviewers.ts`
- **Name:** `PUT /api/reviewers/profile`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (reviewer role), JSON body `{ expertise: string[], conflicts: string[] }`
- **Output:** HTTP 200 `{ reviewerId: number, expertise: string[], conflicts: string[] }`
- **Description:** Persists the reviewer's `expertise` and `conflicts` arrays to the database and returns the updated profile. Returns HTTP 403 for non-reviewer tokens.

---

- **Path:** `server/routes/reviewers.ts`
- **Name:** `GET /api/reviewers/profile`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (reviewer role)
- **Output:** HTTP 200 `{ reviewerId: number, expertise: string[], conflicts: string[] }`
- **Description:** Returns the authenticated reviewer's stored `expertise` and `conflicts` arrays from the database. Returns HTTP 403 for non-reviewer tokens.

---

### Reviewer Assignments

---

- **Path:** `server/routes/reviewers.ts`
- **Name:** `GET /api/reviewers/assignments`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (reviewer role)
- **Output:** HTTP 200 `{ assignments: Array<{ paperId: string, title: string, conferenceId: number, pdfUrl: string, reviewed: boolean }> }`
- **Description:** Returns all papers assigned to the authenticated reviewer across all conferences. Each entry includes the `paperId`, `title`, `conferenceId`, `pdfUrl` for accessing the submitted PDF, and a `reviewed` boolean indicating whether the reviewer has already submitted a review for that paper. Returns HTTP 403 for non-reviewer tokens.

---

### Review Assignment Algorithm

---

- **Path:** `server/services/assignment.ts`
- **Name:** `assignReviewers`
- **Type:** function
- **Input:** `conferenceId: number, reviewersPerPaper: number` (default `reviewersPerPaper = 3`)
- **Output:** `Promise<{ assignments: Array<{ paperId: string, reviewerId: number }>, underAssignedPaperIds: string[], unassignedPaperIds: string[] }>`
- **Description:** Applies topic-overlap and conflict-free constraints as hard requirements and treats `reviewersPerPaper` as a best-effort target. When counting existing reviewers for each paper, includes any existing manual assignments (`source = 'manual'`) so that auto-assignment does not duplicate or conflict with the chair's manual corrections. Assigns up to `reviewersPerPaper` eligible reviewers to each paper. Papers with at least 1 but fewer than `reviewersPerPaper` eligible reviewers (counting both auto and manual assignments) are included in `assignments` with as many reviewers as available and are additionally listed in `underAssignedPaperIds`. Papers with zero eligible reviewers are excluded from `assignments` and listed in `unassignedPaperIds`. Subject to the two hard constraints and the reviewer-count target, distributes assignments as evenly as possible across eligible reviewers to minimize the difference in assignment count between the most-loaded and least-loaded reviewer. All assignments produced by this function are persisted with `source = 'auto'`.

---

- **Path:** `server/routes/conferences.ts`
- **Name:** `POST /api/conferences/:conferenceId/assign`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (chair role), URL param `conferenceId: number`, optional JSON body `{ reviewersPerPaper?: number }` (defaults to 3 if omitted)
- **Output:** HTTP 200 `{ assignments: Array<{ assignmentId: number, paperId: string, reviewerId: number }>, underAssignedPaperIds: string[], unassignedPaperIds: string[] }`
- **Description:** Deletes all existing assignments where `source = 'auto'` for the conference before invoking the assignment algorithm, preserving any manually-created assignments (`source = 'manual'`). This ensures idempotent behavior on repeated calls without destroying the chair's manual corrections. Invokes the automatic assignment algorithm with the specified `reviewersPerPaper` count (defaulting to 3), persists all resulting assignments to the database with `source = 'auto'`, and returns the complete assignment list including each database-generated `assignmentId`, an `underAssignedPaperIds` array listing papers that received fewer than `reviewersPerPaper` reviewers, and an `unassignedPaperIds` array listing papers with zero eligible reviewers. Returns HTTP 403 for non-chair tokens.

---

- **Path:** `server/routes/conferences.ts`
- **Name:** `POST /api/conferences/:conferenceId/assignments`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (chair role), URL param `conferenceId: number`, JSON body `{ paperId: string, reviewerId: number }`
- **Output:** HTTP 201 `{ assignmentId: number, paperId: string, reviewerId: number }`
- **Description:** Manually creates a single assignment between the specified paper and reviewer for the conference with `source = 'manual'`, persists the assignment, and returns the created row including its database-generated `assignmentId`. Manual assignments are preserved when the auto-assign endpoint is re-run. Returns HTTP 403 for non-chair tokens.

---

- **Path:** `server/routes/conferences.ts`
- **Name:** `DELETE /api/conferences/:conferenceId/assignments/:assignmentId`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (chair role), URL params `conferenceId: number`, `assignmentId: number`
- **Output:** HTTP 200 `{ message: string }` | HTTP 404 if the assignment does not exist
- **Description:** Removes a single assignment record from the database. Returns HTTP 403 for non-chair tokens. Returns HTTP 404 if no assignment matching `assignmentId` exists within the specified conference.

---

### Review Submission

---

- **Path:** `server/routes/papers.ts`
- **Name:** `POST /api/papers/:paperId/reviews`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (reviewer role), URL param `paperId: string`, JSON body `{ originality: integer (1–5), technicalQuality: integer (1–5), clarity: integer (1–5), relevance: integer (1–5), recommendation: "accept" | "weak_accept" | "weak_reject" | "reject", reviewText: string, confidentialNote: string }`
- **Output:** HTTP 201 `{ reviewId: number, paperId: string, reviewerId: number, recommendation: string }` | HTTP 403 if the reviewer has no assignment for that paper
- **Description:** Validates that the submitting reviewer holds an assignment for the specified paper, then persists all score fields, `recommendation`, `reviewText`, and `confidentialNote` as separate database fields.

---

- **Path:** `server/routes/papers.ts`
- **Name:** `GET /api/papers/:paperId/reviews`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (chair role), URL param `paperId: string`
- **Output:** HTTP 200 `{ reviews: Array<{ reviewId: number, reviewerId: number, originality: number, technicalQuality: number, clarity: number, relevance: number, recommendation: string, reviewText: string, confidentialNote: string }> }` | HTTP 403 for non-chair roles
- **Description:** Returns the complete review payload for each review of the specified paper, including all score fields, `reviewText`, and `confidentialNote`. Returns HTTP 403 for non-chair tokens.

---

### Chair Decision

---

- **Path:** `server/routes/papers.ts`
- **Name:** `POST /api/papers/:paperId/decision`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (chair role), URL param `paperId: string`, JSON body `{ decision: "accept" | "reject" }`
- **Output:** HTTP 200 `{ paperId: string, decision: string, status: string }`
- **Description:** Persists the chair's final decision to the database and updates the paper's `status` to `"accepted"` for a `"accept"` input and `"rejected"` for a `"reject"` input.

---

- **Path:** `server/routes/conferences.ts`
- **Name:** `GET /api/conferences/:conferenceId/stats`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (chair role), URL param `conferenceId: number`
- **Output:** HTTP 200 `{ totalPapers: number, accepted: number, rejected: number, acceptanceRate: number, scoreDistributions: { originality: number[], technicalQuality: number[], clarity: number[], relevance: number[] } }`
- **Description:** Computes and returns aggregate conference statistics. `acceptanceRate` is computed as `accepted / totalPapers`. When `totalPapers` is 0, `acceptanceRate` is 0. Each array in `scoreDistributions` contains one entry per submitted review for that criterion.

---

### Author Notification

---

- **Path:** `server/routes/papers.ts`
- **Name:** `GET /api/papers/:paperId/notification`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (author role), URL param `paperId: string`
- **Output:** HTTP 200 `{ paperId: string, decision: "accept" | "reject" | "pending", decisionFinal: boolean, reviews: Array<{ reviewText: string, originality: number, technicalQuality: number, clarity: number, relevance: number, recommendation: string }> }`
- **Description:** Returns the chair's final decision and the anonymized review content for the paper's submitting author. The `reviews` array includes all submitted reviews whenever they exist, regardless of whether a final decision has been recorded — this allows authors to view reviews during the rebuttal phase before a decision is made. Each review entry includes exactly `reviewText`, `originality`, `technicalQuality`, `clarity`, `relevance`, and `recommendation`. The `decisionFinal` boolean is `true` when the chair has recorded a final `"accept"` or `"reject"` decision, and `false` when `decision` is `"pending"`. The `confidentialNote` field is excluded from this response in all cases. Returns HTTP 403 for tokens belonging to users other than the paper's submitting author.

---

- **Path:** `server/routes/papers.ts`
- **Name:** `GET /api/papers/:paperId/reviews-for-rebuttal`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (author role), URL param `paperId: string`
- **Output:** HTTP 200 `{ paperId: string, reviews: Array<{ reviewText: string, originality: number, technicalQuality: number, clarity: number, relevance: number, recommendation: string }> }` | HTTP 403 if the paper already has a final decision or the rebuttal period is closed
- **Description:** Convenience endpoint that returns anonymized review content for the paper's submitting author during the rebuttal phase only. While the notification endpoint (`GET /api/papers/:paperId/notification`) also returns reviews at any time, this endpoint enforces rebuttal-phase timing constraints: it checks that no final decision has been recorded and that the current server time is before the conference's `notificationDate`. If either condition fails, returns HTTP 403. The `confidentialNote` field is excluded. Returns HTTP 403 for tokens belonging to users other than the paper's submitting author.

---

### Rebuttal

---

- **Path:** `server/routes/papers.ts`
- **Name:** `POST /api/papers/:paperId/rebuttal`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (author role), URL param `paperId: string`, JSON body `{ rebuttalText: string }`
- **Output:** HTTP 201 `{ paperId: string, rebuttalText: string, submittedAt: string }` | HTTP 409 if a final decision has already been recorded for the paper
- **Description:** Looks up the conference associated with the paper and checks the conference's `notificationDate` against the current server time; returns HTTP 403 `{ error: "Rebuttal period has closed" }` if the current time is after the `notificationDate`. Otherwise, persists the author's rebuttal text with a `submittedAt` ISO timestamp only when no final decision has been recorded for the paper. Returns HTTP 403 for tokens belonging to users other than the paper's submitting author. Returns HTTP 409 when a final decision already exists.

---

- **Path:** `server/routes/papers.ts`
- **Name:** `GET /api/papers/:paperId/rebuttal`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (chair role), URL param `paperId: string`
- **Output:** HTTP 200 `{ paperId: string, rebuttalText: string, submittedAt: string }` | HTTP 404 if no rebuttal has been submitted for the paper
- **Description:** Returns the stored rebuttal text and submission timestamp for the specified paper. Accessible exclusively to the chair role. Returns HTTP 403 for non-chair tokens and HTTP 404 if no rebuttal exists for the given paper.

---

### Camera-Ready Submission

---

- **Path:** `server/routes/papers.ts`
- **Name:** `POST /api/papers/:paperId/camera-ready`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (author role), URL param `paperId: string`, multipart/form-data: `file` (revised PDF binary)
- **Output:** HTTP 200 `{ paperId: string, status: "camera_ready", cameraReadyUrl: string }` | HTTP 403 if the authenticated user is not the paper's submitting author or if the paper's decision is not `"accept"`
- **Description:** Looks up the conference associated with the paper and checks the conference's `cameraReadyDeadline` against the current server time; returns HTTP 403 `{ error: "Camera-ready deadline has passed" }` if the current time is after the `cameraReadyDeadline`. Otherwise, stores the revised PDF on disk, updates the paper's `status` to `"camera_ready"`, and returns the stored file path as `cameraReadyUrl`. Returns HTTP 403 for tokens belonging to users other than the paper's submitting author. Returns HTTP 403 for papers whose decision is not `"accept"`.

---

### Conference Program

---

- **Path:** `server/routes/conferences.ts`
- **Name:** `POST /api/conferences/:conferenceId/program`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>` (chair role), URL param `conferenceId: number`, JSON body `{ sessions: Array<{ sessionName: string, startTime: string, endTime: string, room: string, paperIds: string[] }> }`
- **Output:** HTTP 201 `{ conferenceId: number, sessions: Array<{ sessionId: number, sessionName: string, startTime: string, endTime: string, room: string, papers: Array<{ paperId: string, title: string }> }> }`
- **Description:** Persists all sessions with their time slots, room assignments, and paper associations. Populates each session's `papers` array with the `paperId` and `title` of each assigned paper. Returns HTTP 403 for non-chair tokens.

---

- **Path:** `server/routes/conferences.ts`
- **Name:** `GET /api/conferences/:conferenceId/program`
- **Type:** API Endpoint
- **Input:** `Authorization: Bearer <token>`, URL param `conferenceId: number`
- **Output:** HTTP 200 `{ conferenceId: number, sessions: Array<{ sessionId: number, sessionName: string, startTime: string, endTime: string, room: string, papers: Array<{ paperId: string, title: string }> }> }`
- **Description:** Returns the complete conference program including all sessions with their `startTime`, `endTime`, `room`, and associated paper details. Accessible by any authenticated user.

---

### Frontend React Components

---

- **Path:** `client/src/components/ConferenceCreationForm.tsx`
- **Name:** `ConferenceCreationForm`
- **Type:** React Component
- **Input:** `props: { onSubmit: (data: { name: string, description: string, submissionDeadline: string, notificationDate: string, cameraReadyDeadline: string, topicAreas: string[], submissionGuidelines: string }) => void }`
- **Output:** `JSX.Element`
- **Description:** Renders inputs for `name`, `description`, date inputs for `submissionDeadline`, `notificationDate`, and `cameraReadyDeadline`, a dynamic input for adding entries to `topicAreas`, and a `submissionGuidelines` textarea. Invokes `onSubmit` with the complete data object on form submission.

---

- **Path:** `client/src/components/PaperSubmissionForm.tsx`
- **Name:** `PaperSubmissionForm`
- **Type:** React Component
- **Input:** `props: { conferenceId: number, topicAreas: string[], onSubmit: (data: FormData) => void }`
- **Output:** `JSX.Element`
- **Description:** Renders inputs for `title`, `abstract`, a dynamic author list with `name`, `affiliation`, and `email` fields per entry, topic area checkboxes derived from `props.topicAreas`, a `keywords` text input, and a PDF file input. Invokes `onSubmit` with a `FormData` object on form submission.

---

- **Path:** `client/src/components/ReviewerDashboard.tsx`
- **Name:** `ReviewerDashboard`
- **Type:** React Component
- **Input:** `props: { papers: Array<{ paperId: string, title: string, pdfUrl: string, reviewed: boolean }>, onSelectPaper: (paperId: string) => void }`
- **Output:** `JSX.Element`
- **Description:** Renders one list entry per paper in `props.papers`. Each entry displays the paper `title`, a link to the `pdfUrl`, and a visual indicator reflecting the `reviewed` boolean state. Clicking an entry invokes `onSelectPaper` with the entry's `paperId`.

---

- **Path:** `client/src/components/ReviewForm.tsx`
- **Name:** `ReviewForm`
- **Type:** React Component
- **Input:** `props: { paperId: string, onSubmit: (review: { originality: number, technicalQuality: number, clarity: number, relevance: number, recommendation: string, reviewText: string, confidentialNote: string }) => void }`
- **Output:** `JSX.Element`
- **Description:** Renders four integer score inputs for `originality`, `technicalQuality`, `clarity`, and `relevance` accepting values 1–5, a `recommendation` dropdown containing the four values `accept`, `weak_accept`, `weak_reject`, and `reject`, a `reviewText` textarea, and a `confidentialNote` textarea. Invokes `onSubmit` with the complete review object on form submission.

---

- **Path:** `client/src/components/ChairDecisionDashboard.tsx`
- **Name:** `ChairDecisionDashboard`
- **Type:** React Component
- **Input:** `props: { papers: Array<{ paperId: string, title: string, reviews: Array<{ originality: number, technicalQuality: number, clarity: number, relevance: number, recommendation: string, reviewText: string, confidentialNote: string }>, decision?: string }>, stats: { totalPapers: number, accepted: number, rejected: number, acceptanceRate: number, scoreDistributions: { originality: number[], technicalQuality: number[], clarity: number[], relevance: number[] } }, onDecide: (paperId: string, decision: "accept" | "reject") => void }`
- **Output:** `JSX.Element`
- **Description:** Renders a list of papers with their full review data including scores and `confidentialNote`, a statistics section displaying `acceptanceRate` and per-criterion `scoreDistributions` from `props.stats`, and accept/reject action buttons per paper. Clicking the accept button for a paper invokes `onDecide` with that paper's `paperId` and `"accept"`. Clicking the reject button invokes `onDecide` with that paper's `paperId` and `"reject"`.

---

- **Path:** `client/src/components/ProgramBuilder.tsx`
- **Name:** `ProgramBuilder`
- **Type:** React Component
- **Input:** `props: { conferenceId: number, acceptedPapers: Array<{ paperId: string, title: string }>, onSave: (sessions: Array<{ sessionName: string, startTime: string, endTime: string, room: string, paperIds: string[] }>) => void }`
- **Output:** `JSX.Element`
- **Description:** Renders session creation inputs for `sessionName`, `startTime`, `endTime`, and `room`, and a mechanism to assign papers from `props.acceptedPapers` to each session. Invokes `onSave` with the complete sessions array on save.

---

- **Path:** `client/src/components/AuthForm.tsx`
- **Name:** `AuthForm`
- **Type:** React Component
- **Input:** `props: { mode: "login" | "register", onSubmit: (credentials: { name?: string, email: string, password: string, role?: "chair" | "reviewer" | "author" }) => void, onToggleMode: () => void }`
- **Output:** `JSX.Element`
- **Description:** Renders authentication inputs for `email` and `password` in both modes, plus `name` and `role` when in register mode. Supports switching between login and register states and invokes `onSubmit` with the entered credentials on form submission so users can obtain JWT tokens for protected actions.

---

- **Path:** `client/src/components/ReviewerProfileForm.tsx`
- **Name:** `ReviewerProfileForm`
- **Type:** React Component
- **Input:** `props: { existingProfile?: { expertise: string[], conflicts: string[] }, onSubmit: (profile: { expertise: string[], conflicts: string[] }) => void }`
- **Output:** `JSX.Element`
- **Description:** Renders editable controls for a reviewer's `expertise` and `conflicts` arrays, pre-populating from `existingProfile` when provided. Invokes `onSubmit` with the updated profile payload for creating or updating reviewer profile data.

---

- **Path:** `client/src/components/AuthorNotificationView.tsx`
- **Name:** `AuthorNotificationView`
- **Type:** React Component
- **Input:** `props: { notification: { paperId: string, decision: "accept" | "reject" | "pending", decisionFinal: boolean, reviews: Array<{ reviewText: string, originality: number, technicalQuality: number, clarity: number, relevance: number, recommendation: string }> } }`
- **Output:** `JSX.Element`
- **Description:** Renders the decision status and anonymized review content for an author's paper, displaying per-criterion scores and recommendations while excluding any `confidentialNote` field. When `decisionFinal` is `false`, indicates to the author that the decision is still pending and reviews are shown for rebuttal purposes. When `decisionFinal` is `true`, displays the final accept/reject decision alongside the reviews.

---

- **Path:** `client/src/components/RebuttalForm.tsx`
- **Name:** `RebuttalForm`
- **Type:** React Component
- **Input:** `props: { paperId: string, initialText?: string, onSubmit: (payload: { rebuttalText: string }) => void }`
- **Output:** `JSX.Element`
- **Description:** Renders a textarea for composing a rebuttal and submits the entered rebuttal text for the specified paper via `onSubmit`.

---

- **Path:** `client/src/components/CameraReadyUploadForm.tsx`
- **Name:** `CameraReadyUploadForm`
- **Type:** React Component
- **Input:** `props: { paperId: string, onSubmit: (data: FormData) => void }`
- **Output:** `JSX.Element`
- **Description:** Renders a PDF file input for uploading an accepted paper's camera-ready version and invokes `onSubmit` with multipart `FormData` containing the file.

---

## Deliverables

- All server-side route files under `server/routes/` implementing every API endpoint defined in the Expected Interface
- The assignment service at `server/services/assignment.ts` implementing the `assignReviewers` function
- All React component files under `client/src/components/` implementing every component defined in the Expected Interface
- A SQLite database initialized on startup with a normalized schema and foreign key constraints covering all entities
- JWT authentication middleware enforcing token validation and role-based access control on all protected endpoints
- PDF file storage for paper submissions and camera-ready uploads persisted to disk with accessible file URLs
- A fully functional full-stack application with all 11 features implemented and integrated end-to-end

---
