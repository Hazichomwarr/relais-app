import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('requestConnection database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [{ PrismaPg }, { PrismaClient }, { ConnectionRequestError, requestConnection }] =
    await Promise.all([
      import('@prisma/adapter-pg'),
      import('@prisma/client'),
      import('./request-connection.ts'),
    ]);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const prefix = `request-connection-test-${randomUUID()}`;
  const users = [];

  const actor = (user, role, accountStatus = 'ACTIVE') => ({
    userId: user.id,
    role,
    accountStatus,
  });

  const expectError = async (promise, code) => {
    await assert.rejects(promise, (error) => {
      assert.ok(error instanceof ConnectionRequestError);
      assert.equal(error.code, code);
      return true;
    });
  };

  test('requestConnection enforces authorization, fallback language, and idempotency', async () => {
    try {
      const customer = await prisma.user.create({ data: { role: 'CUSTOMER' } });
      const customerProfile = await prisma.customerProfile.create({
        data: { userId: customer.id, preferredLanguage: 'Dioula' },
      });
      users.push(customer);

      const suspended = await prisma.user.create({
        data: { role: 'CUSTOMER', accountStatus: 'SUSPENDED' },
      });
      const deactivated = await prisma.user.create({
        data: { role: 'CUSTOMER', accountStatus: 'DEACTIVATED' },
      });
      const relais = await prisma.user.create({ data: { role: 'RELAIS' } });
      const admin = await prisma.user.create({ data: { role: 'ADMIN' } });
      const missingProfile = await prisma.user.create({ data: { role: 'CUSTOMER' } });
      users.push(suspended, deactivated, relais, admin, missingProfile);

      const first = await requestConnection({
        actor: actor(customer, 'CUSTOMER'),
        requestKey: `${prefix}-fallback`,
      }, prisma);
      assert.equal(first.status, 'CREATED');
      assert.equal(first.connection.lifecycle, 'MATCHING');
      assert.equal(first.connection.preferredLanguage, customerProfile.preferredLanguage);

      const explicit = await requestConnection({
        actor: actor(customer, 'CUSTOMER'),
        requestKey: `${prefix}-explicit`,
        preferredLanguage: 'Mooré',
      }, prisma);
      assert.equal(explicit.status, 'CREATED');
      assert.equal(explicit.connection.preferredLanguage, 'Mooré');

      const retry = await requestConnection({
        actor: actor(customer, 'CUSTOMER'),
        requestKey: `${prefix}-fallback`,
        preferredLanguage: 'French',
      }, prisma);
      assert.equal(retry.status, 'EXISTING');
      assert.equal(retry.connection.id, first.connection.id);
      assert.equal(retry.connection.preferredLanguage, 'Dioula');

      await expectError(
        requestConnection({
          actor: actor(suspended, 'CUSTOMER', 'SUSPENDED'),
          requestKey: `${prefix}-suspended`,
        }, prisma),
        'UNAUTHORIZED',
      );
      await expectError(
        requestConnection({
          actor: actor(deactivated, 'CUSTOMER', 'DEACTIVATED'),
          requestKey: `${prefix}-deactivated`,
        }, prisma),
        'UNAUTHORIZED',
      );
      await expectError(
        requestConnection({
          actor: actor(relais, 'RELAIS'),
          requestKey: `${prefix}-relais`,
        }, prisma),
        'UNAUTHORIZED',
      );
      await expectError(
        requestConnection({
          actor: actor(admin, 'ADMIN'),
          requestKey: `${prefix}-admin`,
        }, prisma),
        'UNAUTHORIZED',
      );
      await expectError(
        requestConnection({
          actor: actor(missingProfile, 'CUSTOMER'),
          requestKey: `${prefix}-missing-profile`,
        }, prisma),
        'CUSTOMER_PROFILE_MISSING',
      );
      await expectError(
        requestConnection({
          actor: actor(customer, 'CUSTOMER'),
          requestKey: '   ',
        }, prisma),
        'INVALID_REQUEST_KEY',
      );
      await expectError(
        requestConnection({
          actor: actor(customer, 'CUSTOMER'),
          requestKey: `${prefix}-invalid-language`,
          preferredLanguage: '   ',
        }, prisma),
        'INVALID_LANGUAGE',
      );

      const customerConnections = await prisma.connection.findMany({
        where: { customerId: customer.id, requestKey: { startsWith: prefix } },
      });
      assert.equal(customerConnections.length, 2);
      assert.equal(await prisma.connectionAssignment.count({ where: { connectionId: first.connection.id } }), 0);
      assert.equal(await prisma.conversation.count({ where: { connectionId: first.connection.id } }), 0);
    } finally {
      const ids = users.map(({ id }) => id);
      if (ids.length) {
        await prisma.connection.deleteMany({ where: { customerId: { in: ids } } });
        await prisma.customerProfile.deleteMany({ where: { userId: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      }
    }
  });

  test('concurrent retries create one Connection and distinct keys remain distinct', async () => {
    try {
      const customer = await prisma.user.create({ data: { role: 'CUSTOMER' } });
      await prisma.customerProfile.create({ data: { userId: customer.id } });
      users.push(customer);

      const results = await Promise.all(
        Array.from({ length: 4 }, () =>
          requestConnection({
            actor: actor(customer, 'CUSTOMER'),
            requestKey: `${prefix}-concurrent`,
          }, prisma),
        ),
      );
      assert.equal(new Set(results.map(({ connection }) => connection.id)).size, 1);
      assert.equal(
        await prisma.connection.count({
          where: { customerId: customer.id, requestKey: `${prefix}-concurrent` },
        }),
        1,
      );

      const distinct = await Promise.all(
        ['one', 'two'].map((suffix) =>
          requestConnection({
            actor: actor(customer, 'CUSTOMER'),
            requestKey: `${prefix}-distinct-${suffix}`,
          }, prisma),
        ),
      );
      assert.equal(new Set(distinct.map(({ connection }) => connection.id)).size, 2);
      assert.equal(
        await prisma.connection.count({
          where: { customerId: customer.id, requestKey: { startsWith: `${prefix}-distinct-` } },
        }),
        2,
      );
    } finally {
      const ids = users.map(({ id }) => id);
      if (ids.length) {
        await prisma.connection.deleteMany({ where: { customerId: { in: ids } } });
        await prisma.customerProfile.deleteMany({ where: { userId: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: ids } } });
      }
    }
  });

  test.after(async () => {
    await prisma.$disconnect();
  });
}
