import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('Payment Attempt database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [{ PrismaPg }, { PrismaClient }, { acceptQuickOffer }, { createQuickOffer }, attemptService, confirmService, failService, readService] = await Promise.all([
    import('@prisma/adapter-pg'), import('@prisma/client'), import('../quick-offers/accept-quick-offer.ts'),
    import('../quick-offers/create-quick-offer.ts'), import('./create-payment-attempt.ts'), import('./confirm-payment-attempt.ts'),
    import('./fail-payment-attempt.ts'), import('./get-mission-payment-obligations.ts'),
  ]);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const userIds = [];
  const connectionIds = [];
  let sequence = 0;
  const customerActor = (user) => ({ userId: user.id, role: 'CUSTOMER', accountStatus: user.accountStatus });
  const relaisActor = (user) => ({ userId: user.id, role: 'RELAIS', accountStatus: user.accountStatus, relaisEligibility: 'APPROVED' });
  const adminActor = (user) => ({ userId: user.id, role: 'ADMIN', accountStatus: user.accountStatus });
  const expectCode = async (promise, ErrorClass, code) => assert.rejects(promise, (error) => error instanceof ErrorClass && error.code === code);

  async function fixture() {
    const customer = await prisma.user.create({ data: { role: 'CUSTOMER', phoneNumber: `+226706${String(100000 + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), customerProfile: { create: {} } } });
    userIds.push(customer.id);
    const relais = await prisma.user.create({ data: { role: 'RELAIS', phoneNumber: `+226707${String(100000 + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), relaisProfile: { create: { eligibility: 'APPROVED', availability: 'UNAVAILABLE' } } } });
    userIds.push(relais.id);
    const connection = await prisma.connection.create({ data: { customerId: customer.id, requestKey: `3d-${Date.now()}-${sequence++}`, lifecycle: 'CONNECTED', connectedAt: new Date() } });
    connectionIds.push(connection.id);
    await prisma.connectionAssignment.create({ data: { connectionId: connection.id, relaisUserId: relais.id } });
    await prisma.conversation.create({ data: { connectionId: connection.id } });
    const offer = await createQuickOffer({ actor: relaisActor(relais), connectionId: connection.id, amount: 2000, clientOfferId: `3d-offer-${sequence++}` }, prisma);
    const accepted = await acceptQuickOffer({ actor: customerActor(customer), quickOfferId: offer.offer.id }, prisma);
    return { customer, relais, connection, missionId: accepted.mission.id, obligationId: accepted.paymentObligation.id };
  }

  async function cleanup() {
    if (connectionIds.length) {
      await prisma.paymentAttempt.deleteMany({ where: { paymentObligation: { mission: { connectionId: { in: connectionIds } } } } });
      await prisma.paymentObligation.deleteMany({ where: { mission: { connectionId: { in: connectionIds } } } });
      await prisma.missionAssignment.deleteMany({ where: { mission: { connectionId: { in: connectionIds } } } });
      await prisma.mission.deleteMany({ where: { connectionId: { in: connectionIds } } });
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
    connectionIds.length = 0; userIds.length = 0;
  }

  test('Customer creates an exact-amount attempt and retries idempotently', async () => {
    try {
      const f = await fixture();
      const input = { actor: customerActor(f.customer), paymentObligationId: f.obligationId, method: 'MOBILE_MONEY', provider: 'MANUAL', clientAttemptId: 'pay-1' };
      const created = await attemptService.createPaymentAttempt(input, prisma);
      assert.equal(created.status, 'CREATED');
      assert.equal(created.attempt.amount, 2000); assert.equal(created.attempt.currency, 'XOF'); assert.equal(created.attempt.status, 'INITIATED');
      const existing = await attemptService.createPaymentAttempt(input, prisma);
      assert.equal(existing.status, 'EXISTING'); assert.equal(existing.attempt.id, created.attempt.id);
      await expectCode(attemptService.createPaymentAttempt({ ...input, method: 'CARD' }, prisma), attemptService.CreatePaymentAttemptError, 'IDEMPOTENCY_CONFLICT');
    } finally { await cleanup(); }
  });

  test('wrong Customer and Relais cannot initiate payment; one active attempt blocks another', async () => {
    try {
      const f = await fixture();
      const other = await prisma.user.create({ data: { role: 'CUSTOMER', phoneNumber: `+226708${String(100000 + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), customerProfile: { create: {} } } });
      userIds.push(other.id);
      const base = { paymentObligationId: f.obligationId, method: 'MOBILE_MONEY', provider: 'MANUAL' };
      await expectCode(attemptService.createPaymentAttempt({ actor: customerActor(other), ...base, clientAttemptId: 'wrong' }, prisma), attemptService.CreatePaymentAttemptError, 'UNAUTHORIZED');
      await expectCode(attemptService.createPaymentAttempt({ actor: relaisActor(f.relais), ...base, clientAttemptId: 'relais' }, prisma), attemptService.CreatePaymentAttemptError, 'UNAUTHORIZED');
      await attemptService.createPaymentAttempt({ actor: customerActor(f.customer), ...base, clientAttemptId: 'active-a' }, prisma);
      await expectCode(attemptService.createPaymentAttempt({ actor: customerActor(f.customer), ...base, clientAttemptId: 'active-b' }, prisma), attemptService.CreatePaymentAttemptError, 'ACTIVE_PAYMENT_ATTEMPT_EXISTS');
    } finally { await cleanup(); }
  });

  test('failed attempt leaves obligation pending and permits a new attempt', async () => {
    try {
      const f = await fixture();
      const created = await attemptService.createPaymentAttempt({ actor: customerActor(f.customer), paymentObligationId: f.obligationId, method: 'MOBILE_MONEY', provider: 'MANUAL', clientAttemptId: 'fail-a' }, prisma);
      const failed = await failService.failPaymentAttempt({ paymentAttemptId: created.attempt.id, failureCode: 'PROVIDER_DECLINED' }, prisma);
      assert.equal(failed.attempt.status, 'FAILED');
      assert.equal((await prisma.paymentObligation.findUnique({ where: { id: f.obligationId } }))?.status, 'PENDING');
      const next = await attemptService.createPaymentAttempt({ actor: customerActor(f.customer), paymentObligationId: f.obligationId, method: 'CARD', provider: 'MANUAL', clientAttemptId: 'fail-b' }, prisma);
      assert.equal(next.status, 'CREATED');
    } finally { await cleanup(); }
  });

  test('trusted confirmation pays the obligation and activates only the QUICK Mission', async () => {
    try {
      const f = await fixture();
      const created = await attemptService.createPaymentAttempt({ actor: customerActor(f.customer), paymentObligationId: f.obligationId, method: 'MOBILE_MONEY', provider: 'MANUAL', clientAttemptId: 'confirm-a' }, prisma);
      const confirmedAt = new Date();
      const result = await confirmService.confirmPaymentAttempt({ paymentAttemptId: created.attempt.id, confirmation: { source: 'PROVIDER', provider: 'MANUAL', externalReference: 'TX-3D-1', confirmedAt, confirmedAmount: 2000, currency: 'XOF' } }, prisma);
      assert.equal(result.attempt.status, 'SUCCEEDED'); assert.equal(result.obligation.status, 'PAID'); assert.equal(result.mission.lifecycle, 'ACTIVE');
      const repeated = await confirmService.confirmPaymentAttempt({ paymentAttemptId: created.attempt.id, confirmation: { source: 'PROVIDER', provider: 'MANUAL', externalReference: 'TX-3D-1', confirmedAt, confirmedAmount: 2000, currency: 'XOF' } }, prisma);
      assert.equal(repeated.status, 'EXISTING');
      await expectCode(confirmService.confirmPaymentAttempt({ paymentAttemptId: created.attempt.id, confirmation: { source: 'PROVIDER', provider: 'MANUAL', externalReference: 'TX-3D-1-other', confirmedAt, confirmedAmount: 2000, currency: 'XOF' } }, prisma), confirmService.ConfirmPaymentAttemptError, 'INVALID_PAYMENT_ATTEMPT_STATE');
      const read = await readService.getMissionPaymentObligations({ actor: customerActor(f.customer), missionId: f.missionId }, prisma);
      assert.equal(read.obligations[0].attempts[0].status, 'SUCCEEDED');
    } finally { await cleanup(); }
  });

  test('wrong confirmation terms and unauthorized manual confirmation do not pay', async () => {
    try {
      const f = await fixture();
      const created = await attemptService.createPaymentAttempt({ actor: customerActor(f.customer), paymentObligationId: f.obligationId, method: 'MOBILE_MONEY', provider: 'MANUAL', clientAttemptId: 'confirm-b' }, prisma);
      await expectCode(confirmService.confirmPaymentAttempt({ paymentAttemptId: created.attempt.id, confirmation: { source: 'PROVIDER', provider: 'MANUAL', externalReference: 'TX-3D-2', confirmedAt: new Date(), confirmedAmount: 1500, currency: 'XOF' } }, prisma), confirmService.ConfirmPaymentAttemptError, 'INVALID_CONFIRMATION_AMOUNT');
      await expectCode(confirmService.confirmPaymentAttempt({ paymentAttemptId: created.attempt.id, confirmation: { source: 'MANUAL', provider: 'MANUAL', externalReference: 'TX-3D-3', confirmedAt: new Date(), confirmedAmount: 2000, currency: 'XOF' }, actor: customerActor(f.customer) }, prisma), confirmService.ConfirmPaymentAttemptError, 'UNAUTHORIZED');
    } finally { await cleanup(); }
  });

  test.after(async () => { await cleanup(); await prisma.$disconnect(); });
}
