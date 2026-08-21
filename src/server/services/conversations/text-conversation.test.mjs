import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('text Conversation database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [
    { PrismaPg },
    { PrismaClient },
    { sendTextMessage, SendTextMessageError, MAX_TEXT_MESSAGE_LENGTH },
    { listConversationMessages, ListConversationMessagesError },
    { cancelConnection },
  ] = await Promise.all([
    import('@prisma/adapter-pg'),
    import('@prisma/client'),
    import('./send-text-message.ts'),
    import('./list-conversation-messages.ts'),
    import('../connections/cancel-connection.ts'),
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

  const createConnectedFixture = async () => {
    const customer = await createCustomer();
    const relais = await createRelais();
    const connection = await prisma.connection.create({
      data: { customerId: customer.id, requestKey: `message-test-${connectionIds.length}-${customer.id}` },
    });
    connectionIds.push(connection.id);
    const assignment = await prisma.connectionAssignment.create({
      data: { connectionId: connection.id, relaisUserId: relais.id },
    });
    const conversation = await prisma.conversation.create({ data: { connectionId: connection.id } });
    await prisma.connection.update({
      where: { id: connection.id },
      data: { lifecycle: 'CONNECTED', connectedAt: new Date('2026-08-20T20:00:00.000Z') },
    });
    return { customer, relais, connection, assignment, conversation };
  };

  const customerActor = (user) => ({ userId: user.id, role: 'CUSTOMER', accountStatus: user.accountStatus });
  const relaisActor = (user, eligibility = 'APPROVED') => ({
    userId: user.id,
    role: 'RELAIS',
    accountStatus: user.accountStatus,
    relaisEligibility: eligibility,
  });

  const expectError = async (promise, ErrorClass, code) => {
    await assert.rejects(promise, (error) => {
      assert.ok(error instanceof ErrorClass);
      assert.equal(error.code, code);
      return true;
    });
  };

  test('Customer and assigned Relais can send Unicode text regardless of availability', async () => {
    try {
      const fixture = await createConnectedFixture();
      await prisma.relaisProfile.update({ where: { userId: fixture.relais.id }, data: { availability: 'UNAVAILABLE' } });
      const customerMessage = await sendTextMessage({
        actor: customerActor(fixture.customer),
        conversationId: fixture.conversation.id,
        text: 'Bonjour Mamadou — mooré: yɛla, Dioula: ɛ — 👋',
        clientMessageId: 'customer-1',
      }, prisma);
      const relaisMessage = await sendTextMessage({
        actor: relaisActor(fixture.relais),
        conversationId: fixture.conversation.id,
        text: "Bonjour Cheick. Je m'en occupe.",
        clientMessageId: 'relais-1',
      }, prisma);
      assert.equal(customerMessage.status, 'CREATED');
      assert.equal(customerMessage.message.senderUserId, fixture.customer.id);
      assert.equal(customerMessage.message.type, 'TEXT');
      assert.equal(relaisMessage.message.senderUserId, fixture.relais.id);
      assert.equal(relaisMessage.message.text, "Bonjour Cheick. Je m'en occupe.");
      assert.equal(await prisma.message.count({ where: { conversationId: fixture.conversation.id } }), 2);
    } finally {
      await cleanup();
    }
  });

  test('wrong Customer, unrelated Relais, and former Relais cannot send', async () => {
    try {
      const fixture = await createConnectedFixture();
      const otherCustomer = await createCustomer();
      const formerRelais = await createRelais();
      await expectError(sendTextMessage({ actor: customerActor(otherCustomer), conversationId: fixture.conversation.id, text: 'No', clientMessageId: 'wrong-customer' }, prisma), SendTextMessageError, 'UNAUTHORIZED');
      await expectError(sendTextMessage({ actor: relaisActor(formerRelais), conversationId: fixture.conversation.id, text: 'No', clientMessageId: 'wrong-relais' }, prisma), SendTextMessageError, 'UNAUTHORIZED');

      await prisma.connectionAssignment.update({ where: { id: fixture.assignment.id }, data: { endedAt: new Date('2026-08-20T20:01:00.000Z') } });
      await prisma.connectionAssignment.create({ data: { connectionId: fixture.connection.id, relaisUserId: formerRelais.id } });
      await expectError(sendTextMessage({ actor: relaisActor(fixture.relais), conversationId: fixture.conversation.id, text: 'Historical only', clientMessageId: 'former' }, prisma), SendTextMessageError, 'UNAUTHORIZED');
      const current = await sendTextMessage({ actor: relaisActor(formerRelais), conversationId: fixture.conversation.id, text: 'Bonjour', clientMessageId: 'current' }, prisma);
      assert.equal(current.status, 'CREATED');
    } finally {
      await cleanup();
    }
  });

  test('suspended Customers and ineligible Relais cannot send new text', async () => {
    try {
      const fixture = await createConnectedFixture();
      await prisma.user.update({ where: { id: fixture.customer.id }, data: { accountStatus: 'SUSPENDED' } });
      await expectError(sendTextMessage({ actor: customerActor({ ...fixture.customer, accountStatus: 'SUSPENDED' }), conversationId: fixture.conversation.id, text: 'Blocked', clientMessageId: 'suspended' }, prisma), SendTextMessageError, 'UNAUTHORIZED');

      await prisma.user.update({ where: { id: fixture.customer.id }, data: { accountStatus: 'ACTIVE' } });
      await prisma.relaisProfile.update({ where: { userId: fixture.relais.id }, data: { eligibility: 'REVOKED' } });
      await expectError(sendTextMessage({ actor: relaisActor(fixture.relais, 'REVOKED'), conversationId: fixture.conversation.id, text: 'Blocked', clientMessageId: 'revoked' }, prisma), SendTextMessageError, 'UNAUTHORIZED');
    } finally {
      await cleanup();
    }
  });

  test('validates text and preserves idempotent immutable payloads', async () => {
    try {
      const fixture = await createConnectedFixture();
      const input = { actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, text: 'Bonjour', clientMessageId: 'retry-1' };
      const created = await sendTextMessage(input, prisma);
      const existing = await sendTextMessage(input, prisma);
      assert.equal(created.status, 'CREATED');
      assert.equal(existing.status, 'EXISTING');
      assert.equal(existing.message.id, created.message.id);
      await expectError(sendTextMessage({ ...input, text: 'Autre chose' }, prisma), SendTextMessageError, 'IDEMPOTENCY_CONFLICT');
      await expectError(sendTextMessage({ ...input, text: '   ', clientMessageId: 'empty' }, prisma), SendTextMessageError, 'INVALID_TEXT');
      await expectError(sendTextMessage({ ...input, text: 'x'.repeat(MAX_TEXT_MESSAGE_LENGTH + 1), clientMessageId: 'long' }, prisma), SendTextMessageError, 'TEXT_TOO_LONG');
      assert.equal((await prisma.message.findUnique({ where: { id: created.message.id } }))?.text, 'Bonjour');
    } finally {
      await cleanup();
    }
  });

  test('concurrent identical sends create one Message', async () => {
    try {
      const fixture = await createConnectedFixture();
      const input = { actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, text: 'Une seule fois', clientMessageId: 'concurrent-1' };
      const results = await Promise.all([sendTextMessage(input, prisma), sendTextMessage(input, prisma)]);
      assert.deepEqual(results.map((result) => result.status).sort(), ['CREATED', 'EXISTING']);
      assert.equal(await prisma.message.count({ where: { conversationId: fixture.conversation.id } }), 1);
    } finally {
      await cleanup();
    }
  });

  test('list authorization, deterministic ordering, and bounded cursor pagination work', async () => {
    try {
      const fixture = await createConnectedFixture();
      const other = await createCustomer();
      const messages = [];
      for (let index = 1; index <= 5; index += 1) {
        messages.push(await sendTextMessage({
          actor: customerActor(fixture.customer),
          conversationId: fixture.conversation.id,
          text: `Message ${index}`,
          clientMessageId: `page-${index}`,
        }, prisma));
      }
      const firstPage = await listConversationMessages({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, limit: 2 }, prisma);
      assert.equal(firstPage.messages.length, 2);
      assert.equal(firstPage.messages[0].text, 'Message 4');
      assert.equal(firstPage.messages[1].text, 'Message 5');
      assert.ok(firstPage.nextCursor);
      const secondPage = await listConversationMessages({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, cursor: firstPage.nextCursor, limit: 2 }, prisma);
      assert.deepEqual(secondPage.messages.map((message) => message.text), ['Message 2', 'Message 3']);
      const thirdPage = await listConversationMessages({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, cursor: secondPage.nextCursor, limit: 2 }, prisma);
      assert.deepEqual(thirdPage.messages.map((message) => message.text), ['Message 1']);
      assert.equal(thirdPage.nextCursor, null);
      await expectError(listConversationMessages({ actor: customerActor(other), conversationId: fixture.conversation.id }, prisma), ListConversationMessagesError, 'UNAUTHORIZED');
      await expectError(listConversationMessages({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, limit: 101 }, prisma), ListConversationMessagesError, 'INVALID_LIMIT');
      assert.equal(messages.length, 5);
    } finally {
      await cleanup();
    }
  });

  test('MATCHING and ENDED Connections reject ordinary text, and terminalization never deletes Messages', async () => {
    try {
      const matchingCustomer = await createCustomer();
      const matchingConnection = await prisma.connection.create({ data: { customerId: matchingCustomer.id, requestKey: `matching-${matchingCustomer.id}` } });
      connectionIds.push(matchingConnection.id);
      const malformedConversation = await prisma.conversation.create({ data: { connectionId: matchingConnection.id } });
      await expectError(sendTextMessage({ actor: customerActor(matchingCustomer), conversationId: malformedConversation.id, text: 'No', clientMessageId: 'matching' }, prisma), SendTextMessageError, 'CONNECTION_NOT_CONNECTED');

      const fixture = await createConnectedFixture();
      const sent = await sendTextMessage({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, text: 'Before ending', clientMessageId: 'before-end' }, prisma);
      await cancelConnection({ actor: customerActor(fixture.customer), connectionId: fixture.connection.id }, prisma);
      assert.equal(await prisma.message.count({ where: { id: sent.message.id } }), 1);
      await expectError(sendTextMessage({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id, text: 'After ending', clientMessageId: 'after-end' }, prisma), SendTextMessageError, 'CONNECTION_NOT_CONNECTED');
      await expectError(listConversationMessages({ actor: customerActor(fixture.customer), conversationId: fixture.conversation.id }, prisma), ListConversationMessagesError, 'CONNECTION_NOT_CONNECTED');
    } finally {
      await cleanup();
    }
  });

  test('send and cancellation race leaves a consistent terminal Connection', async () => {
    try {
      const fixture = await createConnectedFixture();
      const results = await Promise.allSettled([
        sendTextMessage({
          actor: customerActor(fixture.customer),
          conversationId: fixture.conversation.id,
          text: 'Race-safe message',
          clientMessageId: 'terminal-race',
        }, prisma),
        cancelConnection({ actor: customerActor(fixture.customer), connectionId: fixture.connection.id }, prisma),
      ]);
      const stored = await prisma.connection.findUnique({ where: { id: fixture.connection.id } });
      assert.equal(stored?.lifecycle, 'ENDED');
      assert.equal(stored?.terminalOutcome, 'CUSTOMER_CANCELLED');
      assert.equal(await prisma.connectionAssignment.count({ where: { connectionId: fixture.connection.id, endedAt: null } }), 0);
      assert.ok(results.some((result) => result.status === 'fulfilled' && result.value.status === 'ENDED'));
      assert.ok((await prisma.message.count({ where: { conversationId: fixture.conversation.id } })) <= 1);
    } finally {
      await cleanup();
    }
  });

  async function cleanup() {
    if (connectionIds.length) {
      await prisma.message.deleteMany({ where: { conversation: { connectionId: { in: connectionIds } } } });
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
