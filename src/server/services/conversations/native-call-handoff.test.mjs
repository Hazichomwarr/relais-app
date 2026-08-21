import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('native CallAction database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [{ PrismaPg }, { PrismaClient }, { prepareNativeCallHandoff, PrepareNativeCallHandoffError }, { cancelConnection }] = await Promise.all([
    import('@prisma/adapter-pg'),
    import('@prisma/client'),
    import('./prepare-native-call-handoff.ts'),
    import('../connections/cancel-connection.ts'),
  ]);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const userIds = [];
  const connectionIds = [];
  let phoneCounter = 0;
  const phoneSeed = randomUUID().replace(/\D/g, '').padEnd(8, '7').slice(0, 8);
  const nextPhone = () => `+226${String(Number(phoneSeed) + phoneCounter++).slice(-8).padStart(8, '7')}`;

  const createCustomer = async ({ phoneNumber = nextPhone(), phoneVerifiedAt = new Date() } = {}) => {
    const user = await prisma.user.create({ data: { role: 'CUSTOMER', phoneNumber, phoneVerifiedAt, customerProfile: { create: {} } } });
    userIds.push(user.id);
    return user;
  };

  const createRelais = async ({ phoneNumber = nextPhone(), phoneVerifiedAt = new Date(), accountStatus = 'ACTIVE', eligibility = 'APPROVED', availability = 'AVAILABLE' } = {}) => {
    const user = await prisma.user.create({ data: { role: 'RELAIS', phoneNumber, phoneVerifiedAt, accountStatus, relaisProfile: { create: { eligibility, availability } } } });
    userIds.push(user.id);
    return user;
  };

  const createFixture = async ({ customer = {}, relais = {} } = {}) => {
    const customerUser = await createCustomer(customer);
    const relaisUser = await createRelais(relais);
    const connection = await prisma.connection.create({ data: { customerId: customerUser.id, requestKey: `call-test-${connectionIds.length}-${customerUser.id}` } });
    connectionIds.push(connection.id);
    const assignment = await prisma.connectionAssignment.create({ data: { connectionId: connection.id, relaisUserId: relaisUser.id } });
    const conversation = await prisma.conversation.create({ data: { connectionId: connection.id } });
    await prisma.connection.update({ where: { id: connection.id }, data: { lifecycle: 'CONNECTED', connectedAt: new Date('2026-08-21T16:00:00.000Z') } });
    return { customer: customerUser, relais: relaisUser, connection, assignment, conversation };
  };

  const customerActor = (user) => ({ userId: user.id, role: 'CUSTOMER', accountStatus: user.accountStatus });
  const relaisActor = (user, eligibility = 'APPROVED') => ({ userId: user.id, role: 'RELAIS', accountStatus: user.accountStatus, relaisEligibility: eligibility });

  const expectError = async (promise, code) => {
    await assert.rejects(promise, (error) => {
      assert.ok(error instanceof PrepareNativeCallHandoffError);
      assert.equal(error.code, code);
      return true;
    });
  };

  test('Customer and assigned Relais receive server-derived native targets', async () => {
    try {
      const fixture = await createFixture();
      const customerCall = await prepareNativeCallHandoff({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id }, prisma);
      assert.equal(customerCall.target.userId, fixture.relais.id);
      assert.equal(customerCall.target.phoneNumber, fixture.relais.phoneNumber);
      assert.equal(customerCall.target.phoneUri, `tel:${fixture.relais.phoneNumber}`);

      const relaisCall = await prepareNativeCallHandoff({ actor: relaisActor(fixture.relais), conversationId: fixture.conversation.id }, prisma);
      assert.equal(relaisCall.target.userId, fixture.customer.id);
      assert.equal(relaisCall.target.phoneNumber, fixture.customer.phoneNumber);
      assert.notEqual(customerCall.callActionId, relaisCall.callActionId);

      const stored = await prisma.callAction.findUnique({ where: { id: customerCall.callActionId } });
      assert.equal(stored?.initiatedByUserId, fixture.customer.id);
      assert.equal(stored?.targetUserId, fixture.relais.id);
      assert.equal(stored?.targetPhoneNumber, fixture.relais.phoneNumber);
      assert.equal(Object.keys(stored ?? {}).some((key) => /answer|duration|status|ended/i.test(key)), false);
    } finally {
      await cleanup();
    }
  });

  test('availability does not block an assigned participant from calling', async () => {
    try {
      const fixture = await createFixture({ relais: { availability: 'UNAVAILABLE' } });
      assert.equal((await prepareNativeCallHandoff({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id }, prisma)).target.userId, fixture.relais.id);
      assert.equal((await prepareNativeCallHandoff({ actor: relaisActor(fixture.relais), conversationId: fixture.conversation.id }, prisma)).target.userId, fixture.customer.id);
    } finally {
      await cleanup();
    }
  });

  test('wrong Customer, unrelated Relais, suspended Customer, and revoked Relais are denied', async () => {
    try {
      const fixture = await createFixture();
      const otherCustomer = await createCustomer();
      const unrelated = await createRelais();
      const suspended = await createCustomer({ phoneNumber: nextPhone(), phoneVerifiedAt: new Date(), });
      await prisma.user.update({ where: { id: suspended.id }, data: { accountStatus: 'SUSPENDED' } });
      await expectError(prepareNativeCallHandoff({ actor: customerActor(otherCustomer), conversationId: fixture.conversation.id }, prisma), 'UNAUTHORIZED');
      await expectError(prepareNativeCallHandoff({ actor: relaisActor(unrelated), conversationId: fixture.conversation.id }, prisma), 'UNAUTHORIZED');
      await expectError(prepareNativeCallHandoff({ actor: customerActor({ ...suspended, accountStatus: 'SUSPENDED' }), conversationId: fixture.conversation.id }, prisma), 'UNAUTHORIZED');
      await prisma.relaisProfile.update({ where: { userId: fixture.relais.id }, data: { eligibility: 'REVOKED' } });
      await expectError(prepareNativeCallHandoff({ actor: relaisActor(fixture.relais, 'REVOKED'), conversationId: fixture.conversation.id }, prisma), 'UNAUTHORIZED');
    } finally {
      await cleanup();
    }
  });

  test('reassignment resolves the new Relais and historical phone snapshots remain stable', async () => {
    try {
      const fixture = await createFixture({ relais: { phoneNumber: '+22670000001' } });
      const first = await prepareNativeCallHandoff({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id }, prisma);
      await prisma.user.update({ where: { id: fixture.relais.id }, data: { phoneNumber: '+22670000002' } });
      const changedPhone = await prepareNativeCallHandoff({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id }, prisma);
      assert.equal(first.target.phoneNumber, '+22670000001');
      assert.equal(changedPhone.target.phoneNumber, '+22670000002');

      const replacement = await createRelais({ phoneNumber: '+22670000003' });
      await prisma.connectionAssignment.update({ where: { id: fixture.assignment.id }, data: { endedAt: new Date() } });
      await prisma.connectionAssignment.create({ data: { connectionId: fixture.connection.id, relaisUserId: replacement.id } });
      await expectError(prepareNativeCallHandoff({ actor: relaisActor(fixture.relais), conversationId: fixture.conversation.id }, prisma), 'UNAUTHORIZED');
      const reassigned = await prepareNativeCallHandoff({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id }, prisma);
      assert.equal(reassigned.target.userId, replacement.id);
      assert.equal(reassigned.target.phoneNumber, '+22670000003');
      assert.equal((await prisma.callAction.findUnique({ where: { id: first.callActionId } }))?.targetPhoneNumber, '+22670000001');
    } finally {
      await cleanup();
    }
  });

  test('missing or malformed target phone fails without creating a CallAction', async () => {
    try {
      const missingRelais = await createFixture({ relais: { phoneNumber: null, phoneVerifiedAt: null } });
      await expectError(prepareNativeCallHandoff({ actor: customerActor(missingRelais.customer), conversationId: missingRelais.conversation.id }, prisma), 'CALL_TARGET_UNAVAILABLE');
      const malformedCustomer = await createFixture({ customer: { phoneNumber: '70000000', phoneVerifiedAt: new Date() } });
      await expectError(prepareNativeCallHandoff({ actor: relaisActor(malformedCustomer.relais), conversationId: malformedCustomer.conversation.id }, prisma), 'CALL_TARGET_UNAVAILABLE');
      assert.equal(await prisma.callAction.count({ where: { conversationId: missingRelais.conversation.id } }), 0);
      assert.equal(await prisma.callAction.count({ where: { conversationId: malformedCustomer.conversation.id } }), 0);
    } finally {
      await cleanup();
    }
  });

  test('MATCHING and ENDED Connections reject handoff, and cancellation race remains consistent', async () => {
    try {
      const matchingCustomer = await createCustomer();
      const matchingConnection = await prisma.connection.create({ data: { customerId: matchingCustomer.id, requestKey: `matching-${matchingCustomer.id}` } });
      connectionIds.push(matchingConnection.id);
      const matchingConversation = await prisma.conversation.create({ data: { connectionId: matchingConnection.id } });
      await expectError(prepareNativeCallHandoff({ actor: customerActor(matchingCustomer), conversationId: matchingConversation.id }, prisma), 'CONNECTION_NOT_CONNECTED');

      const fixture = await createFixture();
      await cancelConnection({ actor: customerActor(fixture.customer), connectionId: fixture.connection.id }, prisma);
      await expectError(prepareNativeCallHandoff({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id }, prisma), 'CONNECTION_NOT_CONNECTED');

      const race = await createFixture();
      const results = await Promise.allSettled([
        prepareNativeCallHandoff({ actor: customerActor(race.customer), conversationId: race.conversation.id }, prisma),
        cancelConnection({ actor: customerActor(race.customer), connectionId: race.connection.id }, prisma),
      ]);
      const stored = await prisma.connection.findUnique({ where: { id: race.connection.id } });
      assert.equal(stored?.lifecycle, 'ENDED');
      assert.equal(await prisma.connectionAssignment.count({ where: { connectionId: race.connection.id, endedAt: null } }), 0);
      assert.ok(results.some((result) => result.status === 'fulfilled' && result.value.status === 'ENDED'));
      assert.equal(await prisma.callAction.count({ where: { conversationId: race.conversation.id } }), results.some((result) => result.status === 'fulfilled' && 'callActionId' in result.value) ? 1 : 0);
    } finally {
      await cleanup();
    }
  });

  async function cleanup() {
    if (connectionIds.length) {
      await prisma.callAction.deleteMany({ where: { conversation: { connectionId: { in: connectionIds } } } });
      await prisma.connectionAssignment.deleteMany({ where: { connectionId: { in: connectionIds } } });
      await prisma.conversation.deleteMany({ where: { connectionId: { in: connectionIds } } });
      await prisma.connection.deleteMany({ where: { id: { in: connectionIds } } });
    }
    if (userIds.length) {
      await prisma.customerProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.relaisProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    connectionIds.length = 0;
    userIds.length = 0;
  }

  test.after(async () => {
    await cleanup();
    await prisma.$disconnect();
  });
}
