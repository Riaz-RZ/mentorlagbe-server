import { Router } from 'express';

const router = Router();

// =============================================================
// Tuitions module — PLANNED endpoints (Phase 2, not implemented yet)
//
// POST   /api/tuitions                -> tutor: create a tuition post
// GET    /api/tuitions                -> public: list approved tuitions
//                                        (with search/filter query params)
// GET    /api/tuitions/mine           -> tutor: list own tuitions
// GET    /api/tuitions/:id            -> public: get one tuition
// PATCH  /api/tuitions/:id            -> owner tutor: edit
// PATCH  /api/tuitions/:id/status     -> admin: approve / reject
// PATCH  /api/tuitions/:id/active     -> owner tutor: toggle isActive
//
// Ownership rule: tutorEmail in the JWT must match the tuition owner.
// =============================================================

export default router;
