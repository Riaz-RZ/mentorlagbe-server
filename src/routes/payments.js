import { Router } from 'express';
import { paymentsCollection } from '../config/db.js';
import { ApiResponse } from '../utils/ApiResponse.js';

const router = Router();

// =============================================================
// Payments module
//
// GET /api/payments -> admin: every Stripe payment (Transaction History)
// POST /api/payments/checkout + webhook arrive in Phase 5 (Stripe).
// =============================================================

// GET /api/payments - admin: full payment log, newest first.
// Empty until the Stripe webhook starts writing to `payments`.
// TODO(Phase 0): admin check via requireRole once verifyToken exists.
router.get('/', async (req, res) => {
  const payments = await paymentsCollection
    .find()
    .sort({ paidAt: -1 })
    .toArray();

  ApiResponse.success(res, {
    message: 'payments fetched successfully',
    data: payments,
  });
});

export default router;
