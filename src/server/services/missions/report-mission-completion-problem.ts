import { PrismaClient } from '@prisma/client';
import { prisma } from '../../db/client.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { assertCustomerActor, isRetryableCompletionConflict, readCurrentActor, toAttemptSummary, validateNote, MAX_COMPLETION_NOTE_LENGTH, type CompletionAttemptSummary } from './completion-workflow.ts';

export type ReportMissionCompletionProblemInput = { actor: AuthorizationSubject; completionAttemptId: string; note?: string | null };
export type ReportMissionCompletionProblemResult = { status: 'DISPUTED' | 'EXISTING'; attempt: CompletionAttemptSummary; mission: { id: string; lifecycle: 'ACTIVE'; executionStartedAt: Date } };
export type ReportMissionCompletionProblemErrorCode = 'INVALID_COMPLETION_ATTEMPT_ID' | 'INVALID_PROBLEM_NOTE' | 'PROBLEM_NOTE_TOO_LONG' | 'UNAUTHORIZED' | 'COMPLETION_ATTEMPT_NOT_FOUND' | 'INVALID_MISSION_STATE' | 'STALE_COMPLETION_ATTEMPT' | 'IDEMPOTENCY_CONFLICT';
export class ReportMissionCompletionProblemError extends Error { readonly code: ReportMissionCompletionProblemErrorCode; constructor(code: ReportMissionCompletionProblemErrorCode, message: string) { super(message); this.name = 'ReportMissionCompletionProblemError'; this.code = code; } }

export async function reportMissionCompletionProblem(input: ReportMissionCompletionProblemInput, client: PrismaClient = prisma): Promise<ReportMissionCompletionProblemResult> {
  if (typeof input.completionAttemptId !== 'string' || !input.completionAttemptId.trim()) throw new ReportMissionCompletionProblemError('INVALID_COMPLETION_ATTEMPT_ID', 'A completion attempt id is required.');
  let note: string | null; try { note = validateNote(input.note); } catch (error) { const code = error instanceof Error ? error.message : 'INVALID_PROBLEM_NOTE'; throw new ReportMissionCompletionProblemError(code as ReportMissionCompletionProblemErrorCode, code === 'PROBLEM_NOTE_TOO_LONG' ? `Problem note cannot exceed ${MAX_COMPLETION_NOTE_LENGTH} characters.` : 'Problem note must contain text when provided.'); }
  try { assertCustomerActor(input.actor); } catch { throw new ReportMissionCompletionProblemError('UNAUTHORIZED', 'Only the owning Customer may report a completion problem.'); }
  const operation = async () => client.$transaction(async (transaction) => {
    const rows = await transaction.$queryRaw<{ id: string; missionId: string; status: 'PENDING'|'CONFIRMED'|'DISPUTED'; summary: string; proposedByUserId: string; clientCompletionId: string; proposedAt: Date; respondedAt: Date|null; responseByUserId: string|null; problemNote: string|null; lifecycle: string; executionStartedAt: Date|null; customerId: string }[]>`
      SELECT attempt."id", attempt."missionId", attempt."status", attempt."summary", attempt."proposedByUserId", attempt."clientCompletionId", attempt."proposedAt", attempt."respondedAt", attempt."responseByUserId", attempt."problemNote", mission."lifecycle", mission."executionStartedAt", connection."customerId"
      FROM "CompletionAttempt" attempt INNER JOIN "Mission" mission ON mission."id" = attempt."missionId" INNER JOIN "Connection" connection ON connection."id" = mission."connectionId"
      WHERE attempt."id" = ${input.completionAttemptId} FOR UPDATE OF attempt, mission`;
    const row = rows[0];
    if (!row) throw new ReportMissionCompletionProblemError('COMPLETION_ATTEMPT_NOT_FOUND', 'The completion attempt was not found.');
    const actor = await readCurrentActor(transaction, input.actor);
    if (!actor || actor.role !== 'CUSTOMER' || actor.accountStatus !== 'ACTIVE' || row.customerId !== input.actor.userId) throw new ReportMissionCompletionProblemError('UNAUTHORIZED', 'Only the owning Customer may report a completion problem.');
    if (row.status === 'DISPUTED') { if (row.problemNote !== note) throw new ReportMissionCompletionProblemError('IDEMPOTENCY_CONFLICT', 'This completion attempt was already disputed with different details.'); return { status: 'EXISTING' as const, attempt: toAttemptSummary(row), mission: { id: row.missionId, lifecycle: 'ACTIVE' as const, executionStartedAt: row.executionStartedAt as Date } }; }
    if (row.status !== 'PENDING') throw new ReportMissionCompletionProblemError('STALE_COMPLETION_ATTEMPT', 'This completion attempt is no longer pending.');
    if (row.lifecycle !== 'COMPLETION_PENDING' || !row.executionStartedAt) throw new ReportMissionCompletionProblemError('INVALID_MISSION_STATE', 'The Mission is not awaiting a completion response.');
    const [{ now }] = await transaction.$queryRaw<{ now: Date }[]>`SELECT CURRENT_TIMESTAMP AS "now"`;
    const attempt = await transaction.completionAttempt.update({ where: { id: row.id }, data: { status: 'DISPUTED', respondedAt: now, responseByUserId: input.actor.userId, problemNote: note }, select: { id: true, missionId: true, proposedByUserId: true, summary: true, status: true, clientCompletionId: true, proposedAt: true, respondedAt: true, responseByUserId: true, problemNote: true } });
    await transaction.mission.update({ where: { id: row.missionId }, data: { lifecycle: 'ACTIVE' } });
    return { status: 'DISPUTED' as const, attempt: toAttemptSummary(attempt), mission: { id: row.missionId, lifecycle: 'ACTIVE' as const, executionStartedAt: row.executionStartedAt } };
  }, { isolationLevel: 'Serializable' });
  try { return await operation(); } catch (error) { if (isRetryableCompletionConflict(error)) return operation(); throw error; }
}
