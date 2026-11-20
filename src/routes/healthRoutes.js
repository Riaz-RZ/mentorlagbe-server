import { Router } from 'express';

const router = Router();

// GET /api/health
// Simple health check - confirms the API is running.
// Never expose database credentials or other secrets here.
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'MentorLagbe API is running',
    data: {
      status: 'OK',
    },
  });
});

export default router;
