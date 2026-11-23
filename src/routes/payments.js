import { Router } from 'express';
import Stripe from 'stripe';
import {
  connectToMongoDB,
  getDb,
  paymentsCollection,
} from '../config/db.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';
import { ensureDatabase } from '../middleware/ensureDatabase.js';
import { verifyToken } from '../middleware/verifyToken.js';
import { requireRole } from '../middleware/requireRole.js';

const router = Router();

// =============================================================
// Payments module
//
// GET  /api/payments          -> admin: every Stripe payment
// POST /api/payments/checkout -> student/tutor: Stripe checkout URL
// POST /api/payments/webhook  -> Stripe: record payment + flip plan
//                                 (raw body, signature-verified)
// GET  /api/payments/status   -> success page: is it recorded yet?
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
// Empty until the webhook starts writing to `payments`.
router.get('/', verifyToken, requireRole('admin'), ensureDatabase, async (req, res) => {
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
router.post('/checkout', verifyToken, requireRole('student', 'tutor'), async (req, res) => {
  const { email: userEmail, role: userRole } = req.user;

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
    // Read back by the webhook - the only trusted source of these values.
    metadata: { userEmail, userRole },
    success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}/?payment=cancelled`,
  });

  ApiResponse.success(res, {
    message: 'checkout session created',
    data: { url: session.url },
  });
});

// -------------------------------------------------------------
// Stripe webhook - THE source of truth for completed payments.
//
// Mounted in app.js with express.raw() BEFORE express.json(),
// because signature verification needs the raw request body.
// Stripe retries on non-2xx, so failures here are safe to retry.
// -------------------------------------------------------------
export async function stripeWebhook(req, res) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new ApiError(
      500,
      'STRIPE_WEBHOOK_SECRET is missing. Add it to .env and restart the server.'
    );
  }

  const stripe = getStripe();

  // Verifies the stripe-signature header against the raw body.
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body, // Buffer, set by express.raw()
      req.headers['stripe-signature'],
      secret
    );
  } catch {
    throw new ApiError(400, 'Invalid webhook signature');
  }

  // Only fully-paid completed checkouts are recorded; every other event
  // type is acknowledged with 200 and ignored (Stripe stops retrying it).
  const session =
    event.type === 'checkout.session.completed' ? event.data.object : null;

  if (session && session.payment_status === 'paid') {
    if (!getDb()) {
      await connectToMongoDB();
    }

    await recordPayment(session);
  }

  res.status(200).json({ received: true });
}

// Writes one payment row and flips the payer's plan to "pro".
// Idempotent: the unique index on stripeSessionId makes Stripe's
// retries (and any double delivery) no-ops after the first write.
async function recordPayment(session) {
  const sessionId = session.id;
  const userEmail =
    session.metadata?.userEmail || session.customer_details?.email || '';
  const userRole = session.metadata?.userRole || '';

  const user = userEmail
    ? await getDb().collection('user').findOne({ email: userEmail })
    : null;

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
    // 11000 = duplicate key: a previous delivery already recorded it.
    if (error?.code !== 11000) throw error;
  }

  // Flip the user to Pro (idempotent - safe on every delivery).
  if (userEmail) {
    await getDb()
      .collection('user')
      .updateOne({ email: userEmail }, { $set: { plan: 'pro' } });
  }
}

// GET /api/payments/status?sessionId=... - READ-ONLY check of the
// `payments` collection (the webhook above writes it). The success page
// polls this until the webhook lands. No Stripe call, no writes here,
// so it can never create or change anything. This deliberately returns
// only a boolean and remains public for the checkout return page.
router.get('/status', ensureDatabase, async (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== 'string') {
    throw new ApiError(400, 'sessionId query param is required');
  }

  const payment = await paymentsCollection.findOne({
    stripeSessionId: sessionId,
  });

  ApiResponse.success(res, {
    message: payment ? 'payment recorded' : 'payment still processing',
    data: { recorded: Boolean(payment) },
  });
});

export default router;
