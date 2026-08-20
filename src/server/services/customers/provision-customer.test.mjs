import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('provisionCustomerFromVerifiedPhone database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [{ PrismaPg }, { PrismaClient }, { ProvisionCustomerError, provisionCustomerFromVerifiedPhone }] =
    await Promise.all([
      import('@prisma/adapter-pg'),
      import('@prisma/client'),
      import('./provision-customer.ts'),
    ]);

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  const testNumber = Number.parseInt(randomUUID().replace(/\D/g, '').slice(0, 4) || '1234', 10);
  const makeBurkinaPhone = (offset) => `+2267012${String((testNumber + offset) % 10000).padStart(4, '0')}`;
  const makeUsPhone = () => `+1201555${String(testNumber).padStart(4, '0')}`;
  const makeFrancePhone = () => `+3361234${String(testNumber).padStart(4, '0')}`;

  const expectError = async (promise, code) => {
    await assert.rejects(promise, (error) => {
      assert.ok(error instanceof ProvisionCustomerError);
      assert.equal(error.code, code);
      return true;
    });
  };

  const cleanupPhones = async (phones) => {
    const users = await prisma.user.findMany({
      where: { phoneNumber: { in: phones } },
      select: { id: true },
    });
    const ids = users.map(({ id }) => id);
    if (!ids.length) return;

    await prisma.customerProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.relaisProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  };

  test('provisions verified international customers and preserves identity boundaries', async () => {
    const phones = [
      makeBurkinaPhone(1),
      makeBurkinaPhone(2),
      makeBurkinaPhone(3),
      makeBurkinaPhone(4),
      makeBurkinaPhone(5),
      makeBurkinaPhone(6),
      makeUsPhone(),
      makeFrancePhone(),
    ];
    const connectionCountBefore = await prisma.connection.count();

    try {
      const verifiedAt = new Date('2026-08-20T15:00:00.000Z');
      const created = await provisionCustomerFromVerifiedPhone({
        verifiedPhone: { phoneNumber: phones[0].replace('+226', '+226 '), verifiedAt },
        preferredLanguage: 'Mooré',
      }, prisma);
      assert.equal(created.status, 'CREATED');
      assert.equal(created.customer.phoneNumber, phones[0]);
      assert.equal(created.customer.phoneVerifiedAt.toISOString(), verifiedAt.toISOString());
      assert.equal(created.customer.role, 'CUSTOMER');
      assert.equal(created.customer.accountStatus, 'ACTIVE');
      assert.equal(created.customer.preferredLanguage, 'Mooré');

      const stored = await prisma.user.findUnique({
        where: { id: created.customer.id },
        include: { customerProfile: true },
      });
      assert.equal(stored.customerProfile?.userId, created.customer.id);

      const retry = await provisionCustomerFromVerifiedPhone({
        verifiedPhone: { phoneNumber: phones[0], verifiedAt: new Date('2026-08-21T15:00:00.000Z') },
        preferredLanguage: 'French',
      }, prisma);
      assert.equal(retry.status, 'EXISTING');
      assert.equal(retry.customer.id, created.customer.id);
      assert.equal(await prisma.user.count({ where: { phoneNumber: phones[0] } }), 1);
      assert.equal(await prisma.customerProfile.count({ where: { userId: created.customer.id } }), 1);

      const us = await provisionCustomerFromVerifiedPhone({
        verifiedPhone: { phoneNumber: makeUsPhone(), verifiedAt },
      }, prisma);
      const france = await provisionCustomerFromVerifiedPhone({
        verifiedPhone: { phoneNumber: makeFrancePhone(), verifiedAt },
      }, prisma);
      assert.equal(us.customer.phoneNumber, makeUsPhone());
      assert.equal(france.customer.phoneNumber, makeFrancePhone());

      const suspended = await prisma.user.create({
        data: {
          phoneNumber: phones[1],
          phoneVerifiedAt: verifiedAt,
          role: 'CUSTOMER',
          accountStatus: 'SUSPENDED',
          customerProfile: { create: {} },
        },
      });
      const deactivated = await prisma.user.create({
        data: {
          phoneNumber: phones[2],
          phoneVerifiedAt: verifiedAt,
          role: 'CUSTOMER',
          accountStatus: 'DEACTIVATED',
          customerProfile: { create: {} },
        },
      });
      const relais = await prisma.user.create({
        data: {
          phoneNumber: phones[3],
          phoneVerifiedAt: verifiedAt,
          role: 'RELAIS',
          relaisProfile: { create: {} },
        },
      });
      const admin = await prisma.user.create({
        data: { phoneNumber: phones[4], phoneVerifiedAt: verifiedAt, role: 'ADMIN' },
      });
      const missingProfile = await prisma.user.create({
        data: { phoneNumber: phones[5], phoneVerifiedAt: verifiedAt, role: 'CUSTOMER' },
      });

      await expectError(
        provisionCustomerFromVerifiedPhone({ verifiedPhone: { phoneNumber: phones[1], verifiedAt } }, prisma),
        'ACCOUNT_NOT_ACTIVE',
      );
      await expectError(
        provisionCustomerFromVerifiedPhone({ verifiedPhone: { phoneNumber: phones[2], verifiedAt } }, prisma),
        'ACCOUNT_NOT_ACTIVE',
      );
      await expectError(
        provisionCustomerFromVerifiedPhone({ verifiedPhone: { phoneNumber: phones[3], verifiedAt } }, prisma),
        'IDENTITY_ROLE_CONFLICT',
      );
      await expectError(
        provisionCustomerFromVerifiedPhone({ verifiedPhone: { phoneNumber: phones[4], verifiedAt } }, prisma),
        'IDENTITY_ROLE_CONFLICT',
      );
      await expectError(
        provisionCustomerFromVerifiedPhone({ verifiedPhone: { phoneNumber: phones[5], verifiedAt } }, prisma),
        'CUSTOMER_PROFILE_MISSING',
      );
      await expectError(
        provisionCustomerFromVerifiedPhone({ verifiedPhone: { phoneNumber: '70123456', verifiedAt } }, prisma),
        'INVALID_PHONE_NUMBER',
      );
      await expectError(
        provisionCustomerFromVerifiedPhone({ verifiedPhone: { phoneNumber: phones[0], verifiedAt: new Date('invalid') } }, prisma),
        'INVALID_VERIFICATION_CONTEXT',
      );

      assert.equal(suspended.accountStatus, 'SUSPENDED');
      assert.equal(deactivated.accountStatus, 'DEACTIVATED');
      assert.equal(relais.role, 'RELAIS');
      assert.equal(admin.role, 'ADMIN');
      assert.equal(missingProfile.role, 'CUSTOMER');
      assert.equal(await prisma.connection.count(), connectionCountBefore);
    } finally {
      await cleanupPhones(phones);
    }

    assert.equal(await prisma.connection.count(), connectionCountBefore);
  });

  test('concurrent first-time verification creates one Customer and one profile', async () => {
    const phone = makeBurkinaPhone(7);
    try {
      const results = await Promise.all(
        Array.from({ length: 4 }, (_, index) =>
          provisionCustomerFromVerifiedPhone({
            verifiedPhone: { phoneNumber: phone, verifiedAt: new Date(2026, 7, 20, 15, index) },
          }, prisma),
        ),
      );
      assert.equal(new Set(results.map(({ customer }) => customer.id)).size, 1);
      const user = await prisma.user.findUnique({
        where: { phoneNumber: phone },
        include: { customerProfile: true },
      });
      assert.ok(user);
      assert.equal(await prisma.user.count({ where: { phoneNumber: phone } }), 1);
      assert.equal(await prisma.customerProfile.count({ where: { userId: user.id } }), 1);
    } finally {
      await cleanupPhones([phone]);
    }
  });

  test.after(async () => {
    await prisma.$disconnect();
  });
}
