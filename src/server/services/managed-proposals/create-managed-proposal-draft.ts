import { PrismaClient } from '@prisma/client';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import { serializableTransactionOptions } from '../../db/transaction-options.ts';
import { DEFAULT_MANAGED_PROPOSAL_CURRENCY, isRetryableProposalConflict, MAX_MANAGED_PROPOSAL_AMOUNT, MAX_MANAGED_PROPOSAL_DURATION_LENGTH, MAX_MANAGED_PROPOSAL_SUMMARY_LENGTH, MAX_MANAGED_PROPOSAL_TITLE_LENGTH, normalizeDuration, proposalSelect, toProposalSummary, validateClientProposalId, validateProposalText, validateServiceAmount, type ManagedProposalSummary } from './managed-proposal-workflow.ts';

export type CreateManagedProposalDraftInput = { actor: AuthorizationSubject; conversationId: string; title: string; summary: string; estimatedDurationText?: string | null; serviceAmount: number; clientProposalId: string };
export type CreateManagedProposalDraftResult = { status: 'CREATED' | 'EXISTING'; proposal: ManagedProposalSummary };
export type CreateManagedProposalDraftErrorCode = 'INVALID_CONVERSATION_ID' | 'INVALID_TITLE' | 'TITLE_TOO_LONG' | 'INVALID_SUMMARY' | 'SUMMARY_TOO_LONG' | 'INVALID_DURATION' | 'DURATION_TOO_LONG' | 'INVALID_SERVICE_AMOUNT' | 'SERVICE_AMOUNT_TOO_HIGH' | 'INVALID_CLIENT_PROPOSAL_ID' | 'UNAUTHORIZED' | 'CONVERSATION_NOT_FOUND' | 'CONNECTION_NOT_CONNECTED' | 'ACTIVE_DRAFT_EXISTS' | 'IDEMPOTENCY_CONFLICT' | 'PROPOSAL_CREATION_CONFLICT';
export class CreateManagedProposalDraftError extends Error { readonly code: CreateManagedProposalDraftErrorCode; constructor(code: CreateManagedProposalDraftErrorCode, message: string) { super(message); this.name = 'CreateManagedProposalDraftError'; this.code = code; } }

function mapValidation(error: unknown): never { const code = error instanceof Error ? error.message : 'INVALID_TITLE'; const messages: Record<string, string> = { INVALID_TITLE: 'A proposal title is required.', TITLE_TOO_LONG: `Title cannot exceed ${MAX_MANAGED_PROPOSAL_TITLE_LENGTH} characters.`, INVALID_SUMMARY: 'A proposal summary is required.', SUMMARY_TOO_LONG: `Summary cannot exceed ${MAX_MANAGED_PROPOSAL_SUMMARY_LENGTH} characters.`, INVALID_DURATION: 'Estimated duration must be text when provided.', DURATION_TOO_LONG: `Estimated duration cannot exceed ${MAX_MANAGED_PROPOSAL_DURATION_LENGTH} characters.`, INVALID_SERVICE_AMOUNT: 'Service amount must be a positive integer.', SERVICE_AMOUNT_TOO_HIGH: `Service amount cannot exceed ${MAX_MANAGED_PROPOSAL_AMOUNT} XOF.`, INVALID_CLIENT_PROPOSAL_ID: 'A valid client proposal id is required.' }; throw new CreateManagedProposalDraftError((code in messages ? code : 'INVALID_TITLE') as CreateManagedProposalDraftErrorCode, messages[code] ?? 'Proposal input is invalid.'); }

