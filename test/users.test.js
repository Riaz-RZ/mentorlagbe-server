import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getPublicUserCounts } from '../src/routes/users.js';

test('public user counts include only non-banned students and tutors', async () => {
  const filters = [];
  const users = {
    countDocuments: async (filter) => {
      filters.push(filter);
      return filter.role === 'student' ? 12 : 5;
    },
  };

  const counts = await getPublicUserCounts(users);

  assert.deepEqual(counts, { students: 12, tutors: 5 });
  assert.deepEqual(filters, [
    { role: 'student', banned: { $ne: true } },
    { role: 'tutor', banned: { $ne: true } },
  ]);
});
