import { Router } from 'express';
import { applicationsCollection } from '../config/db.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

// =============================================================
// Applications module
//
// POST  /api/applications             -> student: apply to a tuition   ✅
// GET   /api/applications/mine        -> student: own applications     ✅
// GET   /api/applications/tuition/:id -> owner tutor: applicants       ⬜ (later)
// PATCH /api/applications/:id/status  -> owner tutor: accept / reject  ⬜ (later)
//
// Ownership rules:
// - students only ever see their own records (studentEmail match)
// - tutors only ever see applications for their own tuitions (tutorEmail match)
// =============================================================

// POST /api/applications - student applies to a tuition.
// A new application always starts as "pending".
// TODO(Phase 0): verify the JWT and take studentEmail from req.user,
// not from the body (same temporary trust as POST /api/tuitions).
router.post('/', async (req, res) => {
  const {
    tuitionId,
    tuitionTitle,
    subject,
    monthlyFee,
    tutorEmail,
    studentName,
    studentEmail,
    studentPhone,
    preferredSchedule,
    studentNote,
  } = req.body;

  if (!tuitionId || !studentEmail || !studentPhone) {
    throw new ApiError(
      400,
      'tuitionId, studentEmail and studentPhone are required'
    );
  }

  // One student can apply to the same tuition only once.
  const existing = await applicationsCollection.findOne({
    tuitionId,
    studentEmail,
  });

  if (existing) {
    throw new ApiError(400, 'You have already applied for this tuition');
  }

  const application = {
    tuitionId,
    tuitionTitle: tuitionTitle || '',
    subject: subject || '',
    monthlyFee: monthlyFee ?? 0,
    tutorEmail: tutorEmail || '',
    studentName: studentName || '',
    studentEmail,
    studentPhone,
    preferredSchedule: preferredSchedule || '',
    studentNote: studentNote || '',
    status: 'pending', // tutor accepts / rejects later
    appliedAt: new Date(),
  };

  const result = await applicationsCollection.insertOne(application);

  ApiResponse.success(res, {
    statusCode: 201,
    message: 'application submitted successfully',
    data: { ...application, _id: result.insertedId },
  });
});

// GET /api/applications/mine?studentEmail=... - own applications ONLY.
// TODO(Phase 0): studentEmail must come from the verified JWT.
router.get('/mine', async (req, res) => {
  const { studentEmail } = req.query;

  if (!studentEmail) {
    throw new ApiError(400, 'studentEmail query param is required');
  }

  const applications = await applicationsCollection
    .find({ studentEmail })
    .sort({ appliedAt: -1 })
    .toArray();

  ApiResponse.success(res, {
    message: 'applications fetched successfully',
    data: applications,
  });
});

export default router;
