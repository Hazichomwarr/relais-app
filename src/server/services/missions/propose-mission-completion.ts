import { PrismaClient } from '@prisma/client';
import { prisma } from '../../db/client.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import {
  assertRelaisActor, isRetryableCompletionConflict, MAX_COMPLETION_ID_LENGTH, MAX_COMPLETION_SUMMARY_LENGTH,
  readCurrentActor, toAttemptSummary, validateCompletionId, validateSummary, type CompletionAttemptSummary,
} from './completion-workflow.ts';

export type ProposeMissionCompletionInput = { actor: AuthorizationSubject; missionId: string; summary: string; clientCompletionId: string };
export type ProposeMissionCompletionResult = { status: 'CREATED' | 'EXISTING'; attempt: CompletionAttemptSummary; mission: { id: string; lifecycle: 'COMPLETION_PENDING'; executionStartedAt: Date } };
export type ProposeMissionCompletionErrorCode = 'INVALID_MISSION_ID' | 'INVALID_SUMMARY' | 'SUMMARY_TOO_LONG' | 'INVALID_CLIENT_COMPLETION_ID' | 'MISSION_NOT_FOUND' | 'INVALID_MISSION_STATE' | 'UNAUTHORIZED' | 'COMPLETION_ALREADY_PENDING' | 'IDEMPOTENCY_CONFLICT';
export class ProposeMissionCompletionError extends Error { readonly code: ProposeMissionCompletionErrorCode; constructor(code: ProposeMissionCompletionErrorCode, message: string) { super(message); this.name = 'ProposeMissionCompletionError'; this.code = code; } }

function mapValidation(error: unknown): never {
  const code = error instanceof Error ? error.message : '';
  const messages: Record<string, string> = { INVALID_SUMMARY: 'A completion summary is required.', SUMMARY_TOO_LONG: `Completion summary cannot exceed ${MAX_COMPLETION_SUMMARY_LENGTH} characters.`, INVALID_CLIENT_COMPLETION_ID: `Client completion id must be between 1 and ${MAX_COMPLETION_ID_LENGTH} characters.` };
  throw new ProposeMissionCompletionError((code in messages ? code : 'INVALID_SUMMARY') as ProposeMissionCompletionErrorCode, messages[code] ?? 'Completion input is invalid.');
}

export async function proposeMissionCompletion(input: ProposeMissionCompletionInput, client: PrismaClient = prisma): Promise<ProposeMissionCompletionResult> {
  if (typeof input.missionId !== 'string' || !input.missionId.trim()) throw new ProposeMissionCompletionError('INVALID_MISSION_ID', 'A Mission id is required.');
  try { assertRelaisActor(input.actor); } catch { throw new ProposeMissionCompletionError('UNAUTHORIZED', 'Only an active Relais may propose completion.'); }
  try { validateSummary(input.summary); validateCompletionId(input.clientCompletionId); } catch (error) { mapValidation(error); }
  const operation = async () => client.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<{ id: string; lifecycle: string; depth: string; executionStartedAt: Date | null; customerId: string }[]>`
      SELECT mission."id", mission."lifecycle", mission."depth", mission."executionStartedAt", connection."customerId"
      FROM "Mission" mission INNER JOIN "Connection" connection ON connection."id" = mission."connectionId"
      WHERE mission."id" = ${input.missionId} FOR UPDATE OF mission`;
    const mission = rows[0];
    if (!mission) throw new ProposeMissionCompletionError('MISSION_NOT_FOUND', 'The Mission was not found.');
    const actor = await readCurrentActor(transaction, input.actor);
    if (!actor || actor.role !== 'RELAIS' || actor.accountStatus !== 'ACTIVE' || actor.relaisProfile?.eligibility !== 'APPROVED') throw new ProposeMissionCompletionError('UNAUTHORIZED', 'Only the current approved Relais may propose completion.');
    const existing = await transaction.completionAttempt.findUnique({ where: { missionId_proposedByUserId_clientCompletionId: { missionId: input.missionId, proposedByUserId: input.actor.userId, clientCompletionId: input.clientCompletionId } } });
    if (existing) {
      if (existing.summary !== input.summary) throw new ProposeMissionCompletionError('IDEMPOTENCY_CONFLICT', 'The client completion id was already used with different content.');
      return { status: 'EXISTING' as const, attempt: toAttemptSummary(existing), mission: { id: mission.id, lifecycle: 'COMPLETION_PENDING' as const, executionStartedAt: mission.executionStartedAt as Date } };
    }
    const assignments = await transaction.missionAssignment.findMany({ where: { missionId: input.missionId, endedAt: null }, select: { id: true, relaisUserId: true } });
    if (assignments.length !== 1 || assignments[0].relaisUserId !== input.actor.userId) throw new ProposeMissionCompletionError('UNAUTHORIZED', 'Only the current assigned Relais may propose completion.');
    const pending = await transaction.completionAttempt.findFirst({ where: { missionId: input.missionId, status: 'PENDING' } });
    if (pending) throw new ProposeMissionCompletionError('COMPLETION_ALREADY_PENDING', 'This Mission already has a pending completion attempt.');
    if (mission.depth !== 'QUICK' || mission.lifecycle !== 'ACTIVE' || !mission.executionStartedAt) throw new ProposeMissionCompletionError('INVALID_MISSION_STATE', 'Completion can only be proposed for a started QUICK Mission.');
    const attempt = await transaction.completionAttempt.create({ data: { missionId: input.missionId, proposedByUserId: input.actor.userId, summary: input.summary, clientCompletionId: input.clientCompletionId }, select: { id: true, missionId: true, proposedByUserId: true, summary: true, status: true, clientCompletionId: true, proposedAt: true, respondedAt: true, responseByUserId: true, problemNote: true } });
    await transaction.mission.update({ where: { id: input.missionId }, data: { lifecycle: 'COMPLETION_PENDING' } });
    return { status: 'CREATED' as const, attempt: toAttemptSummary(attempt), mission: { id: mission.id, lifecycle: 'COMPLETION_PENDING' as const, executionStartedAt: mission.executionStartedAt } };
  }, { isolationLevel: 'Serializable' });
  try { return await operation(); } catch (error) { if (isRetryableCompletionConflict(error)) return operation(); if (error instanceof ProposeMissionCompletionError) throw error; throw error; }
}
