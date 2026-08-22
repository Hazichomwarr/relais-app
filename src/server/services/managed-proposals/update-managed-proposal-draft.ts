import type { PrismaClient } from '@prisma/client';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import { serializableTransactionOptions } from '../../db/transaction-options.ts';
import {
  isRetryableProposalConflict,
  MAX_MANAGED_PROPOSAL_AMOUNT,
  MAX_MANAGED_PROPOSAL_DURATION_LENGTH,
  MAX_MANAGED_PROPOSAL_SUMMARY_LENGTH,
  MAX_MANAGED_PROPOSAL_TITLE_LENGTH,
  normalizeDuration,
  proposalSelect,
  toProposalSummary,
  validateProposalText,
  validateServiceAmount,
  type ManagedProposalSummary,
} from './managed-proposal-workflow.ts';

export type UpdateManagedProposalDraftInput = {
  actor: AuthorizationSubject;
  proposalId: string;
  title: string;
  summary: string;
  estimatedDurationText?: string | null;
  serviceAmount: number;
};

export type UpdateManagedProposalDraftErrorCode =
  | 'INVALID_PROPOSAL_ID'
  | 'INVALID_TITLE'
  | 'TITLE_TOO_LONG'
  | 'INVALID_SUMMARY'
  | 'SUMMARY_TOO_LONG'
  | 'INVALID_DURATION'
  | 'DURATION_TOO_LONG'
  | 'INVALID_SERVICE_AMOUNT'
  | 'SERVICE_AMOUNT_TOO_HIGH'
  | 'PROPOSAL_NOT_FOUND'
  | 'PROPOSAL_NOT_EDITABLE'
  | 'CONNECTION_NOT_CONNECTED'
  | 'UNAUTHORIZED'
  | 'PROPOSAL_UPDATE_CONFLICT';

export class UpdateManagedProposalDraftError extends Error {
  readonly code: UpdateManagedProposalDraftErrorCode;

  constructor(code: UpdateManagedProposalDraftErrorCode, message: string) {
    super(message);
    this.name = 'UpdateManagedProposalDraftError';
    this.code = code;
  }
}

function mapValidation(error: unknown): never {
  const code = error instanceof Error ? error.message : 'INVALID_TITLE';
  const messages: Record<string, string> = {
    INVALID_TITLE: 'A proposal title is required.',
    TITLE_TOO_LONG: `Title cannot exceed ${MAX_MANAGED_PROPOSAL_TITLE_LENGTH} characters.`,
    INVALID_SUMMARY: 'A proposal summary is required.',
    SUMMARY_TOO_LONG: `Summary cannot exceed ${MAX_MANAGED_PROPOSAL_SUMMARY_LENGTH} characters.`,
    INVALID_DURATION: 'Estimated duration must be text when provided.',
    DURATION_TOO_LONG: `Estimated duration cannot exceed ${MAX_MANAGED_PROPOSAL_DURATION_LENGTH} characters.`,
    INVALID_SERVICE_AMOUNT: 'Service amount must be a positive integer.',
    SERVICE_AMOUNT_TOO_HIGH: `Service amount cannot exceed ${MAX_MANAGED_PROPOSAL_AMOUNT} XOF.`,
  };
  throw new UpdateManagedProposalDraftError(
    (code in messages ? code : 'INVALID_TITLE') as UpdateManagedProposalDraftErrorCode,
    messages[code] ?? 'Proposal input is invalid.',
  );
}

export async function updateManagedProposalDraft(
  input: UpdateManagedProposalDraftInput,
  client: PrismaClient = prisma,
): Promise<ManagedProposalSummary> {
  if (typeof input.proposalId !== 'string' || !input.proposalId.trim()) {
    throw new UpdateManagedProposalDraftError('INVALID_PROPOSAL_ID', 'A proposal id is required.');
  }

  let values: { title: string; summary: string; estimatedDurationText: string | null; serviceAmount: number };
  try {
    values = {
      title: validateProposalText(input.title, 'INVALID_TITLE', 'TITLE_TOO_LONG', MAX_MANAGED_PROPOSAL_TITLE_LENGTH),
      summary: validateProposalText(input.summary, 'INVALID_SUMMARY', 'SUMMARY_TOO_LONG', MAX_MANAGED_PROPOSAL_SUMMARY_LENGTH),
      estimatedDurationText: normalizeDuration(input.estimatedDurationText),
      serviceAmount: validateServiceAmount(input.serviceAmount),
    };
  } catch (error) {
    mapValidation(error);
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await client.$transaction(async (transaction) => {
        const locked = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "ManagedProposal" WHERE "id" = ${input.proposalId} FOR UPDATE
        `;
        if (!locked[0]) throw new UpdateManagedProposalDraftError('PROPOSAL_NOT_FOUND', 'The proposal was not found.');

        const proposal = await transaction.managedProposal.findUnique({
          where: { id: input.proposalId },
          select: { ...proposalSelect, connection: { select: { lifecycle: true } } },
        });
        if (!proposal) throw new UpdateManagedProposalDraftError('PROPOSAL_NOT_FOUND', 'The proposal was not found.');
        if (proposal.status !== 'DRAFT') throw new UpdateManagedProposalDraftError('PROPOSAL_NOT_EDITABLE', 'Only draft proposals may be edited.');
        if (proposal.connection.lifecycle !== 'CONNECTED') throw new UpdateManagedProposalDraftError('CONNECTION_NOT_CONNECTED', 'Managed proposal drafts require a CONNECTED Connection.');

        const actor = await transaction.user.findUnique({
          where: { id: input.actor.userId },
          select: { role: true, accountStatus: true, relaisProfile: { select: { eligibility: true } } },
        });
        if (!actor || actor.role !== 'RELAIS' || actor.accountStatus !== 'ACTIVE' || actor.relaisProfile?.eligibility !== 'APPROVED' || proposal.relaisUserId !== input.actor.userId) {
          throw new UpdateManagedProposalDraftError('UNAUTHORIZED', 'Only the current assigned Relais may edit this proposal.');
        }
        const assignment = await transaction.connectionAssignment.findFirst({
          where: { connectionId: proposal.connectionId, relaisUserId: input.actor.userId, endedAt: null },
          select: { id: true },
        });
        if (!assignment) throw new UpdateManagedProposalDraftError('UNAUTHORIZED', 'Only the current assigned Relais may edit this proposal.');

        const updated = await transaction.managedProposal.update({
          where: { id: input.proposalId },
          data: values,
          select: proposalSelect,
        });
        return toProposalSummary(updated);
      }, serializableTransactionOptions());
    } catch (error) {
      if (isRetryableProposalConflict(error) && attempt < 2) continue;
      if (isRetryableProposalConflict(error)) throw new UpdateManagedProposalDraftError('PROPOSAL_UPDATE_CONFLICT', 'Proposal draft could not be updated safely.');
      throw error;
    }
  }
  throw new UpdateManagedProposalDraftError('PROPOSAL_UPDATE_CONFLICT', 'Proposal draft could not be updated safely.');
}
