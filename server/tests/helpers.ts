import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import prisma from '../src/prisma/client';

export const TEST_ORG_ID = 'org_test_' + uuidv4().slice(0, 8);
export const TEST_USER_ID = 'user_test_' + uuidv4().slice(0, 8);
export const TEST_EMAIL = `test_${uuidv4().slice(0, 6)}@tracix-test.io`;
export const TEST_PASSWORD = 'Test1234!@#';

/** Create a fresh org + admin user for one test suite. Returns { orgId, userId, email }. */
export async function createTestUser(overrides?: { role?: string }) {
  const orgId = 'org_test_' + uuidv4().slice(0, 8);
  const userId = 'user_test_' + uuidv4().slice(0, 8);
  const email = `test_${uuidv4().slice(0, 6)}@tracix-test.io`;

  await prisma.organization.create({
    data: { id: orgId, name: 'Test Org' },
  });

  await prisma.userApp.create({
    data: {
      id: userId,
      organization_id: orgId,
      full_name: 'Test User',
      email,
      password_hash: await bcrypt.hash(TEST_PASSWORD, 4), // low rounds for speed
      role: overrides?.role ?? 'admin',
    },
  });

  return { orgId, userId, email };
}

/** Delete org (cascades to everything). */
export async function cleanupOrg(orgId: string) {
  await prisma.organization.deleteMany({ where: { id: orgId } });
}

/** Delete user and their org. */
export async function cleanupUser(userId: string) {
  const user = await prisma.userApp.findUnique({ where: { id: userId } });
  if (user) await cleanupOrg(user.organization_id);
}
