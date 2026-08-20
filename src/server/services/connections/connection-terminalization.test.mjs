import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('Connection terminalization database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [
    { PrismaPg },
    { PrismaClient },
    { cancelConnection, CancelConnectionError },
    { declineConnection, DeclineConnectionError },
    { endConnectionNoRelaisAvailable, EndConnectionNoRelaisAvailableError },
    { abandonConnection, AbandonConnectionError },
    { matchConnection },
  ] = await Promise.all([
    import('@prisma/adapter-pg'),
    import('@prisma/client'),
    import('./cancel-connection.ts'),
    import('./decline-connection.ts'),
    import('./end-connection-no-relais-available.ts'),
    import('./abandon-connection.ts'),
    import('./match-connection.ts'),
  ]);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const userIds = [];
  const connectionIds = [];

  const createCustomer = async ({ accountStatus = 'ACTIVE' } = {}) => {
    const user = await prisma.user.create({
      data: { role: 'CUSTOMER', accountStatus, customerProfile: { create: {} } },
    });
    userIds.push(user.id);
    return user;
  };

  const createRelais = async ({ accountStatus = 'ACTIVE', eligibility = 'APPROVED', availability = 'AVAILABLE' } = {}) => {
    const user = await prisma.user.create({
      data: {
        role: 'RELAIS',
        accountStatus,
        relaisProfile: { create: { eligibility, availability } },
      },
    });
    userIds.push(user.id);
    return user;
  };

  const createConnection = async (customerId) => {
    const connection = await prisma.connection.create({
      data: { customerId, requestKey: `terminal-test-${connectionIds.length}-${customerId}` },
    });
    connectionIds.push(connection.id);
    return connection;
  };

  const createConnectedFixture = async () => {
    const customer = await createCustomer();
    const relais = await createRelais();
    const connection = await createConnection(customer.id);
    const assignment = await prisma.connectionAssignment.create({
      data: { connectionId: connection.id, relaisUserId: relais.id },
    });
    const conversation = await prisma.conversation.create({
      data: { connectionId: connection.id },
    });
    const connectedAt = new Date('2026-08-20T20:00:00.000Z');
    await prisma.connection.update({
      where: { id: connection.id },
      data: { lifecycle: 'CONNECTED', connectedAt },
    });
    return { customer, relais, connection, assignment, conversation, connectedAt };
  };

  const expectError = async (promise, ErrorClass, code) => {
    await assert.rejects(promise, (error) => {
      assert.ok(error instanceof ErrorClass);
      assert.equal(error.code, code);
      return true;
    });
  };

  const customerActor = (user) => ({
    userId: user.id,
    role: 'CUSTOMER',
    accountStatus: user.accountStatus,
  });

  const relaisActor = (user, eligibility = 'APPROVED') => ({
    userId: user.id,
    role: 'RELAIS',
    accountStatus: user.accountStatus,
    relaisEligibility: eligibility,
  });

  test('customer cancellation ends MATCHING and is idempotent', async () => {
    try {
      const customer = await createCustomer();
      const connection = await createConnection(customer.id);
      const first = await cancelConnection({ actor: customerActor(customer), connectionId: connection.id }, prisma);
      assert.equal(first.status, 'ENDED');
      assert.equal(first.terminalOutcome, 'CUSTOMER_CANCELLED');
      assert.ok(first.endedAt instanceof Date);
      assert.equal(first.assignmentEnded, false);
      assert.equal(await prisma.connectionAssignment.count({ where: { connectionId: connection.id } }), 0);
      assert.equal(await prisma.conversation.count({ where: { connectionId: connection.id } }), 0);

      const stored = await prisma.connection.findUnique({ where: { id: connection.id } });
      assert.equal(stored?.lifecycle, 'ENDED');
      assert.equal(stored?.terminalOutcome, 'CUSTOMER_CANCELLED');
      assert.equal(stored?.endedAt?.toISOString(), first.endedAt.toISOString());

      const repeated = await cancelConnection({ actor: customerActor(customer), connectionId: connection.id }, prisma);
      assert.equal(repeated.status, 'ALREADY_ENDED');
      assert.equal(repeated.terminalOutcome, 'CUSTOMER_CANCELLED');
      assert.equal(repeated.endedAt.toISOString(), first.endedAt.toISOString());
    } finally {
      await cleanup();
    }
  });

  test('customer cancellation after matching closes assignment but preserves history', async () => {
    try {
      const fixture = await createConnectedFixture();
      const result = await cancelConnection({ actor: customerActor(fixture.customer), connectionId: fixture.connection.id }, prisma);
      assert.equal(result.status, 'ENDED');
      assert.equal(result.terminalOutcome, 'CUSTOMER_CANCELLED');
      assert.equal(result.connectedAt.toISOString(), fixture.connectedAt.toISOString());
      assert.equal(result.assignmentEnded, true);

      const assignment = await prisma.connectionAssignment.findUnique({ where: { id: fixture.assignment.id } });
      assert.equal(assignment?.connectionId, fixture.connection.id);
      assert.ok(assignment?.endedAt instanceof Date);
      assert.equal((await prisma.conversation.findUnique({ where: { id: fixture.conversation.id } }))?.connectionId, fixture.connection.id);
      const stored = await prisma.connection.findUnique({ where: { id: fixture.connection.id } });
      assert.equal(stored?.connectedAt?.toISOString(), fixture.connectedAt.toISOString());
      assert.equal(stored?.createdAt.toISOString(), fixture.connection.createdAt.toISOString());
      assert.equal(await prisma.connectionAssignment.count({ where: { connectionId: fixture.connection.id, endedAt: null } }), 0);
    } finally {
      await cleanup();
    }
  });

  test('customer ownership and active authorization are enforced', async () => {
    try {
      const owner = await createCustomer();
      const otherCustomer = await createCustomer();
      const suspended = await createCustomer({ accountStatus: 'SUSPENDED' });
      const connection = await createConnection(owner.id);

      await expectError(cancelConnection({ actor: customerActor(otherCustomer), connectionId: connection.id }, prisma), CancelConnectionError, 'NOT_CONNECTION_OWNER');
      await expectError(cancelConnection({ actor: customerActor(suspended), connectionId: connection.id }, prisma), CancelConnectionError, 'UNAUTHORIZED');
      assert.equal((await prisma.connection.findUnique({ where: { id: connection.id } }))?.lifecycle, 'MATCHING');
    } finally {
      await cleanup();
    }
  });

  test('assigned Relais may decline, while unrelated Relais may not', async () => {
    try {
      const fixture = await createConnectedFixture();
      const unrelated = await createRelais();
      await expectError(declineConnection({ actor: relaisActor(unrelated), connectionId: fixture.connection.id }, prisma), DeclineConnectionError, 'NOT_ASSIGNED_RELAIS');

      const result = await declineConnection({ actor: relaisActor(fixture.relais), connectionId: fixture.connection.id }, prisma);
      assert.equal(result.status, 'ENDED');
      assert.equal(result.terminalOutcome, 'DECLINED_BY_RELAIS');
      assert.equal(result.assignmentEnded, true);
      assert.ok((await prisma.connectionAssignment.findUnique({ where: { id: fixture.assignment.id } }))?.endedAt instanceof Date);
      assert.equal((await prisma.conversation.findUnique({ where: { id: fixture.conversation.id } }))?.connectionId, fixture.connection.id);
      assert.equal(await prisma.connectionAssignment.count({ where: { connectionId: fixture.connection.id, endedAt: null } }), 0);
    } finally {
      await cleanup();
    }
  });

  test('internal terminal outcomes distinguish no availability and abandonment', async () => {
    try {
      const customer = await createCustomer();
      const noAvailability = await createConnection(customer.id);
      const endedNoAvailability = await endConnectionNoRelaisAvailable({ connectionId: noAvailability.id }, prisma);
      assert.equal(endedNoAvailability.terminalOutcome, 'NO_RELAIS_AVAILABLE');
      assert.ok(endedNoAvailability.endedAt instanceof Date);

      const abandonedMatching = await createConnection(customer.id);
      const endedMatching = await abandonConnection({ connectionId: abandonedMatching.id }, prisma);
      assert.equal(endedMatching.terminalOutcome, 'ABANDONED');

      const connected = await createConnectedFixture();
      const abandonedConnected = await abandonConnection({ connectionId: connected.connection.id }, prisma);
      assert.equal(abandonedConnected.terminalOutcome, 'ABANDONED');
      assert.equal(abandonedConnected.assignmentEnded, true);
      assert.equal(abandonedConnected.connectedAt.toISOString(), connected.connectedAt.toISOString());
      assert.equal((await prisma.conversation.findUnique({ where: { id: connected.conversation.id } }))?.connectionId, connected.connection.id);
      assert.equal(await prisma.connectionAssignment.count({ where: { connectionId: connected.connection.id, endedAt: null } }), 0);

      const repeated = await abandonConnection({ connectionId: abandonedMatching.id }, prisma);
      assert.equal(repeated.status, 'ALREADY_ENDED');
      assert.equal(repeated.terminalOutcome, 'ABANDONED');
    } finally {
      await cleanup();
    }
  });

  test('no availability cannot terminate a connected Connection and terminal outcomes stay immutable', async () => {
    try {
      const fixture = await createConnectedFixture();
      await expectError(endConnectionNoRelaisAvailable({ connectionId: fixture.connection.id }, prisma), EndConnectionNoRelaisAvailableError, 'ACTIVE_ASSIGNMENT_CONFLICT');

      const customerResult = await cancelConnection({ actor: customerActor(fixture.customer), connectionId: fixture.connection.id }, prisma);
      assert.equal(customerResult.terminalOutcome, 'CUSTOMER_CANCELLED');
      const after = await abandonConnection({ connectionId: fixture.connection.id }, prisma);
      assert.equal(after.status, 'ALREADY_ENDED');
      assert.equal(after.terminalOutcome, 'CUSTOMER_CANCELLED');
      assert.equal((await prisma.connection.findUnique({ where: { id: fixture.connection.id } }))?.terminalOutcome, 'CUSTOMER_CANCELLED');
      assert.equal(await prisma.connectionAssignment.count({ where: { connectionId: fixture.connection.id, endedAt: null } }), 0);
    } finally {
      await cleanup();
    }
  });

  test('cancellation and matching race leaves one truthful terminal state', async () => {
    try {
      const customer = await createCustomer();
      const relais = await createRelais();
      const connection = await createConnection(customer.id);
      const results = await Promise.allSettled([
        cancelConnection({ actor: customerActor(customer), connectionId: connection.id }, prisma),
        matchConnection({ connectionId: connection.id }, prisma),
      ]);

      const cancellation = results.find((result) => result.status === 'fulfilled' && result.value.terminalOutcome === 'CUSTOMER_CANCELLED');
      assert.ok(cancellation);
      const stored = await prisma.connection.findUnique({ where: { id: connection.id } });
      assert.equal(stored?.lifecycle, 'ENDED');
      assert.equal(stored?.terminalOutcome, 'CUSTOMER_CANCELLED');
      assert.ok(stored?.endedAt instanceof Date);
      assert.equal(await prisma.connectionAssignment.count({ where: { connectionId: connection.id, endedAt: null } }), 0);
      const assignments = await prisma.connectionAssignment.findMany({ where: { connectionId: connection.id } });
      assert.ok(assignments.length <= 1);
      if (assignments[0]) {
        assert.equal(assignments[0].relaisUserId, relais.id);
        assert.ok(assignments[0].endedAt instanceof Date);
        assert.equal(await prisma.conversation.count({ where: { connectionId: connection.id } }), 1);
      } else {
        assert.equal(await prisma.conversation.count({ where: { connectionId: connection.id } }), 0);
      }
    } finally {
      await cleanup();
    }
  });

  async function cleanup() {
    if (connectionIds.length) {
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
