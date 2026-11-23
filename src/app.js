import express from 'express';
import cors from 'cors';

import healthRoutes from './routes/healthRoutes.js';
import userRoutes from './routes/users.js';
import tuitionRoutes from './routes/tuitions.js';
import applicationRoutes from './routes/applications.js';
import savedRoutes from './routes/saved.js';
import paymentRoutes, { stripeWebhook } from './routes/payments.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// CORS - only allow the frontend URL (CLIENT_URL from .env)
app.use(
  cors({
    origin: process.env.CLIENT_URL
  })
);

// Stripe webhook - MUST be registered before express.json() because
// signature verification needs the RAW request body (Buffer).
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhook
);

// Parse JSON request bodies
app.use(express.json());

// Basic API routes
app.use('/', healthRoutes);
app.use('/api/health', healthRoutes);

// Route modules (mounted now, endpoints added in later phases)
app.use('/api/users', userRoutes);
app.use('/api/tuitions', tuitionRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/saved', savedRoutes);
app.use('/api/payments', paymentRoutes);

// Unknown route -> 404
app.use(notFound);

// Global error handling -> always last
app.use(errorHandler);

export default app;
