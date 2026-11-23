import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { savedTuitionsCollection, tuitionsCollection } from '../config/db.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { getPlan } from '../utils/plan.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

// =============================================================
// Saved Tuitions module (student bookmarks)
//
// GET    /api/saved  -> student: full tuition docs I bookmarked
// POST   /api/saved  -> student: save a tuition
// DELETE /api/saved  -> student: remove a saved tuition
// =============================================================

// GET /api/saved - full tuition docs I bookmarked.
// Only approved + active tuitions come back (same rule as the public
// marketplace, so a closed/rejected post disappears from the list).
router.get('/', verifyToken, requireRole('student'), async (req, res) => {
  const savedDocs = await savedTuitionsCollection
    .find({ studentEmail: req.user.email })
    .sort({ savedAt: -1 })
    .toArray();

  // tuitionId is stored as a string - convert for the ObjectId query.
  const ids = savedDocs
    .map((doc) => {
      try {
        return new ObjectId(doc.tuitionId);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  if (ids.length === 0) {
    ApiResponse.success(res, {
      message: 'saved tuitions fetched successfully',
      data: [],
    });
    return;
  }

  const tuitions = await tuitionsCollection
    .find({ _id: { $in: ids }, approvalStatus: 'approved', isActive: true })
    .toArray();

  // Keep the newest-saved order from the saved collection.
  const byId = new Map(tuitions.map((t) => [String(t._id), t]));
  const ordered = savedDocs.map((d) => byId.get(d.tuitionId)).filter(Boolean);

  ApiResponse.success(res, {
    message: 'saved tuitions fetched successfully',
    data: ordered,
  });
});

// POST /api/saved - bookmark a tuition (one per student).
router.post('/', verifyToken, requireRole('student'), async (req, res) => {
  const { tuitionId } = req.body;
  const { email: studentEmail } = req.user;

  if (typeof tuitionId !== 'string' || !ObjectId.isValid(tuitionId)) {
    throw new ApiError(400, 'A valid tuitionId is required');
  }

  const tuition = await tuitionsCollection.findOne({
    _id: new ObjectId(tuitionId),
    approvalStatus: 'approved',
    isActive: true,
  });

  if (!tuition) {
    throw new ApiError(404, 'tuition not found');
  }

  const existing = await savedTuitionsCollection.findOne({
    tuitionId,
    studentEmail,
  });

  if (existing) {
    throw new ApiError(400, 'Tuition already saved');
  }

  // Plan limit: free students can save up to 5 tuitions (pro = unlimited).
  if ((await getPlan(studentEmail)) !== 'pro') {
    const count = await savedTuitionsCollection.countDocuments({
      studentEmail,
    });

    if (count >= 5) {
      throw new ApiError(
        403,
        'Free plan allows up to 5 bookmarks. Upgrade to Pro for unlimited bookmarks!'
      );
    }
  }

  await savedTuitionsCollection.insertOne({
    tuitionId,
    studentEmail,
    savedAt: new Date(),
  });

  ApiResponse.success(res, {
    statusCode: 201,
    message: 'tuition saved successfully',
    data: { tuitionId },
  });
});

// DELETE /api/saved?tuitionId=... - unsave.
router.delete('/', verifyToken, requireRole('student'), async (req, res) => {
  const { tuitionId } = req.query;
  const { email: studentEmail } = req.user;

  if (!tuitionId || typeof tuitionId !== 'string') {
    throw new ApiError(400, 'tuitionId is required');
  }

  await savedTuitionsCollection.deleteOne({ tuitionId, studentEmail });

  ApiResponse.success(res, {
    message: 'tuition removed from saved',
    data: null,
  });
});

export default router;
