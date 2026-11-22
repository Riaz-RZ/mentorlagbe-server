import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { tuitionsCollection } from '../config/db.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

// =============================================================
// Tuitions module
//
// POST   /api/tuitions                -> tutor: create a tuition post  ✅
// GET    /api/tuitions                -> public: list approved tuitions ✅
// GET    /api/tuitions/latest         -> public: 6 newest approved      ✅
// GET    /api/tuitions/mine           -> tutor: list own tuitions       ✅
// GET    /api/tuitions/all            -> admin: list ALL tuitions       ✅
// PATCH  /api/tuitions/:id            -> owner tutor: edit              ✅
// PATCH  /api/tuitions/:id/status     -> admin: approve / reject        ✅
// DELETE /api/tuitions/:id            -> owner tutor: delete            ✅
// GET    /api/tuitions/:id            -> public: get one tuition        ✅
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

// GET /api/tuitions/mine - the logged-in tutor's OWN tuitions (all statuses)
// TODO(Phase 0): read tutorEmail from the verified JWT instead of the
// query string - until verifyToken exists this trusts the client.
router.get('/mine', async (req, res) => {
  const { tutorEmail } = req.query;

  if (!tutorEmail) {
    throw new ApiError(400, 'tutorEmail query param is required');
  }

  const tuitions = await tuitionsCollection
    .find({ tutorEmail: String(tutorEmail) })
    .sort({ createdAt: -1 })
    .toArray();

  ApiResponse.success(res, {
    message: 'tuitions fetched successfully',
    data: tuitions,
  });
});

// GET /api/tuitions/all - admin: EVERY tuition (all statuses), newest first
// Used by the admin moderation page for its Pending/Approved/Rejected counts.
// TODO(Phase 0): add verifyToken + requireRole('admin') here.
router.get('/all', async (req, res) => {
  const tuitions = await tuitionsCollection
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  ApiResponse.success(res, {
    message: 'tuitions fetched successfully',
    data: tuitions,
  });
});

// GET /api/tuitions - public list: only APPROVED AND ACTIVE tuitions
// are visible to students (admin approves first, tutor can close later).
router.get('/', async (req, res) => {
  const tuitions = await tuitionsCollection
    .find({ approvalStatus: 'approved', isActive: true })
    .toArray();

  ApiResponse.success(res, {
    message: 'tuitions fetched successfully',
    data: tuitions,
  });
});

// GET /api/tuitions/latest - public: the 6 newest approved + active
// tuitions, for the homepage "Featured Tuitions" section.
// NOTE: must stay ABOVE /:id, otherwise "latest" is treated as an id.
router.get('/latest', async (req, res) => {
  const tuitions = await tuitionsCollection
    .find({ approvalStatus: 'approved', isActive: true })
    .sort({ createdAt: -1 })
    .limit(6)
    .toArray();

  ApiResponse.success(res, {
    message: 'latest tuitions fetched successfully',
    data: tuitions,
  });
});

// GET /api/tuitions/:id - public: get ONE tuition for the details page.
// Same rule as the list: students only ever see approved + active posts.
// NOTE: defined after /mine and /all so those paths are not captured by :id.
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    throw new ApiError(404, 'tuition not found');
  }

  const tuition = await tuitionsCollection.findOne({
    _id: new ObjectId(id),
    approvalStatus: 'approved',
    isActive: true,
  });

  if (!tuition) {
    throw new ApiError(404, 'tuition not found');
  }

  ApiResponse.success(res, {
    message: 'tuition fetched successfully',
    data: tuition,
  });
});

// PATCH /api/tuitions/:id/status - admin changes the approval status.
// Body: { approvalStatus: "pending" | "approved" | "rejected" }
// Frontend uses it for Approve (approved), Reject (rejected) and
// Reinstate (rejected -> approved).
// TODO(Phase 0): requireRole('admin') once the JWT middleware exists.
router.patch('/:id/status', async (req, res) => {
  const { id } = req.params;
  const { approvalStatus } = req.body;

  if (!ObjectId.isValid(id)) {
    throw new ApiError(404, 'tuition not found');
  }

  const allowed = ['pending', 'approved', 'rejected'];
  if (!allowed.includes(approvalStatus)) {
    throw new ApiError(400, 'approvalStatus must be pending, approved or rejected');
  }

  const result = await tuitionsCollection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { approvalStatus } },
    { returnDocument: 'after' }
  );

  if (!result) {
    throw new ApiError(404, 'tuition not found');
  }

  ApiResponse.success(res, {
    message: `tuition ${approvalStatus} successfully`,
    data: result,
  });
});

// PATCH /api/tuitions/:id - the owner tutor edits their own tuition post
// TODO(Phase 0): verify the tutor owns this tuition (tutorEmail in JWT)
// once verifyToken middleware exists - until then this trusts the client.
router.patch('/:id', async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    throw new ApiError(404, 'tuition not found');
  }

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
    isActive,
  } = req.body;

  // Same required fields as POST - the edit form always sends them all.
  if (!title || !subject || !classLevel || monthlyFee === undefined) {
    throw new ApiError(
      400,
      'title, subject, classLevel and monthlyFee are required'
    );
  }

  // Only the fields a tutor may edit. approvalStatus is NEVER touched
  // here - only an admin can approve/reject a post.
  const updates = {
    title,
    subject,
    classLevel,
    mode: mode || 'online',
    location: location || '',
    monthlyFee: Number(monthlyFee),
    daysPerWeek: Number(daysPerWeek) || 0,
    bannerImage: bannerImage || '',
    description: description || '',
    isActive: Boolean(isActive),
  };

  const result = await tuitionsCollection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updates },
    { returnDocument: 'after' }
  );

  if (!result) {
    throw new ApiError(404, 'tuition not found');
  }

  ApiResponse.success(res, {
    message: 'tuition updated successfully',
    data: result,
  });
});

// DELETE /api/tuitions/:id - the owner tutor deletes their tuition post
// TODO(Phase 0): same ownership check as PATCH (JWT) later.
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    throw new ApiError(404, 'tuition not found');
  }

  const result = await tuitionsCollection.deleteOne({ _id: new ObjectId(id) });

  if (result.deletedCount === 0) {
    throw new ApiError(404, 'tuition not found');
  }

  ApiResponse.success(res, {
    message: 'tuition deleted successfully',
    data: null,
  });
});

export default router;
