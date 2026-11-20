import { Router } from 'express';
import { ApiResponse } from '../utils/ApiResponse.js';

const router = Router();

// =============================================================
// Users module — PLANNED endpoints (Phase 1, not implemented yet)
//
// GET   /api/users               -> admin: list all users
// GET   /api/users/:email        -> self or admin: get a user
// PATCH /api/users/profile       -> self: update own profile
//                                   (name, phone, bio, image)
// PATCH /api/users/:email/role   -> admin: change a user's role
//
// All endpoints will require verifyToken + requireRole middleware.
// =============================================================


router.get('/', (req, res) => {
  ApiResponse.success(res, { message: 'users retrived successfully' });
})


export default router;
