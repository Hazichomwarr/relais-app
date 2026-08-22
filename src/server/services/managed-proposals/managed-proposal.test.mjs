import 'dotenv/config';
import assert from 'node:assert/strict';
import test from 'node:test';

if (!process.env.DATABASE_URL) {
  test('Managed Proposal drafting database matrix', { skip: 'DATABASE_URL is not configured' }, () => {});
} else {
  const [{ PrismaPg }, { PrismaClient }, createService, updateService, readService] = await Promise.all([
    import('@prisma/adapter-pg'),
    import('@prisma/client'),
    import('./create-managed-proposal-draft.ts'),
    import('./update-managed-proposal-draft.ts'),
    import('./get-managed-proposal.ts'),
  ]);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const userIds = [];
  const connectionIds = [];
  let sequence = 0;

  const customer = async (accountStatus = 'ACTIVE') => {
    const user = await prisma.user.create({ data: { role: 'CUSTOMER', accountStatus, customerProfile: { create: {} } } });
    userIds.push(user.id);
    return user;
  };
  const relais = async ({ accountStatus = 'ACTIVE', eligibility = 'APPROVED', availability = 'UNAVAILABLE' } = {}) => {
    const user = await prisma.user.create({ data: { role: 'RELAIS', accountStatus, relaisProfile: { create: { eligibility, availability } } } });
    userIds.push(user.id);
    return user;
  };
  const fixture = async ({ lifecycle = 'CONNECTED', relaisOptions = {} } = {}) => {
    const customerUser = await customer();
    const relaisUser = await relais(relaisOptions);
    const connection = await prisma.connection.create({ data: { customerId: customerUser.id, requestKey: `managed-${Date.now()}-${sequence += 1}`, lifecycle, connectedAt: lifecycle === 'CONNECTED' ? new Date() : null } });
    connectionIds.push(connection.id);
    const conversation = await prisma.conversation.create({ data: { connectionId: connection.id } });
    const assignment = await prisma.connectionAssignment.create({ data: { connectionId: connection.id, relaisUserId: relaisUser.id } });
    return { customer: customerUser, relais: relaisUser, connection, conversation, assignment };
  };
  const actor = (user, role = user.role, accountStatus = user.accountStatus, relaisEligibility = 'APPROVED') => ({ userId: user.id, role, accountStatus, relaisEligibility });
  const input = (item, overrides = {}) => ({ actor: actor(item.relais), conversationId: item.conversation.id, title: 'Aide administrative', summary: 'Accompagnement personnalisé en français et Mooré.', estimatedDurationText: '2 heures', serviceAmount: 5000, clientProposalId: `client-${Date.now()}-${sequence += 1}`, ...overrides });
  const expectCode = async (promise, errorClass, code) => assert.rejects(promise, (error) => { assert.ok(error instanceof errorClass); assert.equal(error.code, code); return true; });
  const cleanup = async () => {
    if (connectionIds.length) {
      await prisma.managedProposal.deleteMany({ where: { connectionId: { in: connectionIds } } });
      await prisma.connectionAssignment.deleteMany({ where: { connectionId: { in: connectionIds } } });
      await prisma.conversation.deleteMany({ where: { connectionId: { in: connectionIds } } });
      await prisma.connection.deleteMany({ where: { id: { in: connectionIds } } });
    }
    if (userIds.length) {
      await prisma.customerProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.relaisProfile.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    userIds.length = 0;
    connectionIds.length = 0;
  };

  test('creates a historical draft with server-derived identity and no workflow side effects', async () => {
    try {
      const item = await fixture();
      const before = { missions: await prisma.mission.count(), payments: await prisma.paymentObligation.count(), messages: await prisma.message.count() };
      const result = await createService.createManagedProposalDraft(input(item), prisma);
      assert.equal(result.status, 'CREATED');
      assert.equal(result.proposal.status, 'DRAFT');
      assert.equal(result.proposal.version, 1);
      assert.equal(result.proposal.currency, 'XOF');
      assert.equal(result.proposal.customerUserId, item.customer.id);
      assert.equal(result.proposal.relaisUserId, item.relais.id);
      assert.deepEqual({ missions: await prisma.mission.count(), payments: await prisma.paymentObligation.count(), messages: await prisma.message.count() }, before);
    } finally { await cleanup(); }
  });

  test('allows the assigned Relais while unavailable and rejects role, identity, and eligibility violations', async () => {
    try {
      const item = await fixture({ relaisOptions: { availability: 'UNAVAILABLE' } });
      const admin = await prisma.user.create({ data: { role: 'ADMIN' } }); userIds.push(admin.id);
      const other = await relais();
      assert.equal((await createService.createManagedProposalDraft(input(item), prisma)).status, 'CREATED');
      await expectCode(createService.createManagedProposalDraft({ ...input(item), actor: actor(admin, 'ADMIN'), clientProposalId: 'admin' }, prisma), createService.CreateManagedProposalDraftError, 'UNAUTHORIZED');
      await prisma.connectionAssignment.update({ where: { id: item.assignment.id }, data: { endedAt: new Date() } });
      await expectCode(createService.createManagedProposalDraft({ ...input(item), actor: actor(item.relais), clientProposalId: 'former' }, prisma), createService.CreateManagedProposalDraftError, 'UNAUTHORIZED');
      await prisma.connectionAssignment.create({ data: { connectionId: item.connection.id, relaisUserId: other.id } });
      await expectCode(createService.createManagedProposalDraft({ ...input(item), actor: actor(other), clientProposalId: 'other' }, prisma), createService.CreateManagedProposalDraftError, 'ACTIVE_DRAFT_EXISTS');
    } finally { await cleanup(); }
  });

  test('requires CONNECTED state and validates bounded proposal fields', async () => {
    try {
      const matching = await fixture({ lifecycle: 'MATCHING' });
      await expectCode(createService.createManagedProposalDraft(input(matching), prisma), createService.CreateManagedProposalDraftError, 'CONNECTION_NOT_CONNECTED');
      const ended = await fixture({ lifecycle: 'ENDED' });
      await expectCode(createService.createManagedProposalDraft(input(ended), prisma), createService.CreateManagedProposalDraftError, 'CONNECTION_NOT_CONNECTED');
      const valid = await fixture();
      for (const [field, value, code] of [['title', '', 'INVALID_TITLE'], ['summary', '', 'INVALID_SUMMARY'], ['estimatedDurationText', 123, 'INVALID_DURATION'], ['serviceAmount', 0, 'INVALID_SERVICE_AMOUNT'], ['serviceAmount', 1.5, 'INVALID_SERVICE_AMOUNT'], ['serviceAmount', 10000001, 'SERVICE_AMOUNT_TOO_HIGH'], ['clientProposalId', '', 'INVALID_CLIENT_PROPOSAL_ID']]) {
        await expectCode(createService.createManagedProposalDraft(input(valid, { [field]: value, clientProposalId: field === 'clientProposalId' ? value : `validation-${field}-${sequence += 1}` }), prisma), createService.CreateManagedProposalDraftError, code);
      }
    } finally { await cleanup(); }
  });

  test('is idempotent, detects conflicts, and prevents a second active draft', async () => {
    try {
      const item = await fixture();
      const firstInput = input(item, { clientProposalId: 'stable-proposal' });
      const first = await createService.createManagedProposalDraft(firstInput, prisma);
      const existing = await createService.createManagedProposalDraft(firstInput, prisma);
      assert.equal(existing.status, 'EXISTING'); assert.equal(existing.proposal.id, first.proposal.id);
      await expectCode(createService.createManagedProposalDraft({ ...firstInput, serviceAmount: 6000 }, prisma), createService.CreateManagedProposalDraftError, 'IDEMPOTENCY_CONFLICT');
      await expectCode(createService.createManagedProposalDraft({ ...firstInput, clientProposalId: 'another-key' }, prisma), createService.CreateManagedProposalDraftError, 'ACTIVE_DRAFT_EXISTS');
      assert.equal(await prisma.managedProposal.count({ where: { conversationId: item.conversation.id, status: 'DRAFT' } }), 1);
    } finally { await cleanup(); }
  });

  test('concurrent creation leaves exactly one active draft', async () => {
    try {
      const item = await fixture();
      const results = await Promise.allSettled([createService.createManagedProposalDraft(input(item, { clientProposalId: 'concurrent-a' }), prisma), createService.createManagedProposalDraft(input(item, { clientProposalId: 'concurrent-b' }), prisma)]);
      assert.equal(await prisma.managedProposal.count({ where: { conversationId: item.conversation.id, status: 'DRAFT' } }), 1);
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      assert.ok(results.some((result) => result.status === 'rejected' && result.reason.code === 'ACTIVE_DRAFT_EXISTS'));
    } finally { await cleanup(); }
  });

  test('updates a draft in place, while non-drafts and non-current actors cannot edit', async () => {
    try {
      const item = await fixture();
      const created = await createService.createManagedProposalDraft(input(item, { clientProposalId: 'edit-me' }), prisma);
      const updated = await updateService.updateManagedProposalDraft({ actor: actor(item.relais), proposalId: created.proposal.id, title: 'Updated title', summary: 'Updated summary', serviceAmount: 7000 }, prisma);
      assert.equal(updated.id, created.proposal.id); assert.equal(updated.version, 1); assert.equal(updated.title, 'Updated title'); assert.equal(updated.estimatedDurationText, null);
      const admin = await prisma.user.create({ data: { role: 'ADMIN' } }); userIds.push(admin.id);
      await expectCode(updateService.updateManagedProposalDraft({ actor: actor(admin, 'ADMIN'), proposalId: created.proposal.id, title: 'Nope', summary: 'Nope', serviceAmount: 1 }, prisma), updateService.UpdateManagedProposalDraftError, 'UNAUTHORIZED');
      await prisma.managedProposal.update({ where: { id: created.proposal.id }, data: { status: 'SENT' } });
      await expectCode(updateService.updateManagedProposalDraft({ actor: actor(item.relais), proposalId: created.proposal.id, title: 'Nope', summary: 'Nope', serviceAmount: 1 }, prisma), updateService.UpdateManagedProposalDraftError, 'PROPOSAL_NOT_EDITABLE');
    } finally { await cleanup(); }
  });

  test('draft visibility is limited to the owning current Relais and active Admin', async () => {
    try {
      const item = await fixture();
      const created = await createService.createManagedProposalDraft(input(item), prisma);
      const admin = await prisma.user.create({ data: { role: 'ADMIN' } }); userIds.push(admin.id);
      await expectCode(readService.getManagedProposal({ actor: actor(item.customer), proposalId: created.proposal.id }, prisma), readService.GetManagedProposalError, 'PROPOSAL_NOT_VISIBLE');
      assert.equal((await readService.getManagedProposal({ actor: actor(item.relais), proposalId: created.proposal.id }, prisma)).id, created.proposal.id);
      assert.equal((await readService.getManagedProposal({ actor: actor(admin, 'ADMIN'), proposalId: created.proposal.id }, prisma)).id, created.proposal.id);
      await prisma.connectionAssignment.update({ where: { id: item.assignment.id }, data: { endedAt: new Date() } });
      await expectCode(readService.getManagedProposal({ actor: actor(item.relais), proposalId: created.proposal.id }, prisma), readService.GetManagedProposalError, 'PROPOSAL_NOT_VISIBLE');
    } finally { await cleanup(); }
  });

  test('restrictive history relations prevent deleting a referenced customer or Relais', async () => {
    try {
      const item = await fixture();
      await createService.createManagedProposalDraft(input(item), prisma);
      await assert.rejects(prisma.user.delete({ where: { id: item.customer.id } }));
      await assert.rejects(prisma.user.delete({ where: { id: item.relais.id } }));
    } finally { await cleanup(); }
  });

  test.after(async () => { await cleanup(); await prisma.$disconnect(); });
}
