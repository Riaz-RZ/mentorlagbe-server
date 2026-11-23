import { connectToMongoDB, getDb } from '../config/db.js';

export async function ensureDatabase(req, res, next) {
  if (!getDb()) {
    await connectToMongoDB();
  }

  return next();
}
