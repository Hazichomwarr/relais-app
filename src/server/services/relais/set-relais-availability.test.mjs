import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('setRelaisAvailability database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [{ PrismaPg }, { PrismaClient }, { RelaisAvailabilityError, setRelaisAvailability }] =
    await Promise.all([
      import('@prisma/adapter-pg'),
      import('@prisma/client'),
      import('./set-relais-availability.ts'),
    ]);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const userIds = [];
  const relaisProfileUserIds = [];
  const customerProfileUserIds = [];
  const connectionIds = [];
  const assignmentIds = [];

  const makeActor = (userId, accountStatus = 'ACTIVE', relaisEligibility = 'APPROVED') => ({
    userId,
    role: 'RELAIS',
    accountStatus,
    relaisEligibility,
  });

  const expectError = async (promise, code) => {
    await assert.rejects(promise, (error) => {
      assert.ok(error instanceof RelaisAvailabilityError);
      assert.equal(error.code, code);
      return true;
    });
  };

  const createRelais = async ({ accountStatus = 'ACTIVE', eligibility = 'APPROVED' } = {}) => {
    const user = await prisma.user.create({
      data: {
        role: 'RELAIS',
        accountStatus,
        relaisProfile: { create: { eligibility } },
      },
      include: { relaisProfile: true },
    });
    userIds.push(user.id);
    relaisProfileUserIds.push(user.id);
    return user;
  };

  test('enforces Relais identity, persists transitions, and preserves domain history', async () => {
    try {
      const approved = await createRelais();
      assert.equal(approved.relaisProfile.availability, 'UNAVAILABLE');
      assert.ok(approved.relaisProfile.availabilityChangedAt instanceof Date);

      const initialConnectionCount = await prisma.connection.count();
      const initialAssignmentCount = await prisma.connectionAssignment.count();
      const initialConversationCount = await prisma.conversation.count();

      const available = await setRelaisAvailability({
        actor: makeActor(approved.id),
        availability: 'AVAILABLE',
      }, prisma);
      assert.equal(available.relaisId, approved.relaisProfile.id);
      assert.equal(available.availability, 'AVAILABLE');
      assert.ok(available.availabilityChangedAt.getTime() >= approved.relaisProfile.availabilityChangedAt.getTime());

      const sameState = await setRelaisAvailability({
        actor: makeActor(approved.id),
        availability: 'AVAILABLE',
      }, prisma);
      assert.equal(sameState.availabilityChangedAt.toISOString(), available.availabilityChangedAt.toISOString());

      const customer = await prisma.user.create({
        data: { role: 'CUSTOMER', customerProfile: { create: {} } },
      });
      userIds.push(customer.id);
      customerProfileUserIds.push(customer.id);
      const connection = await prisma.connection.create({
        data: {
          customerId: customer.id,
          requestKey: `availability-test-${approved.id}`,
        },
      });
      connectionIds.push(connection.id);
      const assignment = await prisma.connectionAssignment.create({
        data: { connectionId: connection.id, relaisUserId: approved.id },
      });
      assignmentIds.push(assignment.id);

      const unavailable = await setRelaisAvailability({
        actor: makeActor(approved.id),
        availability: 'UNAVAILABLE',
      }, prisma);
      assert.equal(unavailable.availability, 'UNAVAILABLE');
      const survivingAssignment = await prisma.connectionAssignment.findUnique({ where: { id: assignment.id } });
      assert.equal(survivingAssignment?.connectionId, connection.id);
      assert.equal(survivingAssignment?.endedAt, null);

      assert.equal(await prisma.connection.count(), initialConnectionCount + 1);
      assert.equal(await prisma.connectionAssignment.count(), initialAssignmentCount + 1);
      assert.equal(await prisma.conversation.count(), initialConversationCount);

      const suspended = await createRelais({ accountStatus: 'SUSPENDED' });
      const deactivated = await createRelais({ accountStatus: 'DEACTIVATED' });
      const underReview = await createRelais({ eligibility: 'UNDER_REVIEW' });
      const revoked = await createRelais({ eligibility: 'REVOKED' });
      const admin = await prisma.user.create({ data: { role: 'ADMIN' } });
      userIds.push(admin.id);
      const customerActor = { userId: customer.id, role: 'CUSTOMER', accountStatus: 'ACTIVE' };

      await expectError(setRelaisAvailability({ actor: makeActor(suspended.id, 'SUSPENDED'), availability: 'AVAILABLE' }, prisma), 'ACCOUNT_NOT_ACTIVE');
      await expectError(setRelaisAvailability({ actor: makeActor(deactivated.id, 'DEACTIVATED'), availability: 'AVAILABLE' }, prisma), 'ACCOUNT_NOT_ACTIVE');
      await expectError(setRelaisAvailability({ actor: makeActor(underReview.id, 'ACTIVE', 'UNDER_REVIEW'), availability: 'AVAILABLE' }, prisma), 'RELAIS_NOT_APPROVED');
      await expectError(setRelaisAvailability({ actor: makeActor(revoked.id, 'ACTIVE', 'REVOKED'), availability: 'AVAILABLE' }, prisma), 'RELAIS_NOT_APPROVED');
      await expectError(setRelaisAvailability({ actor: customerActor, availability: 'AVAILABLE' }, prisma), 'WRONG_ROLE');
      await expectError(setRelaisAvailability({ actor: { userId: admin.id, role: 'ADMIN', accountStatus: 'ACTIVE' }, availability: 'AVAILABLE' }, prisma), 'WRONG_ROLE');
      await expectError(setRelaisAvailability({ actor: makeActor(approved.id), availability: 'BUSY' }, prisma), 'INVALID_AVAILABILITY');

      const missingProfile = await prisma.user.create({ data: { role: 'RELAIS' } });
      userIds.push(missingProfile.id);
      await expectError(setRelaisAvailability({ actor: makeActor(missingProfile.id), availability: 'AVAILABLE' }, prisma), 'RELAIS_PROFILE_MISSING');
    } finally {
      if (assignmentIds.length) {
        await prisma.connectionAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
      }
      if (connectionIds.length) {
        await prisma.conversation.deleteMany({ where: { connectionId: { in: connectionIds } } });
        await prisma.connection.deleteMany({ where: { id: { in: connectionIds } } });
      }
      if (customerProfileUserIds.length) {
        await prisma.customerProfile.deleteMany({ where: { userId: { in: customerProfileUserIds } } });
      }
      if (relaisProfileUserIds.length) {
        await prisma.relaisProfile.deleteMany({ where: { userId: { in: relaisProfileUserIds } } });
      }
      if (userIds.length) {
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      }
    }
  });

  test.after(async () => {
    await prisma.$disconnect();
  });
}
