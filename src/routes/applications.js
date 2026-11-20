import { Router } from 'express';

const router = Router();

// =============================================================
// Applications module — PLANNED endpoints (Phase 3, not implemented yet)
//
// POST  /api/applications                  -> student: apply to a tuition
// GET   /api/applications/mine             -> student: own applications ONLY
// GET   /api/applications/tuition/:id      -> owner tutor: applicants for a tuition
// PATCH /api/applications/:id/status       -> owner tutor: accept / reject
//
// Ownership rules:
// - students only ever see their own records (studentEmail match)
// - tutors only ever see applications for their own tuitions (tutorEmail match)
// =============================================================

export default router;
