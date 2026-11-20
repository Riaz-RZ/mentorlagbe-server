import { MongoClient } from 'mongodb';

// Reusable MongoDB connection configuration.
// The connection string always comes from the .env file (DB_URI).

let db = null;

export async function connectToMongoDB() {
  const uri = process.env.DB_URI;

  if (!uri) {
    throw new Error('DB_URI is missing. Add it to your .env file.');
  }

  const client = new MongoClient(uri);
  await client.connect();

  console.log('You successfully connected to MongoDB!');

  db = client.db('mentorlagbe');
  return db;
}

// Simple accessor for the connected database.
// Route files can call getDb() to read/write collections.
export function getDb() {
  return db;
}
