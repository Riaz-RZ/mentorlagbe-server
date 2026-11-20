import { MongoClient } from 'mongodb';

// Reusable MongoDB connection configuration.
// The connection string always comes from the .env file (DB_URI).

let db = null;

// Collection references - assigned in connectToMongoDB() after the
// connection succeeds (they are null until then).
export let usersCollection = null;
export let tuitionsCollection = null;
export let applicationsCollection = null;

export async function connectToMongoDB() {
  const uri = process.env.DB_URI;

  if (!uri) {
    throw new Error('DB_URI is missing. Add it to your .env file.');
  }

  const client = new MongoClient(uri);
  await client.connect();

  console.log('You successfully connected to MongoDB!');

  db = client.db('mentorlagbe');

  usersCollection = db.collection('users');
  tuitionsCollection = db.collection('tuitions');
  applicationsCollection = db.collection('applications');

  return db;
}

// Simple accessor for the connected database.
// Route files can call getDb() to read/write collections.
export function getDb() {
  return db;
}
