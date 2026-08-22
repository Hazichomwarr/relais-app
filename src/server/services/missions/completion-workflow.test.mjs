import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('Mission completion workflow database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [{ PrismaPg }, { PrismaClient }, { acceptQuickOffer }, { createQuickOffer }, { createPaymentAttempt }, { confirmPaymentAttempt }, { startMissionExecution }, { proposeMissionCompletion }, proposeService, confirmService, disputeService, listService, { sendTextMessage }, textService] = await Promise.all([
    import('@prisma/adapter-pg'), import('@prisma/client'), import('../quick-offers/accept-quick-offer.ts'), import('../quick-offers/create-quick-offer.ts'), import('../payments/create-payment-attempt.ts'), import('../payments/confirm-payment-attempt.ts'), import('./start-mission-execution.ts'), import('./propose-mission-completion.ts'), import('./propose-mission-completion.ts'), import('./confirm-mission-completion.ts'), import('./report-mission-completion-problem.ts'), import('./list-mission-completion-attempts.ts'), import('../conversations/send-text-message.ts'), import('../conversations/send-text-message.ts'),
  ]);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const users = []; const connections = []; let sequence = 0;
  const customerActor = (u) => ({ userId: u.id, role: 'CUSTOMER', accountStatus: u.accountStatus });
  const relaisActor = (u, eligibility = 'APPROVED') => ({ userId: u.id, role: 'RELAIS', accountStatus: u.accountStatus, relaisEligibility: eligibility });
  const adminActor = (u) => ({ userId: u.id, role: 'ADMIN', accountStatus: u.accountStatus });
  const expectCode = (promise, C, code) => assert.rejects(promise, (e) => e instanceof C && e.code === code);
  async function fixture() {
    const customer = await prisma.user.create({ data: { role: 'CUSTOMER', phoneNumber: `+226721${String(Date.now() + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), customerProfile: { create: {} } } }); users.push(customer.id);
    const relais = await prisma.user.create({ data: { role: 'RELAIS', phoneNumber: `+226722${String(Date.now() + sequence++).slice(-6)}`, phoneVerifiedAt: new Date(), relaisProfile: { create: { eligibility: 'APPROVED', availability: 'UNAVAILABLE' } } } }); users.push(relais.id);
    const connection = await prisma.connection.create({ data: { customerId: customer.id, requestKey: `3g-${Date.now()}-${sequence++}`, lifecycle: 'CONNECTED', connectedAt: new Date() } }); connections.push(connection.id);
    await prisma.connectionAssignment.create({ data: { connectionId: connection.id, relaisUserId: relais.id } });
    await prisma.conversation.create({ data: { connectionId: connection.id } });
    const offer = await createQuickOffer({ actor: relaisActor(relais), connectionId: connection.id, amount: 2500, clientOfferId: `3g-offer-${sequence++}` }, prisma);
    const accepted = await acceptQuickOffer({ actor: customerActor(customer), quickOfferId: offer.offer.id }, prisma);
    return { customer, relais, connection, missionId: accepted.mission.id, obligationId: accepted.paymentObligation.id };
  }
  async function start(f) {
    const payment = await createPaymentAttempt({ actor: customerActor(f.customer), paymentObligationId: f.obligationId, method: 'MOBILE_MONEY', provider: 'MANUAL', clientAttemptId: `3g-payment-${sequence++}` }, prisma);
    await confirmPaymentAttempt({ paymentAttemptId: payment.attempt.id, confirmation: { source: 'PROVIDER', provider: 'MANUAL', externalReference: `3g-tx-${sequence++}`, confirmedAt: new Date(), confirmedAmount: 2500, currency: 'XOF' } }, prisma);
    await startMissionExecution({ actor: relaisActor(f.relais), missionId: f.missionId }, prisma);
  }
  async function cleanup() {
    if (connections.length) {
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
      await prisma.connectionAssignment.deleteMany({ where: { connectionId: { in: connections } } });
      await prisma.conversation.deleteMany({ where: { connectionId: { in: connections } } });
      await prisma.connection.deleteMany({ where: { id: { in: connections } } });
    }
    if (users.length) { await prisma.customerProfile.deleteMany({ where: { userId: { in: users } } }); await prisma.relaisProfile.deleteMany({ where: { userId: { in: users } } }); await prisma.user.deleteMany({ where: { id: { in: users } } }); }
    connections.length = 0; users.length = 0;
  }

  test('started QUICK Mission can be proposed, confirmed, and retains authoritative timestamps', async () => {
    try {
      const f = await fixture(); await start(f);
      const before = await prisma.mission.findUnique({ where: { id: f.missionId }, select: { executionStartedAt: true, completedAt: true } });
      const proposal = await proposeMissionCompletion({ actor: relaisActor(f.relais), missionId: f.missionId, summary: 'Service effectué à Ouagadougou.', clientCompletionId: 'completion-1' }, prisma);
      assert.equal(proposal.status, 'CREATED'); assert.equal(proposal.attempt.status, 'PENDING');
      const pending = await prisma.mission.findUnique({ where: { id: f.missionId }, select: { lifecycle: true, executionStartedAt: true, completedAt: true } });
      assert.equal(pending.lifecycle, 'COMPLETION_PENDING'); assert.deepEqual(pending.executionStartedAt, before.executionStartedAt); assert.equal(pending.completedAt, null);
      const response = await confirmService.confirmMissionCompletion({ actor: customerActor(f.customer), completionAttemptId: proposal.attempt.id }, prisma);
      assert.equal(response.status, 'CONFIRMED'); assert.equal(response.attempt.status, 'CONFIRMED'); assert.equal(response.attempt.responseByUserId, f.customer.id);
      const completed = await prisma.mission.findUnique({ where: { id: f.missionId }, select: { lifecycle: true, completedAt: true, executionStartedAt: true, assignments: { where: { endedAt: null }, select: { id: true } } } });
      assert.equal(completed.lifecycle, 'COMPLETED'); assert.ok(completed.completedAt); assert.deepEqual(completed.executionStartedAt, before.executionStartedAt); assert.equal(completed.assignments.length, 0);
      assert.equal((await confirmService.confirmMissionCompletion({ actor: customerActor(f.customer), completionAttemptId: proposal.attempt.id }, prisma)).status, 'EXISTING');
    } finally { await cleanup(); }
  });

  test('Customer can dispute, resume execution, and create a later attempt', async () => {
    try {
      const f = await fixture(); await start(f);
      const first = await proposeMissionCompletion({ actor: relaisActor(f.relais), missionId: f.missionId, summary: 'Première proposition.', clientCompletionId: 'completion-dispute-1' }, prisma);
      const disputed = await disputeService.reportMissionCompletionProblem({ actor: customerActor(f.customer), completionAttemptId: first.attempt.id, note: 'Le client signale un problème.' }, prisma);
      assert.equal(disputed.status, 'DISPUTED');
      const resumed = await prisma.mission.findUnique({ where: { id: f.missionId }, select: { lifecycle: true, executionStartedAt: true, completedAt: true, assignments: { where: { endedAt: null }, select: { relaisUserId: true } } } });
      assert.equal(resumed.lifecycle, 'ACTIVE'); assert.ok(resumed.executionStartedAt); assert.equal(resumed.completedAt, null); assert.deepEqual(resumed.assignments.map((a) => a.relaisUserId), [f.relais.id]);
      const second = await proposeMissionCompletion({ actor: relaisActor(f.relais), missionId: f.missionId, summary: 'Nouvelle proposition après résolution.', clientCompletionId: 'completion-dispute-2' }, prisma);
      assert.equal(second.attempt.status, 'PENDING'); assert.equal((await listService.listMissionCompletionAttempts({ actor: customerActor(f.customer), missionId: f.missionId }, prisma)).attempts.length, 2);
      await confirmService.confirmMissionCompletion({ actor: customerActor(f.customer), completionAttemptId: second.attempt.id }, prisma);
      assert.equal((await prisma.completionAttempt.findUnique({ where: { id: first.attempt.id }, select: { status: true } })).status, 'DISPUTED');
    } finally { await cleanup(); }
  });

  test('proposal authorization, validation, pending uniqueness, and idempotency are enforced', async () => {
    try {
      const f = await fixture();
      await expectCode(proposeMissionCompletion({ actor: customerActor(f.customer), missionId: f.missionId, summary: 'x', clientCompletionId: 'x' }, prisma), proposeService.ProposeMissionCompletionError, 'UNAUTHORIZED');
      await expectCode(proposeMissionCompletion({ actor: relaisActor(f.relais), missionId: f.missionId, summary: 'x', clientCompletionId: 'x' }, prisma), proposeService.ProposeMissionCompletionError, 'INVALID_MISSION_STATE');
      await start(f);
      await expectCode(proposeMissionCompletion({ actor: relaisActor(f.relais), missionId: f.missionId, summary: ' ', clientCompletionId: 'x' }, prisma), proposeService.ProposeMissionCompletionError, 'INVALID_SUMMARY');
      const input = { actor: relaisActor(f.relais), missionId: f.missionId, summary: 'Fait.', clientCompletionId: 'same' };
      const first = await proposeMissionCompletion(input, prisma); const existing = await proposeMissionCompletion(input, prisma); assert.equal(existing.status, 'EXISTING'); assert.equal(existing.attempt.id, first.attempt.id);
      await expectCode(proposeMissionCompletion({ ...input, summary: 'Autre.' }, prisma), proposeService.ProposeMissionCompletionError, 'IDEMPOTENCY_CONFLICT');
      await expectCode(proposeMissionCompletion({ ...input, clientCompletionId: 'other' }, prisma), proposeService.ProposeMissionCompletionError, 'COMPLETION_ALREADY_PENDING');
      assert.equal(await prisma.completionAttempt.count({ where: { missionId: f.missionId, status: 'PENDING' } }), 1);
    } finally { await cleanup(); }
  });

  test('completion-pending Conversation remains usable, but completed Mission blocks new writes', async () => {
    try {
      const f = await fixture(); await start(f);
      const proposal = await proposeMissionCompletion({ actor: relaisActor(f.relais), missionId: f.missionId, summary: 'À confirmer.', clientCompletionId: 'conversation' }, prisma);
      const conversation = await prisma.conversation.findUnique({ where: { connectionId: f.connection.id } });
      const message = await sendTextMessage({ actor: customerActor(f.customer), conversationId: conversation.id, text: 'Je vérifie.', clientMessageId: 'pending-message' }, prisma);
      assert.equal(message.status, 'CREATED');
      await confirmService.confirmMissionCompletion({ actor: customerActor(f.customer), completionAttemptId: proposal.attempt.id }, prisma);
      await expectCode(sendTextMessage({ actor: customerActor(f.customer), conversationId: conversation.id, text: 'Après.', clientMessageId: 'completed-message' }, prisma), textService.SendTextMessageError, 'CONNECTION_NOT_CONNECTED');
    } finally { await cleanup(); }
  });

  test.after(async () => { await cleanup(); await prisma.$disconnect(); });
}
