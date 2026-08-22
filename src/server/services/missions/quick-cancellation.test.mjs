import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('QUICK cancellation database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [{ PrismaPg }, { PrismaClient }, { acceptQuickOffer }, { createQuickOffer }, { createPaymentAttempt }, { confirmPaymentAttempt }, { startMissionExecution }, { proposeMissionCompletion }, cancelService, readService, { sendTextMessage }, textService] = await Promise.all([
    import('@prisma/adapter-pg'), import('@prisma/client'), import('../quick-offers/accept-quick-offer.ts'), import('../quick-offers/create-quick-offer.ts'), import('../payments/create-payment-attempt.ts'), import('../payments/confirm-payment-attempt.ts'), import('./start-mission-execution.ts'), import('./propose-mission-completion.ts'), import('./cancel-quick-mission.ts'), import('./get-mission-refund-entitlement.ts'), import('../conversations/send-text-message.ts'), import('../conversations/send-text-message.ts'),
  ]);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const users = []; const connections = []; let sequence = 0;
  const customerActor = (u) => ({ userId: u.id, role: 'CUSTOMER', accountStatus: u.accountStatus });
  const relaisActor = (u) => ({ userId: u.id, role: 'RELAIS', accountStatus: u.accountStatus, relaisEligibility: 'APPROVED' });
  const adminActor = (u) => ({ userId: u.id, role: 'ADMIN', accountStatus: u.accountStatus });
  const expectCode = (promise, C, code) => assert.rejects(promise, (e) => e instanceof C && e.code === code);

  async function fixture() {
    const customer = await prisma.user.create({ data: { role: 'CUSTOMER', phoneNumber: `+226731${String(Date.now() + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), customerProfile: { create: {} } } }); users.push(customer.id);
    const relais = await prisma.user.create({ data: { role: 'RELAIS', phoneNumber: `+226732${String(Date.now() + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), relaisProfile: { create: { eligibility: 'APPROVED', availability: 'UNAVAILABLE' } } } }); users.push(relais.id);
    const connection = await prisma.connection.create({ data: { customerId: customer.id, requestKey: `3h-${Date.now()}-${sequence++}`, lifecycle: 'CONNECTED', connectedAt: new Date() } }); connections.push(connection.id);
    await prisma.connectionAssignment.create({ data: { connectionId: connection.id, relaisUserId: relais.id } }); await prisma.conversation.create({ data: { connectionId: connection.id } });
    const offer = await createQuickOffer({ actor: relaisActor(relais), connectionId: connection.id, amount: 2000, clientOfferId: `3h-offer-${sequence++}` }, prisma);
    const accepted = await acceptQuickOffer({ actor: customerActor(customer), quickOfferId: offer.offer.id }, prisma);
    return { customer, relais, connection, missionId: accepted.mission.id, obligationId: accepted.paymentObligation.id };
  }
  async function pay(f) {
    const attempt = await createPaymentAttempt({ actor: customerActor(f.customer), paymentObligationId: f.obligationId, method: 'MOBILE_MONEY', provider: 'MANUAL', clientAttemptId: `3h-payment-${sequence++}` }, prisma);
    await confirmPaymentAttempt({ paymentAttemptId: attempt.attempt.id, confirmation: { source: 'PROVIDER', provider: 'MANUAL', externalReference: `3h-tx-${sequence++}`, confirmedAt: new Date(), confirmedAmount: 2000, currency: 'XOF' } }, prisma);
  }
  async function cleanup() {
    if (connections.length) {
      await prisma.refundEntitlement.deleteMany({ where: { mission: { connectionId: { in: connections } } } });
      await prisma.missionCancellation.deleteMany({ where: { mission: { connectionId: { in: connections } } } });
      await prisma.completionAttempt.deleteMany({ where: { mission: { connectionId: { in: connections } } } });
      await prisma.missionUpdate.deleteMany({ where: { mission: { connectionId: { in: connections } } } });
      await prisma.paymentAttempt.deleteMany({ where: { paymentObligation: { mission: { connectionId: { in: connections } } } } });
      await prisma.paymentObligation.deleteMany({ where: { mission: { connectionId: { in: connections } } } });
      await prisma.missionAssignment.deleteMany({ where: { mission: { connectionId: { in: connections } } } });
      await prisma.mission.deleteMany({ where: { connectionId: { in: connections } } });
      await prisma.quickOffer.deleteMany({ where: { connectionId: { in: connections } } });
      await prisma.callAction.deleteMany({ where: { conversation: { connectionId: { in: connections } } } });
      await prisma.voiceMessageAsset.deleteMany({ where: { message: { conversation: { connectionId: { in: connections } } } } });
      await prisma.message.deleteMany({ where: { conversation: { connectionId: { in: connections } } } });
      await prisma.connectionAssignment.deleteMany({ where: { connectionId: { in: connections } } }); await prisma.conversation.deleteMany({ where: { connectionId: { in: connections } } }); await prisma.connection.deleteMany({ where: { id: { in: connections } } });
    }
    if (users.length) { await prisma.customerProfile.deleteMany({ where: { userId: { in: users } } }); await prisma.relaisProfile.deleteMany({ where: { userId: { in: users } } }); await prisma.user.deleteMany({ where: { id: { in: users } } }); }
    connections.length = 0; users.length = 0;
  }

  test('paid ACTIVE QUICK cancellation before execution creates immutable 100% entitlement', async () => {
    try { const f = await fixture(); await pay(f); const before = await prisma.mission.findUnique({ where: { id: f.missionId }, select: { executionStartedAt: true } }); const result = await cancelService.cancelQuickMission({ actor: customerActor(f.customer), missionId: f.missionId, reason: 'Je n’en ai plus besoin.' }, prisma); assert.equal(result.status, 'CANCELLED'); assert.equal(result.entitlement.originalAmount, 2000); assert.equal(result.entitlement.refundRateBasisPoints, 10000); assert.equal(result.entitlement.entitledAmount, 2000); assert.equal(result.entitlement.reason, 'BEFORE_EXECUTION_STARTED'); assert.equal(result.entitlement.policyVersion, 'QUICK_V1'); assert.equal(before.executionStartedAt, null); const mission = await prisma.mission.findUnique({ where: { id: f.missionId }, select: { lifecycle: true, cancelledAt: true, executionStartedAt: true, assignments: { where: { endedAt: null }, select: { id: true } } } }); assert.equal(mission.lifecycle, 'CANCELLED'); assert.ok(mission.cancelledAt); assert.equal(mission.executionStartedAt, null); assert.equal(mission.assignments.length, 0); } finally { await cleanup(); }
  });

  test('started QUICK cancellation preserves execution history and creates 50% entitlement', async () => {
    try { const f = await fixture(); await pay(f); await startMissionExecution({ actor: relaisActor(f.relais), missionId: f.missionId }, prisma); const result = await cancelService.cancelQuickMission({ actor: customerActor(f.customer), missionId: f.missionId }, prisma); assert.equal(result.entitlement.refundRateBasisPoints, 5000); assert.equal(result.entitlement.entitledAmount, 1000); assert.equal(result.entitlement.reason, 'AFTER_EXECUTION_STARTED'); const mission = await prisma.mission.findUnique({ where: { id: f.missionId }, select: { lifecycle: true, executionStartedAt: true, cancelledAt: true } }); assert.equal(mission.lifecycle, 'CANCELLED'); assert.ok(mission.executionStartedAt); assert.ok(mission.cancelledAt); const obligation = await prisma.paymentObligation.findUnique({ where: { id: f.obligationId }, select: { status: true, amount: true } }); const payment = await prisma.paymentAttempt.findFirst({ where: { paymentObligationId: f.obligationId }, select: { status: true } }); assert.equal(obligation.status, 'PAID'); assert.equal(obligation.amount, 2000); assert.equal(payment.status, 'SUCCEEDED'); } finally { await cleanup(); }
  });

  test('completion pending, completed, unpaid, and wrong actors cannot use cancellation', async () => {
    try { const f = await fixture(); await expectCode(cancelService.cancelQuickMission({ actor: customerActor(f.customer), missionId: f.missionId }, prisma), cancelService.CancelQuickMissionError, 'CANCELLATION_NOT_ALLOWED'); await pay(f); await startMissionExecution({ actor: relaisActor(f.relais), missionId: f.missionId }, prisma); const proposal = await proposeMissionCompletion({ actor: relaisActor(f.relais), missionId: f.missionId, summary: 'Terminé.', clientCompletionId: '3h-pending' }, prisma); await expectCode(cancelService.cancelQuickMission({ actor: customerActor(f.customer), missionId: f.missionId }, prisma), cancelService.CancelQuickMissionError, 'CANCELLATION_NOT_ALLOWED'); assert.equal(await prisma.refundEntitlement.count({ where: { missionId: f.missionId } }), 0); const other = await prisma.user.create({ data: { role: 'CUSTOMER', customerProfile: { create: {} } } }); users.push(other.id); await expectCode(cancelService.cancelQuickMission({ actor: customerActor(other), missionId: f.missionId }, prisma), cancelService.CancelQuickMissionError, 'UNAUTHORIZED'); assert.ok(proposal.attempt.id); } finally { await cleanup(); }
  });

  test('duplicate and concurrent cancellation are idempotent and expose the same entitlement', async () => {
    try { const f = await fixture(); await pay(f); const input = { actor: customerActor(f.customer), missionId: f.missionId, reason: 'Annulation.' }; const [a, b] = await Promise.all([cancelService.cancelQuickMission(input, prisma), cancelService.cancelQuickMission(input, prisma)]); assert.deepEqual([a.status, b.status].sort(), ['ALREADY_CANCELLED', 'CANCELLED']); assert.equal(a.cancellation.id, b.cancellation.id); assert.equal(a.entitlement.id, b.entitlement.id); assert.equal(await prisma.missionCancellation.count({ where: { missionId: f.missionId } }), 1); assert.equal(await prisma.refundEntitlement.count({ where: { missionId: f.missionId } }), 1); const retry = await cancelService.cancelQuickMission({ ...input, reason: 'Different retry text.' }, prisma); assert.equal(retry.status, 'ALREADY_CANCELLED'); assert.equal(retry.entitlement.entitledAmount, 2000); } finally { await cleanup(); }
  });

  test('completed QUICK Mission cannot be cancelled', async () => {
    try { const f = await fixture(); await pay(f); await startMissionExecution({ actor: relaisActor(f.relais), missionId: f.missionId }, prisma); const proposal = await proposeMissionCompletion({ actor: relaisActor(f.relais), missionId: f.missionId, summary: 'Terminé.', clientCompletionId: '3h-completed' }, prisma); const { confirmMissionCompletion } = await import('./confirm-mission-completion.ts'); await confirmMissionCompletion({ actor: customerActor(f.customer), completionAttemptId: proposal.attempt.id }, prisma); await expectCode(cancelService.cancelQuickMission({ actor: customerActor(f.customer), missionId: f.missionId }, prisma), cancelService.CancelQuickMissionError, 'CANCELLATION_NOT_ALLOWED'); assert.equal(await prisma.refundEntitlement.count({ where: { missionId: f.missionId } }), 0); } finally { await cleanup(); }
  });

  test('cancellation has no operational side effects and terminal Conversation writes are blocked', async () => {
    try { const f = await fixture(); await pay(f); const conversation = await prisma.conversation.findUnique({ where: { connectionId: f.connection.id } }); const result = await cancelService.cancelQuickMission({ actor: customerActor(f.customer), missionId: f.missionId }, prisma); await expectCode(sendTextMessage({ actor: customerActor(f.customer), conversationId: conversation.id, text: 'Après annulation.', clientMessageId: '3h-message' }, prisma), textService.SendTextMessageError, 'CONNECTION_NOT_CONNECTED'); assert.equal(await prisma.message.count({ where: { conversationId: conversation.id } }), 0); assert.equal(await prisma.missionUpdate.count({ where: { missionId: f.missionId } }), 0); assert.equal(await prisma.completionAttempt.count({ where: { missionId: f.missionId } }), 0); const read = await readService.getMissionRefundEntitlement({ actor: customerActor(f.customer), missionId: f.missionId }, prisma); assert.equal(read.id, result.entitlement.id); } finally { await cleanup(); }
  });

  test.after(async () => { await cleanup(); await prisma.$disconnect(); });
}
