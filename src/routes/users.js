import { Router } from 'express';
import { ApiResponse } from '../utils/ApiResponse.js';
import { getDb } from '../config/db.js';
import { ensureDatabase } from '../middleware/ensureDatabase.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

export async function getPublicUserCounts(authUsers) {
  const [students, tutors] = await Promise.all([
    authUsers.countDocuments({ role: 'student', banned: { $ne: true } }),
    authUsers.countDocuments({ role: 'tutor', banned: { $ne: true } }),
  ]);

  return { students, tutors };
}

// User-specific profile endpoints remain planned; when added, they must use
// the verified identity from req.user.

// Dashboard overview numbers for the admin page.
router.get('/stats', verifyToken, requireRole('admin'), ensureDatabase, async (req, res, next) => {
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

// Public aggregate counts only; no personal user data is returned.
router.get('/public-stats', ensureDatabase, async (_req, res, next) => {
  try {
    const counts = await getPublicUserCounts(getDb().collection('user'));

    ApiResponse.success(res, {
      message: 'public user counts retrieved successfully',
      data: counts,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', verifyToken, requireRole('admin'), ensureDatabase, (req, res) => {
  ApiResponse.success(res, { message: 'users retrived successfully' });
})


export default router;
