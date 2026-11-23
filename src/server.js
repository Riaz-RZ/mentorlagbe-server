import 'dotenv/config';
import app from './app.js';
import { connectToMongoDB } from './config/db.js';

// Validate required environment variables BEFORE starting the server.
function validateEnv() {
  const required = ['DB_URI', 'CLIENT_URL'];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Add them to your .env file (see .env.example).');
    process.exit(1);
  }
}

validateEnv();

// Stripe webhook is required for Pro upgrades - warn (not exit) so the
// rest of the API still works while the key is being set up.
if (!process.env.STRIPE_WEBHOOK_SECRET) {
  console.warn(
    'Warning: STRIPE_WEBHOOK_SECRET is missing - Stripe webhook deliveries will be rejected (Pro upgrades will not complete).'
  );
}

// Start the server only after MongoDB connects successfully.
try {
  await connectToMongoDB();

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
} catch (err) {
  console.error('Failed to start server:', err.message);
  process.exit(1);
}
