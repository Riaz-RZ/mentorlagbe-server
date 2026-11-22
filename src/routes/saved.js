import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { savedTuitionsCollection, tuitionsCollection } from '../config/db.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { getPlan } from '../utils/plan.js';

const router = Router();

// =============================================================
// Saved Tuitions module (student bookmarks)
//
// GET    /api/saved  -> student: full tuition docs I bookmarked
// POST   /api/saved  -> student: save a tuition
// DELETE /api/saved  -> student: remove a saved tuition
// =============================================================

// GET /api/saved?studentEmail=... - full tuition docs I bookmarked.
// Only approved + active tuitions come back (same rule as the public
// marketplace, so a closed/rejected post disappears from the list).
// TODO(Phase 0): studentEmail must come from the verified JWT.
router.get('/', async (req, res) => {
  const { studentEmail } = req.query;

  if (!studentEmail) {
    throw new ApiError(400, 'studentEmail query param is required');
  }

  const savedDocs = await savedTuitionsCollection
    .find({ studentEmail })
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
router.post('/', async (req, res) => {
  const { tuitionId, studentEmail } = req.body;

  if (!tuitionId || !studentEmail) {
    throw new ApiError(400, 'tuitionId and studentEmail are required');
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

// DELETE /api/saved?tuitionId=...&studentEmail=... - unsave.
router.delete('/', async (req, res) => {
  const { tuitionId, studentEmail } = req.query;

  if (!tuitionId || !studentEmail) {
    throw new ApiError(400, 'tuitionId and studentEmail are required');
  }

  await savedTuitionsCollection.deleteOne({ tuitionId, studentEmail });

  ApiResponse.success(res, {
    message: 'tuition removed from saved',
    data: null,
  });
});

export default router;
