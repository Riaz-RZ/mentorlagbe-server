import { Router } from 'express';
import { tuitionsCollection } from '../config/db.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

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

// POST /api/tuitions - create a tuition post
// NOTE: async errors are automatically forwarded to the global error
// handler by Express 5, so `throw new ApiError(...)` works here.
router.post('/', async (req, res) => {
  const {
    title,
    subject,
    classLevel,
    mode,
    location,
    monthlyFee,
    daysPerWeek,
    bannerImage,
    description,
    tutorName,
    tutorEmail,
  } = req.body;

  // Basic input validation
  if (!title || !subject || !classLevel || monthlyFee === undefined) {
    throw new ApiError(
      400,
      'title, subject, classLevel and monthlyFee are required'
    );
  }

  const tuition = {
    title,
    subject,
    classLevel,
    mode: mode || 'online',
    location: location || '',
    monthlyFee: Number(monthlyFee),
    daysPerWeek: Number(daysPerWeek) || 0,
    bannerImage: bannerImage || '',
    description: description || '',

    // TODO(Phase 0): replace with values from the verified JWT once
    // verifyToken middleware exists - never trust these from the client.
    tutorName: tutorName || '',
    tutorEmail: tutorEmail || '',

    // These are decided by the SERVER only - never taken from req.body,
    // so a client cannot post something that is already "approved".
    approvalStatus: 'pending',
    isActive: true,
    createdAt: new Date(),
  };

  const result = await tuitionsCollection.insertOne(tuition);

  ApiResponse.success(res, {
    statusCode: 201,
    message: 'tuitions added successfully',
    data: { _id: result.insertedId, ...tuition },
  });
});

// GET /api/tuitions - public list: only APPROVED tuitions are visible
router.get('/', async (req, res) => {
  const tuitions = await tuitionsCollection
    .find({ approvalStatus: 'approved' })
    .toArray();

  ApiResponse.success(res, {
    message: 'tuitions fetched successfully',
    data: tuitions,
  });
});

export default router;
