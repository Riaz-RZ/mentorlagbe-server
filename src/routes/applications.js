import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { applicationsCollection, tuitionsCollection } from '../config/db.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { getPlan } from '../utils/plan.js';
import { ensureDatabase } from '../middleware/ensureDatabase.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

// =============================================================
// Applications module
//
// POST  /api/applications             -> student: apply to a tuition   ✅
// GET   /api/applications/mine        -> student: own applications     ✅
// GET   /api/applications/tutor       -> tutor: applicants for my posts ✅
// PATCH /api/applications/:id/status  -> tutor: accept / reject        ✅
//
// Ownership rules:
// - students only ever see their own records (studentEmail match)
// - tutors only ever see applications for their own tuitions (tutorEmail match)
// =============================================================

// POST /api/applications - student applies to an approved tuition.
// Identity and tuition snapshots are taken from trusted server data.
router.post('/', verifyToken, requireRole('student'), ensureDatabase, async (req, res) => {
  const {
    tuitionId,
    studentPhone,
    preferredSchedule,
    studentNote,
  } = req.body;
  const { email: studentEmail, name: studentName } = req.user;

  if (
    typeof tuitionId !== 'string' ||
    !ObjectId.isValid(tuitionId) ||
    !studentPhone
  ) {
    throw new ApiError(400, 'A valid tuitionId and studentPhone are required');
  }

  const tuition = await tuitionsCollection.findOne({
    _id: new ObjectId(tuitionId),
    approvalStatus: 'approved',
    isActive: true,
  });

  if (!tuition) {
    throw new ApiError(404, 'tuition not found');
  }

  // One student can apply to the same tuition only once.
  const existing = await applicationsCollection.findOne({
    tuitionId,
    studentEmail,
  });

  if (existing) {
    throw new ApiError(400, 'You have already applied for this tuition');
  }

  // Plan limit: free students can apply to up to 5 tuitions (pro = unlimited).
  if ((await getPlan(studentEmail)) !== 'pro') {
    const count = await applicationsCollection.countDocuments({ studentEmail });

    if (count >= 5) {
      throw new ApiError(
        403,
        'Free plan allows up to 5 applications. Upgrade to Pro for unlimited applications!'
      );
    }
  }

  const application = {
    tuitionId,
    tuitionTitle: tuition.title,
    subject: tuition.subject,
    monthlyFee: tuition.monthlyFee,
    tutorEmail: tuition.tutorEmail,
    studentName,
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

// GET /api/applications/mine - the logged-in student's own applications.
router.get('/mine', verifyToken, requireRole('student'), ensureDatabase, async (req, res) => {
  const applications = await applicationsCollection
    .find({ studentEmail: req.user.email })
    .sort({ appliedAt: -1 })
    .toArray();

  ApiResponse.success(res, {
    message: 'applications fetched successfully',
    data: applications,
  });
});

// GET /api/applications/tutor - applications for the tutor's own tuition posts.
router.get('/tutor', verifyToken, requireRole('tutor', 'admin'), ensureDatabase, async (req, res) => {
  let filter = {};

  if (req.user.role === 'tutor') {
    const tuitions = await tuitionsCollection
      .find({ tutorEmail: req.user.email }, { projection: { _id: 1 } })
      .toArray();
    const tuitionIds = tuitions.map((tuition) => String(tuition._id));

    if (tuitionIds.length === 0) {
      ApiResponse.success(res, {
        message: 'applications fetched successfully',
        data: [],
      });
      return;
    }

    filter = { tuitionId: { $in: tuitionIds } };
  }

  const applications = await applicationsCollection
    .find(filter)
    .sort({ appliedAt: -1 })
    .toArray();

  ApiResponse.success(res, {
    message: 'applications fetched successfully',
    data: applications,
  });
});

// PATCH /api/applications/:id/status - tutor accepts or rejects one
// application. The student sees the new status on My Applications.
router.patch('/:id/status', verifyToken, requireRole('tutor', 'admin'), ensureDatabase, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!ObjectId.isValid(id)) {
    throw new ApiError(404, 'application not found');
  }

  const allowed = ['accepted', 'rejected'];
  if (!allowed.includes(status)) {
    throw new ApiError(400, 'status must be accepted or rejected');
  }

  const application = await applicationsCollection.findOne({
    _id: new ObjectId(id),
  });

  if (!application) {
    throw new ApiError(404, 'application not found');
  }

  if (req.user.role === 'tutor') {
    if (!ObjectId.isValid(application.tuitionId)) {
      throw new ApiError(404, 'application not found');
    }

    const ownedTuition = await tuitionsCollection.findOne({
      _id: new ObjectId(application.tuitionId),
      tutorEmail: req.user.email,
    });

    if (!ownedTuition) {
      throw new ApiError(404, 'application not found');
    }
  }

  const result = await applicationsCollection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { status } },
    { returnDocument: 'after' }
  );

  if (!result) {
    throw new ApiError(404, 'application not found');
  }

  ApiResponse.success(res, {
    message: `application ${status} successfully`,
    data: result,
  });
});

export default router;