async function createOnce(input: CreateManagedProposalDraftInput, values: { title: string; summary: string; estimatedDurationText: string | null; serviceAmount: number; clientProposalId: string }, client: PrismaClient): Promise<CreateManagedProposalDraftResult> {
  return client.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<Array<{ conversationId: string; connectionId: string; customerUserId: string; lifecycle: string }>>`
      SELECT conversation."id" AS "conversationId", connection."id" AS "connectionId", connection."customerId" AS "customerUserId", connection."lifecycle"
      FROM "Conversation" conversation INNER JOIN "Connection" connection ON connection."id" = conversation."connectionId"
      WHERE conversation."id" = ${input.conversationId} FOR UPDATE OF conversation, connection`;
    const context = rows[0];
    if (!context) throw new CreateManagedProposalDraftError('CONVERSATION_NOT_FOUND', 'The Conversation was not found.');
    if (context.lifecycle !== 'CONNECTED') throw new CreateManagedProposalDraftError('CONNECTION_NOT_CONNECTED', 'Managed proposal drafts require a CONNECTED Connection.');
    const actor = await transaction.user.findUnique({ where: { id: input.actor.userId }, select: { role: true, accountStatus: true, relaisProfile: { select: { eligibility: true } } } });
    if (!actor || actor.role !== 'RELAIS' || actor.accountStatus !== 'ACTIVE' || actor.relaisProfile?.eligibility !== 'APPROVED') throw new CreateManagedProposalDraftError('UNAUTHORIZED', 'Only an active approved Relais may draft a proposal.');
    const assignment = await transaction.connectionAssignment.findFirst({ where: { connectionId: context.connectionId, relaisUserId: input.actor.userId, endedAt: null }, select: { id: true } });
    if (!assignment) throw new CreateManagedProposalDraftError('UNAUTHORIZED', 'Only the current assigned Relais may draft a proposal.');
    const existing = await transaction.managedProposal.findUnique({ where: { conversationId_relaisUserId_clientProposalId: { conversationId: context.conversationId, relaisUserId: input.actor.userId, clientProposalId: values.clientProposalId } }, select: proposalSelect });
    if (existing) {
      if (existing.title !== values.title || existing.summary !== values.summary || existing.estimatedDurationText !== values.estimatedDurationText || existing.serviceAmount !== values.serviceAmount) throw new CreateManagedProposalDraftError('IDEMPOTENCY_CONFLICT', 'The client proposal id was already used with different content.');
      return { status: 'EXISTING', proposal: toProposalSummary(existing) };
    }
    const activeDraft = await transaction.managedProposal.findFirst({ where: { conversationId: context.conversationId, status: 'DRAFT' }, select: { id: true } });
    if (activeDraft) throw new CreateManagedProposalDraftError('ACTIVE_DRAFT_EXISTS', 'An active draft already exists for this Conversation.');
    const latest = await transaction.managedProposal.aggregate({ where: { conversationId: context.conversationId }, _max: { version: true } });
    const proposal = await transaction.managedProposal.create({ data: { conversationId: context.conversationId, connectionId: context.connectionId, customerUserId: context.customerUserId, relaisUserId: input.actor.userId, status: 'DRAFT', title: values.title, summary: values.summary, estimatedDurationText: values.estimatedDurationText, serviceAmount: values.serviceAmount, currency: DEFAULT_MANAGED_PROPOSAL_CURRENCY, version: (latest._max.version ?? 0) + 1, clientProposalId: values.clientProposalId }, select: proposalSelect });
    return { status: 'CREATED', proposal: toProposalSummary(proposal) };
  }, serializableTransactionOptions());
}

export async function createManagedProposalDraft(input: CreateManagedProposalDraftInput, client: PrismaClient = prisma): Promise<CreateManagedProposalDraftResult> {
  if (typeof input.conversationId !== 'string' || !input.conversationId.trim()) throw new CreateManagedProposalDraftError('INVALID_CONVERSATION_ID', 'A Conversation id is required.');
  let values: { title: string; summary: string; estimatedDurationText: string | null; serviceAmount: number; clientProposalId: string };
  try { values = { title: validateProposalText(input.title, 'INVALID_TITLE', 'TITLE_TOO_LONG', MAX_MANAGED_PROPOSAL_TITLE_LENGTH), summary: validateProposalText(input.summary, 'INVALID_SUMMARY', 'SUMMARY_TOO_LONG', MAX_MANAGED_PROPOSAL_SUMMARY_LENGTH), estimatedDurationText: normalizeDuration(input.estimatedDurationText), serviceAmount: validateServiceAmount(input.serviceAmount), clientProposalId: validateClientProposalId(input.clientProposalId) }; } catch (error) { mapValidation(error); }
  for (let attempt = 0; attempt < 3; attempt += 1) { try { return await createOnce(input, values!, client); } catch (error) { if (isRetryableProposalConflict(error) && attempt < 2) continue; if (isRetryableProposalConflict(error)) throw new CreateManagedProposalDraftError('PROPOSAL_CREATION_CONFLICT', 'Proposal draft could not be created safely.'); throw error; } }
  throw new CreateManagedProposalDraftError('PROPOSAL_CREATION_CONFLICT', 'Proposal draft could not be created safely.');
}
