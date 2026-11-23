import { MongoClient } from 'mongodb';

// Reusable MongoDB connection configuration.
// The connection string always comes from the .env file (DB_URI).

let db = null;
let connectionPromise = null;

// Collection references - assigned in connectToMongoDB() after the
// connection succeeds (they are null until then).
export let usersCollection = null;
export let tuitionsCollection = null;
export let applicationsCollection = null;
export let savedTuitionsCollection = null;
export let paymentsCollection = null;

export async function connectToMongoDB() {
  if (db) return db;
  if (connectionPromise) return connectionPromise;

  const uri = process.env.DB_URI;

  if (!uri) {
    throw new Error('DB_URI is missing. Add it to your .env file.');
  }

  const client = new MongoClient(uri);
  connectionPromise = (async () => {
    await client.connect();

    console.log('You successfully connected to MongoDB!');

    db = client.db('mentorlagbe');

    usersCollection = db.collection('users');
    tuitionsCollection = db.collection('tuitions');
    applicationsCollection = db.collection('applications');
    savedTuitionsCollection = db.collection('savedTuitions');
    paymentsCollection = db.collection('payments');

    // One payment row per Stripe session: Stripe can deliver the same
    // webhook more than once (retries are at-least-once), and the unique
    // index makes the insert race-safe.
    await paymentsCollection
      .createIndex({ stripeSessionId: 1 }, { unique: true })
      .catch((err) => console.log('payments index not created:', err.message));

    return db;
  })();

  try {
    return await connectionPromise;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
}

// Simple accessor for the connected database.
// Route files can call getDb() to read/write collections.
export function getDb() {
  return db;
}
