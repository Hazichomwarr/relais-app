import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('matchConnection database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [{ PrismaPg }, { PrismaClient }, { matchConnection, MatchConnectionError }] =
    await Promise.all([
      import('@prisma/adapter-pg'),
      import('@prisma/client'),
      import('./match-connection.ts'),
    ]);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const userIds = [];
  const connectionIds = [];

  const createRelais = async ({
    accountStatus = 'ACTIVE',
    eligibility = 'APPROVED',
    availability = 'AVAILABLE',
    languages = [],
  } = {}) => {
    const user = await prisma.user.create({
      data: {
        role: 'RELAIS',
        accountStatus,
        relaisProfile: {
          create: {
            eligibility,
            availability,
            supportedLanguages: {
              create: languages.map((languageCode) => ({ languageCode })),
            },
          },
        },
      },
      include: { relaisProfile: true },
    });
    userIds.push(user.id);
    return user;
  };

  const createCustomerConnection = async (preferredLanguage = null) => {
    const customer = await prisma.user.create({
      data: { role: 'CUSTOMER', customerProfile: { create: {} } },
    });
    userIds.push(customer.id);
    const connection = await prisma.connection.create({
      data: {
        customerId: customer.id,
        preferredLanguage,
        requestKey: `match-test-${connectionIds.length}-${customer.id}`,
      },
    });
    connectionIds.push(connection.id);
    return connection;
  };

  const expectError = async (promise, code) => {
    await assert.rejects(promise, (error) => {
      assert.ok(error instanceof MatchConnectionError);
      assert.equal(error.code, code);
      return true;
    });
  };

  test('matches only eligible Relais and preserves truthful assignment state', async () => {
    try {
      const moore = await createRelais({ languages: ['moore'] });
      const french = await createRelais({ languages: ['French'] });
      const unavailable = await createRelais({ availability: 'UNAVAILABLE', languages: ['moore'] });
      await createRelais({ eligibility: 'UNDER_REVIEW', languages: ['moore'] });
      await createRelais({ eligibility: 'REVOKED', languages: ['moore'] });
      await createRelais({ accountStatus: 'SUSPENDED', languages: ['moore'] });
      const wrongRole = await prisma.user.create({
        data: {
          role: 'CUSTOMER',
          relaisProfile: {
            create: {
              eligibility: 'APPROVED',
              availability: 'AVAILABLE',
              supportedLanguages: { create: { languageCode: 'moore' } },
            },
          },
        },
      });
      userIds.push(wrongRole.id);

      const languageConnection = await createCustomerConnection('Mooré');
      const languageMatch = await matchConnection({ connectionId: languageConnection.id }, prisma);
      assert.equal(languageMatch.status, 'MATCHED');
      assert.equal(languageMatch.relaisUserId, moore.id);
      assert.equal(await prisma.connectionAssignment.count({ where: { connectionId: languageConnection.id } }), 1);
      assert.equal(await prisma.conversation.count({ where: { connectionId: languageConnection.id } }), 1);
      const storedLanguageConnection = await prisma.connection.findUnique({ where: { id: languageConnection.id } });
      assert.equal(storedLanguageConnection?.lifecycle, 'CONNECTED');
      assert.ok(storedLanguageConnection?.connectedAt instanceof Date);
      const assignment = await prisma.connectionAssignment.findFirst({ where: { connectionId: languageConnection.id } });
      assert.equal(assignment?.assignedByUserId, null);
      assert.equal(assignment?.endedAt, null);

      const repeated = await matchConnection({ connectionId: languageConnection.id }, prisma);
      assert.equal(repeated.status, 'ALREADY_MATCHED');
      assert.equal(repeated.assignmentId, languageMatch.assignmentId);
      assert.equal(repeated.conversationId, languageMatch.conversationId);
      assert.equal(await prisma.connectionAssignment.count({ where: { connectionId: languageConnection.id } }), 1);
      assert.equal(await prisma.conversation.count({ where: { connectionId: languageConnection.id } }), 1);

      await prisma.relaisProfile.update({
        where: { userId: moore.id },
        data: { availability: 'UNAVAILABLE' },
      });
      const afterUnavailable = await matchConnection({ connectionId: languageConnection.id }, prisma);
      assert.equal(afterUnavailable.status, 'ALREADY_MATCHED');
      assert.equal(afterUnavailable.relaisUserId, moore.id);

      const noLanguageConnection = await createCustomerConnection(null);
      const noLanguageMatch = await matchConnection({ connectionId: noLanguageConnection.id }, prisma);
      assert.equal(noLanguageMatch.status, 'MATCHED');
      assert.equal(noLanguageMatch.relaisUserId, french.id);

      const noEligibleConnection = await createCustomerConnection('Dioula');
      const beforeNoEligibleAssignments = await prisma.connectionAssignment.count({ where: { connectionId: noEligibleConnection.id } });
      const noEligible = await matchConnection({ connectionId: noEligibleConnection.id }, prisma);
      assert.deepEqual(noEligible, { status: 'NO_RELAIS_AVAILABLE', connectionId: noEligibleConnection.id });
      assert.equal(beforeNoEligibleAssignments, 0);
      assert.equal(await prisma.connectionAssignment.count({ where: { connectionId: noEligibleConnection.id } }), 0);
      assert.equal(await prisma.conversation.count({ where: { connectionId: noEligibleConnection.id } }), 0);
      assert.equal((await prisma.connection.findUnique({ where: { id: noEligibleConnection.id } }))?.lifecycle, 'MATCHING');
      assert.equal(await prisma.relaisProfile.findUnique({ where: { userId: unavailable.id } }).then((profile) => profile?.availability), 'UNAVAILABLE');
    } finally {
      await cleanup();
    }
  });

  test('enforces capacity and distributes distinct Connections by current load', async () => {
    try {
      const first = await createRelais({ languages: ['capacity'] });
      const second = await createRelais({ languages: ['capacity'] });
      const firstConnection = await createCustomerConnection('capacity');
      const firstMatch = await matchConnection({ connectionId: firstConnection.id }, prisma);
      assert.equal(firstMatch.status, 'MATCHED');

      const secondConnection = await createCustomerConnection('capacity');
      const secondMatch = await matchConnection({ connectionId: secondConnection.id }, prisma);
      assert.equal(secondMatch.status, 'MATCHED');
      assert.notEqual(secondMatch.relaisUserId, firstMatch.relaisUserId);
      assert.ok([first.id, second.id].includes(firstMatch.relaisUserId));
      assert.ok([first.id, second.id].includes(secondMatch.relaisUserId));

      const capacityOnly = await createRelais({ languages: ['capacity-only'] });
      for (let index = 0; index < 3; index += 1) {
        const connection = await createCustomerConnection('capacity-only');
        const result = await matchConnection({ connectionId: connection.id }, prisma);
        assert.equal(result.status, 'MATCHED');
        assert.equal(result.relaisUserId, capacityOnly.id);
      }

      const atCapacity = await createCustomerConnection('capacity-only');
      const noCapacity = await matchConnection({ connectionId: atCapacity.id }, prisma);
      assert.equal(noCapacity.status, 'NO_RELAIS_AVAILABLE');
      assert.equal(await prisma.connectionAssignment.count({ where: { connectionId: atCapacity.id } }), 0);
    } finally {
      await cleanup();
    }
  });

  test('concurrent matching of one Connection creates one assignment and one Conversation', async () => {
    try {
      await createRelais({ languages: ['concurrent'] });
      const connection = await createCustomerConnection('concurrent');
      const results = await Promise.all([
        matchConnection({ connectionId: connection.id }, prisma),
        matchConnection({ connectionId: connection.id }, prisma),
      ]);
      assert.deepEqual(results.map((result) => result.status).sort(), ['ALREADY_MATCHED', 'MATCHED']);
      assert.equal(await prisma.connectionAssignment.count({ where: { connectionId: connection.id, endedAt: null } }), 1);
      assert.equal(await prisma.conversation.count({ where: { connectionId: connection.id } }), 1);
      assert.equal((await prisma.connection.findUnique({ where: { id: connection.id } }))?.lifecycle, 'CONNECTED');
    } finally {
      await cleanup();
    }
  });

  test('rejects missing, ended, and already-assigned invalid Connection states', async () => {
    try {
      await expectError(matchConnection({ connectionId: 'missing-connection' }, prisma), 'CONNECTION_NOT_FOUND');
      const relais = await createRelais({ languages: ['state'] });
      const ended = await createCustomerConnection('state');
      await prisma.connection.update({ where: { id: ended.id }, data: { lifecycle: 'ENDED', endedAt: new Date(), terminalOutcome: 'CUSTOMER_CANCELLED' } });
      await expectError(matchConnection({ connectionId: ended.id }, prisma), 'CONNECTION_NOT_MATCHING');

      const assigned = await createCustomerConnection('state');
      await prisma.connectionAssignment.create({ data: { connectionId: assigned.id, relaisUserId: relais.id } });
      await expectError(matchConnection({ connectionId: assigned.id }, prisma), 'CONNECTION_ALREADY_ASSIGNED');
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
      await prisma.relaisLanguage.deleteMany({ where: { relaisProfile: { userId: { in: userIds } } } });
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
