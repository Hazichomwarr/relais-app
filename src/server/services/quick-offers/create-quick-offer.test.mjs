import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('QUICK Offer creation database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [{ PrismaPg }, { PrismaClient }, service] = await Promise.all([
    import('@prisma/adapter-pg'),
    import('@prisma/client'),
    import('./create-quick-offer.ts'),
  ]);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const userIds = [];
  const connectionIds = [];
  let sequence = 0;

  const createCustomer = async ({ accountStatus = 'ACTIVE' } = {}) => {
    const user = await prisma.user.create({
      data: { role: 'CUSTOMER', accountStatus, customerProfile: { create: {} } },
    });
    userIds.push(user.id);
    return user;
  };

  const createRelais = async ({ accountStatus = 'ACTIVE', eligibility = 'APPROVED', availability = 'UNAVAILABLE' } = {}) => {
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

  const createConnection = async (customerId, lifecycle = 'CONNECTED', withConversation = true) => {
    const connection = await prisma.connection.create({
      data: {
        customerId,
        requestKey: `quick-offer-${Date.now()}-${sequence += 1}`,
        lifecycle,
        connectedAt: lifecycle === 'CONNECTED' ? new Date() : null,
      },
    });
    connectionIds.push(connection.id);
    return withConversation
      ? { connection, conversation: await prisma.conversation.create({ data: { connectionId: connection.id } }) }
      : { connection, conversation: null };
  };

  const createConnectedFixture = async (relaisOptions = {}) => {
    const customer = await createCustomer();
    const relais = await createRelais(relaisOptions);
    const { connection, conversation } = await createConnection(customer.id);
    const assignment = await prisma.connectionAssignment.create({
      data: { connectionId: connection.id, relaisUserId: relais.id },
    });
    return { customer, relais, connection, conversation, assignment };
  };

  const relaisActor = (user, eligibility = 'APPROVED') => ({
    userId: user.id,
    role: 'RELAIS',
    accountStatus: user.accountStatus,
    relaisEligibility: eligibility,
  });

  const expectError = async (promise, code) => {
    await assert.rejects(promise, (error) => {
      assert.ok(error instanceof service.CreateQuickOfferError);
      assert.equal(error.code, code);
      return true;
    });
  };

  const offerInput = (fixture, overrides = {}) => ({
    actor: relaisActor(fixture.relais),
    connectionId: fixture.connection.id,
    amount: 2000,
    clientOfferId: `offer-${Date.now()}-${sequence += 1}`,
    ...overrides,
  });

  test('creates a pending XOF offer without changing the connected workflow', async () => {
    try {
      const fixture = await createConnectedFixture();
      const before = await prisma.connection.findUnique({ where: { id: fixture.connection.id } });
      const result = await service.createQuickOffer(offerInput(fixture), prisma);

      assert.equal(result.status, 'CREATED');
      assert.equal(result.offer.connectionId, fixture.connection.id);
      assert.equal(result.offer.amount, 2000);
      assert.equal(result.offer.currency, 'XOF');
      assert.equal(result.offer.status, 'PENDING');
      assert.equal((await prisma.quickOffer.count({ where: { connectionId: fixture.connection.id } })), 1);
      assert.equal((await prisma.connection.findUnique({ where: { id: fixture.connection.id } }))?.lifecycle, 'CONNECTED');
      assert.equal(before?.terminalOutcome, null);
    } finally {
      await cleanup();
    }
  });

  test('assigned unavailable Relais may create, while other roles and former Relais may not', async () => {
    try {
      const fixture = await createConnectedFixture({ availability: 'UNAVAILABLE' });
      const unrelated = await createRelais();
      const customer = fixture.customer;
      const admin = await prisma.user.create({ data: { role: 'ADMIN' } });
      userIds.push(admin.id);

      const result = await service.createQuickOffer(offerInput(fixture), prisma);
      assert.equal(result.status, 'CREATED');
      await expectError(service.createQuickOffer({ ...offerInput(fixture), actor: relaisActor(unrelated), clientOfferId: `unrelated-${Date.now()}` }, prisma), 'NOT_CURRENT_RELAIS');
      await expectError(service.createQuickOffer({ ...offerInput(fixture), actor: { userId: customer.id, role: 'CUSTOMER', accountStatus: 'ACTIVE' }, clientOfferId: `customer-${Date.now()}` }, prisma), 'UNAUTHORIZED');
      await expectError(service.createQuickOffer({ ...offerInput(fixture), actor: { userId: admin.id, role: 'ADMIN', accountStatus: 'ACTIVE' }, clientOfferId: `admin-${Date.now()}` }, prisma), 'UNAUTHORIZED');

      await prisma.connectionAssignment.update({ where: { id: fixture.assignment.id }, data: { endedAt: new Date() } });
      await expectError(service.createQuickOffer({ ...offerInput(fixture), clientOfferId: `former-${Date.now()}` }, prisma), 'NOT_CURRENT_RELAIS');
    } finally {
      await cleanup();
    }
  });

  test('revalidates suspended, under-review, and revoked Relais in the transaction', async () => {
    for (const relaisOptions of [
      { accountStatus: 'SUSPENDED' },
      { eligibility: 'UNDER_REVIEW' },
      { eligibility: 'REVOKED' },
    ]) {
      try {
        const fixture = await createConnectedFixture(relaisOptions);
        await expectError(service.createQuickOffer(offerInput(fixture), prisma), 'UNAUTHORIZED');
      } finally {
        await cleanup();
      }
    }
  });

  test('requires CONNECTED state and an existing Conversation', async () => {
    try {
      const matchingCustomer = await createCustomer();
      const matchingRelais = await createRelais();
      const matching = await createConnection(matchingCustomer.id, 'MATCHING');
      await prisma.connectionAssignment.create({ data: { connectionId: matching.connection.id, relaisUserId: matchingRelais.id } });
      await expectError(service.createQuickOffer({ actor: relaisActor(matchingRelais), connectionId: matching.connection.id, amount: 2000, clientOfferId: 'matching' }, prisma), 'CONNECTION_NOT_CONNECTED');

      const endedCustomer = await createCustomer();
      const endedRelais = await createRelais();
      const ended = await createConnection(endedCustomer.id, 'ENDED');
      await prisma.connectionAssignment.create({ data: { connectionId: ended.connection.id, relaisUserId: endedRelais.id } });
      await expectError(service.createQuickOffer({ actor: relaisActor(endedRelais), connectionId: ended.connection.id, amount: 2000, clientOfferId: 'ended' }, prisma), 'CONNECTION_NOT_CONNECTED');

      const malformed = await createConnectedFixture();
      await prisma.conversation.delete({ where: { id: malformed.conversation.id } });
      await expectError(service.createQuickOffer(offerInput(malformed), prisma), 'CONNECTION_INTEGRITY_ERROR');
    } finally {
      await cleanup();
    }
  });

  test('validates positive bounded integer amounts and explicit currency', async () => {
    try {
      const fixture = await createConnectedFixture();
      for (const amount of [0, -1000, 1.5, service.MAX_QUICK_OFFER_AMOUNT + 1]) {
        await expectError(service.createQuickOffer(offerInput(fixture, { amount, clientOfferId: `amount-${amount}` }), prisma), amount > service.MAX_QUICK_OFFER_AMOUNT ? 'AMOUNT_TOO_HIGH' : 'INVALID_AMOUNT');
      }
      await expectError(service.createQuickOffer(offerInput(fixture, { currency: 'FCFA', clientOfferId: 'bad-currency' }), prisma), 'INVALID_CURRENCY');
      const valid = await service.createQuickOffer(offerInput(fixture, { currency: 'eur', clientOfferId: 'valid-currency' }), prisma);
      assert.equal(valid.offer.currency, 'EUR');
    } finally {
      await cleanup();
    }
  });

  test('is idempotent and detects payload conflicts', async () => {
    try {
      const fixture = await createConnectedFixture();
      const input = offerInput(fixture, { clientOfferId: 'stable-client-offer-id' });
      const first = await service.createQuickOffer(input, prisma);
      const repeated = await service.createQuickOffer(input, prisma);
      assert.equal(first.status, 'CREATED');
      assert.equal(repeated.status, 'EXISTING');
      assert.equal(repeated.offer.id, first.offer.id);
      await expectError(service.createQuickOffer({ ...input, amount: 3000 }, prisma), 'IDEMPOTENCY_CONFLICT');
      assert.equal(await prisma.quickOffer.count({ where: { connectionId: fixture.connection.id } }), 1);
    } finally {
      await cleanup();
    }
  });

  test('supersedes rather than edits a prior pending price', async () => {
    try {
      const fixture = await createConnectedFixture();
      const first = await service.createQuickOffer(offerInput(fixture, { amount: 2000, clientOfferId: 'revision-a' }), prisma);
      const second = await service.createQuickOffer(offerInput(fixture, { amount: 3000, clientOfferId: 'revision-b' }), prisma);
      assert.equal((await prisma.quickOffer.findUnique({ where: { id: first.offer.id } }))?.status, 'SUPERSEDED');
      assert.equal((await prisma.quickOffer.findUnique({ where: { id: first.offer.id } }))?.amount, 2000);
      assert.equal(second.offer.status, 'PENDING');
      assert.equal(await prisma.quickOffer.count({ where: { connectionId: fixture.connection.id, status: 'PENDING' } }), 1);
    } finally {
      await cleanup();
    }
  });

  test('concurrent identical requests create one offer and concurrent revisions leave one pending', async () => {
    try {
      const identicalFixture = await createConnectedFixture();
      const identicalInput = offerInput(identicalFixture, { clientOfferId: 'concurrent-identical' });
      const identicalResults = await Promise.all([
        service.createQuickOffer(identicalInput, prisma),
        service.createQuickOffer(identicalInput, prisma),
      ]);
      assert.equal(await prisma.quickOffer.count({ where: { connectionId: identicalFixture.connection.id } }), 1);
      assert.deepEqual(identicalResults.map((result) => result.status).sort(), ['CREATED', 'EXISTING']);

      const revisionFixture = await createConnectedFixture();
      const revisionResults = await Promise.all([
        service.createQuickOffer(offerInput(revisionFixture, { amount: 2000, clientOfferId: 'concurrent-a' }), prisma),
        service.createQuickOffer(offerInput(revisionFixture, { amount: 3000, clientOfferId: 'concurrent-b' }), prisma),
      ]);
      assert.equal(revisionResults.filter((result) => result.status === 'CREATED').length, 2);
      assert.equal(await prisma.quickOffer.count({ where: { connectionId: revisionFixture.connection.id, status: 'PENDING' } }), 1);
      assert.equal(await prisma.quickOffer.count({ where: { connectionId: revisionFixture.connection.id } }), 2);
    } finally {
      await cleanup();
    }
  });

  async function cleanup() {
    if (connectionIds.length) {
      await prisma.quickOffer.deleteMany({ where: { connectionId: { in: connectionIds } } });
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
