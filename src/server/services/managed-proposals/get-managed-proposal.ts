import type { PrismaClient } from '@prisma/client';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import { proposalSelect, toProposalSummary, type ManagedProposalSummary } from './managed-proposal-workflow.ts';

export type GetManagedProposalInput = { actor: AuthorizationSubject; proposalId: string };
export type GetManagedProposalErrorCode = 'INVALID_PROPOSAL_ID' | 'PROPOSAL_NOT_FOUND' | 'PROPOSAL_NOT_VISIBLE';

export class GetManagedProposalError extends Error {
  readonly code: GetManagedProposalErrorCode;
  constructor(code: GetManagedProposalErrorCode, message: string) {
    super(message);
    this.name = 'GetManagedProposalError';
    this.code = code;
  }
}

export async function getManagedProposal(
  input: GetManagedProposalInput,
  client: PrismaClient = prisma,
): Promise<ManagedProposalSummary> {
  if (typeof input.proposalId !== 'string' || !input.proposalId.trim()) {
    throw new GetManagedProposalError('INVALID_PROPOSAL_ID', 'A proposal id is required.');
  }
  const proposal = await client.managedProposal.findUnique({
    where: { id: input.proposalId },
    select: { ...proposalSelect, connection: { select: { lifecycle: true } } },
  });
  if (!proposal) throw new GetManagedProposalError('PROPOSAL_NOT_FOUND', 'The proposal was not found.');

  const actor = await client.user.findUnique({
    where: { id: input.actor.userId },
    select: { role: true, accountStatus: true, relaisProfile: { select: { eligibility: true } } },
  });
  const active = actor?.accountStatus === 'ACTIVE';
  const isAdmin = active && actor?.role === 'ADMIN';
  const isRelais = active && actor?.role === 'RELAIS' && actor.relaisProfile?.eligibility === 'APPROVED' && proposal.relaisUserId === input.actor.userId;
  const assignment = isRelais
    ? await client.connectionAssignment.findFirst({ where: { connectionId: proposal.connectionId, relaisUserId: input.actor.userId, endedAt: null }, select: { id: true } })
    : null;
  const isCurrentRelais = Boolean(assignment);
  const isCustomer = active && actor?.role === 'CUSTOMER' && proposal.customerUserId === input.actor.userId;

  if (!isAdmin && !isCurrentRelais && !(isCustomer && proposal.status !== 'DRAFT')) {
    throw new GetManagedProposalError('PROPOSAL_NOT_VISIBLE', 'This proposal is not visible to the actor.');
  }
  return toProposalSummary(proposal);
}
