import { Router } from 'express';
import Stripe from 'stripe';
import { getDb, paymentsCollection } from '../config/db.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

const router = Router();

// =============================================================
// Payments module
//
// GET  /api/payments          -> admin: every Stripe payment
// POST /api/payments/checkout -> student/tutor: Stripe checkout URL
// GET  /api/payments/verify   -> after redirect: record payment + plan
// =============================================================

// Price (one-time USD) per role - matches the pricing section.
const PRO_PRICE = { tutor: 15, student: 10 };

// Created lazily so a missing key never crashes server startup.
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new ApiError(
      500,
      'STRIPE_SECRET_KEY is missing. Add it to .env and restart the server.'
    );
  }
  return new Stripe(key);
}

// GET /api/payments - admin: full payment log, newest first.
// Empty until the verify endpoint starts writing to `payments`.
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

// POST /api/payments/checkout - create a Stripe Checkout session and
// hand its hosted URL to the frontend (window.location.href = url).
// TODO(Phase 0): userEmail/userRole must come from the verified JWT.
router.post('/checkout', async (req, res) => {
  const { userEmail, userRole } = req.body;

  if (!userEmail || !userRole) {
    throw new ApiError(400, 'userEmail and userRole are required');
  }

  // Only students and tutors can upgrade (admins are managed in the DB).
  if (userRole !== 'student' && userRole !== 'tutor') {
    throw new ApiError(403, 'Only students and tutors can upgrade to Pro');
  }

  const amount = PRO_PRICE[userRole];
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: userEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amount * 100, // cents
          product_data: {
            name: `MentorLagbe PRO (${userRole === 'tutor' ? 'Tutors' : 'Students'})`,
            description: 'One-time Pro plan upgrade',
          },
        },
      },
    ],
    // Read back by /verify - the only trusted source of these values.
    metadata: { userEmail, userRole },
    success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}/?payment=cancelled`,
  });

  ApiResponse.success(res, {
    message: 'checkout session created',
    data: { url: session.url },
  });
});

// GET /api/payments/verify?sessionId=... - called by the success page.
// Confirms payment WITH Stripe, then records it and flips plan -> pro.
// Idempotent: re-visiting the page never inserts a second payment.
// TODO(Phase 0): verify the JWT so only the payer can verify.
router.get('/verify', async (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== 'string') {
    throw new ApiError(400, 'sessionId query param is required');
  }

  const stripe = getStripe();

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    throw new ApiError(400, 'Invalid checkout session');
  }

  if (session.payment_status !== 'paid') {
    throw new ApiError(400, 'Payment not completed');
  }

  const userEmail =
    session.metadata?.userEmail || session.customer_details?.email || '';
  const userRole = session.metadata?.userRole || '';

  const user = userEmail
    ? await getDb().collection('user').findOne({ email: userEmail })
    : null;

  // Upsert keyed on stripeSessionId: the success page can fire twice
  // (React StrictMode), and the unique index makes this race-safe.
  try {
    await paymentsCollection.updateOne(
      { stripeSessionId: sessionId },
      {
        $setOnInsert: {
          userEmail,
          userName: user?.name || session.customer_details?.name || '',
          userRole,
          planName:
            userRole === 'tutor' ? 'Pro Tutor Plan' : 'Pro Student Plan',
          amount: (session.amount_total ?? 0) / 100,
          currency: session.currency || 'usd',
          transactionId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id || '',
          stripeSessionId: sessionId,
          paymentStatus: 'paid',
          paidAt: new Date(),
        },
      },
      { upsert: true }
    );
  } catch (error) {
    // 11000 = duplicate key: the other verify request won the race.
    if (error?.code !== 11000) throw error;
  }

  // Flip the user to Pro (idempotent - safe on every visit).
  if (userEmail) {
    await getDb()
      .collection('user')
      .updateOne({ email: userEmail }, { $set: { plan: 'pro' } });
  }

  ApiResponse.success(res, {
    message: 'payment verified successfully',
    data: { userEmail, userRole },
  });
});

export default router;
