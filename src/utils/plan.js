import { getDb } from '../config/db.js';

// The user's plan: "free" unless the Better Auth user doc says "pro".
// Used by the plan-limit checks (bookmarks / posts / applications).
export async function getPlan(email) {
  const user = await getDb()
    .collection('user')
    .findOne({ email }, { projection: { plan: 1 } });

  return user?.plan === 'pro' ? 'pro' : 'free';
}
