import { PrismaClient } from '@prisma/client';
import { prisma } from '../../db/client.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { assertCustomerActor, isRetryableCompletionConflict, readCurrentActor, toAttemptSummary, type CompletionAttemptSummary } from './completion-workflow.ts';

export type ConfirmMissionCompletionInput = { actor: AuthorizationSubject; completionAttemptId: string };
export type ConfirmMissionCompletionResult = { status: 'CONFIRMED' | 'EXISTING'; attempt: CompletionAttemptSummary; mission: { id: string; lifecycle: 'COMPLETED'; completedAt: Date } };
export type ConfirmMissionCompletionErrorCode = 'INVALID_COMPLETION_ATTEMPT_ID' | 'UNAUTHORIZED' | 'COMPLETION_ATTEMPT_NOT_FOUND' | 'INVALID_MISSION_STATE' | 'STALE_COMPLETION_ATTEMPT';
export class ConfirmMissionCompletionError extends Error { readonly code: ConfirmMissionCompletionErrorCode; constructor(code: ConfirmMissionCompletionErrorCode, message: string) { super(message); this.name = 'ConfirmMissionCompletionError'; this.code = code; } }

export async function confirmMissionCompletion(input: ConfirmMissionCompletionInput, client: PrismaClient = prisma): Promise<ConfirmMissionCompletionResult> {
  if (typeof input.completionAttemptId !== 'string' || !input.completionAttemptId.trim()) throw new ConfirmMissionCompletionError('INVALID_COMPLETION_ATTEMPT_ID', 'A completion attempt id is required.');
  try { assertCustomerActor(input.actor); } catch { throw new ConfirmMissionCompletionError('UNAUTHORIZED', 'Only the owning Customer may confirm completion.'); }
  const operation = async () => client.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<{ id: string; missionId: string; status: 'PENDING'|'CONFIRMED'|'DISPUTED'; summary: string; proposedByUserId: string; clientCompletionId: string; proposedAt: Date; respondedAt: Date|null; responseByUserId: string|null; problemNote: string|null; lifecycle: string; executionStartedAt: Date|null; customerId: string }[]>`
      SELECT attempt."id", attempt."missionId", attempt."status", attempt."summary", attempt."proposedByUserId", attempt."clientCompletionId", attempt."proposedAt", attempt."respondedAt", attempt."responseByUserId", attempt."problemNote", mission."lifecycle", mission."executionStartedAt", connection."customerId"
      FROM "CompletionAttempt" attempt INNER JOIN "Mission" mission ON mission."id" = attempt."missionId" INNER JOIN "Connection" connection ON connection."id" = mission."connectionId"
      WHERE attempt."id" = ${input.completionAttemptId} FOR UPDATE OF attempt, mission`;
    const row = rows[0];
    if (!row) throw new ConfirmMissionCompletionError('COMPLETION_ATTEMPT_NOT_FOUND', 'The completion attempt was not found.');
    const actor = await readCurrentActor(transaction, input.actor);
    if (!actor || actor.role !== 'CUSTOMER' || actor.accountStatus !== 'ACTIVE' || row.customerId !== input.actor.userId) throw new ConfirmMissionCompletionError('UNAUTHORIZED', 'Only the owning Customer may confirm completion.');
    if (row.status === 'CONFIRMED') return { status: 'EXISTING' as const, attempt: toAttemptSummary(row), mission: { id: row.missionId, lifecycle: 'COMPLETED' as const, completedAt: row.respondedAt as Date } };
    if (row.status !== 'PENDING') throw new ConfirmMissionCompletionError('STALE_COMPLETION_ATTEMPT', 'This completion attempt is no longer pending.');
    if (row.lifecycle !== 'COMPLETION_PENDING') throw new ConfirmMissionCompletionError('INVALID_MISSION_STATE', 'The Mission is not awaiting completion confirmation.');
    const [{ now }] = await transaction.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS "now"`;
    const attempt = await transaction.completionAttempt.update({ where: { id: row.id }, data: { status: 'CONFIRMED', respondedAt: now, responseByUserId: input.actor.userId }, select: { id: true, missionId: true, proposedByUserId: true, summary: true, status: true, clientCompletionId: true, proposedAt: true, respondedAt: true, responseByUserId: true, problemNote: true } });
    await transaction.mission.update({ where: { id: row.missionId }, data: { lifecycle: 'COMPLETED', completedAt: now } });
    await transaction.missionAssignment.updateMany({ where: { missionId: row.missionId, endedAt: null }, data: { endedAt: now } });
    return { status: 'CONFIRMED' as const, attempt: toAttemptSummary(attempt), mission: { id: row.missionId, lifecycle: 'COMPLETED' as const, completedAt: now } };
  }, { isolationLevel: 'Serializable' });
  try { return await operation(); } catch (error) { if (isRetryableCompletionConflict(error)) return operation(); throw error; }
}
