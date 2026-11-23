import { Router } from 'express';
import { ApiResponse } from '../utils/ApiResponse.js';
import { getDb } from '../config/db.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { requireRole } from '../middleware/requireRole.js';

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

// Dashboard overview numbers for the admin page.
router.get('/stats', verifyToken, requireRole('admin'), async (req, res, next) => {
  try {
    const db = getDb();

    // Better Auth stores accounts in the "user" collection (singular).
    const authUsers = db.collection('user');

    const [totalUsers, totalTutors, totalStudents, pendingTuitions, paid] =
      await Promise.all([
        authUsers.countDocuments(),
        authUsers.countDocuments({ role: 'tutor' }),
        authUsers.countDocuments({ role: 'student' }),
        db.collection('tuitions').countDocuments({ approvalStatus: 'pending' }),
        // payments collection does not exist until Phase 5 -> sums to 0.
        db
          .collection('payments')
          .aggregate([
            { $match: { paymentStatus: 'paid' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ])
          .toArray(),
      ]);

    ApiResponse.success(res, {
      message: 'admin stats retrived successfully',
      data: {
        totalUsers,
        totalTutors,
        totalStudents,
        pendingTuitions,
        totalRevenue: paid[0]?.total ?? 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', verifyToken, requireRole('admin'), (req, res) => {
  ApiResponse.success(res, { message: 'users retrived successfully' });
})


export default router;
