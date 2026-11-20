import { Router } from 'express';
import { ApiResponse } from '../utils/ApiResponse.js';

const router = Router();

// GET /api/health
// Simple health check - confirms the API is running.
// Never expose database credentials or other secrets here.
router.get('/', (req, res) => {
  ApiResponse.success(res, {
    message: 'MentorLagbe API is running',
    data: { status: 'OK' },
  });
});

export default router;
