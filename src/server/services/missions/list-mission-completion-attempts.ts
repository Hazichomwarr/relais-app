import { PrismaClient } from '@prisma/client';
import { prisma } from '../../db/client.ts';
import { canOperateAsAdmin, canOperateAsCustomer, canOperateAsRelais } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { toAttemptSummary, type CompletionAttemptSummary } from './completion-workflow.ts';

export type ListMissionCompletionAttemptsInput = { actor: AuthorizationSubject; missionId: string };
export type ListMissionCompletionAttemptsErrorCode = 'INVALID_MISSION_ID' | 'MISSION_NOT_FOUND' | 'UNAUTHORIZED';
export class ListMissionCompletionAttemptsError extends Error { readonly code: ListMissionCompletionAttemptsErrorCode; constructor(code: ListMissionCompletionAttemptsErrorCode, message: string) { super(message); this.name = 'ListMissionCompletionAttemptsError'; this.code = code; } }

export async function listMissionCompletionAttempts(input: ListMissionCompletionAttemptsInput, client: PrismaClient = prisma): Promise<{ attempts: CompletionAttemptSummary[] }> {
  if (typeof input.missionId !== 'string' || !input.missionId.trim()) throw new ListMissionCompletionAttemptsError('INVALID_MISSION_ID', 'A Mission id is required.');
  return client.$transaction(async (transaction) => {
    const mission = await transaction.mission.findUnique({ where: { id: input.missionId }, select: { id: true, connection: { select: { customerId: true } }, assignments: { where: { relaisUserId: input.actor.userId, endedAt: null }, select: { id: true }, take: 1 } } });
    if (!mission) throw new ListMissionCompletionAttemptsError('MISSION_NOT_FOUND', 'The Mission was not found.');
    const actor = await transaction.user.findUnique({ where: { id: input.actor.userId }, select: { role: true, accountStatus: true, relaisProfile: { select: { eligibility: true } } } });
    const allowed = (canOperateAsCustomer(input.actor).allowed && actor?.role === 'CUSTOMER' && actor.accountStatus === 'ACTIVE' && mission.connection.customerId === input.actor.userId) || (canOperateAsRelais(input.actor).allowed && actor?.role === 'RELAIS' && actor.accountStatus === 'ACTIVE' && actor.relaisProfile?.eligibility === 'APPROVED' && mission.assignments.length > 0) || (canOperateAsAdmin(input.actor).allowed && actor?.role === 'ADMIN' && actor.accountStatus === 'ACTIVE');
    if (!allowed) throw new ListMissionCompletionAttemptsError('UNAUTHORIZED', 'The actor may not read this Mission completion history.');
    const attempts = await transaction.completionAttempt.findMany({ where: { missionId: input.missionId }, orderBy: [{ proposedAt: 'asc' }, { id: 'asc' }], select: { id: true, missionId: true, proposedByUserId: true, summary: true, status: true, clientCompletionId: true, proposedAt: true, respondedAt: true, responseByUserId: true, problemNote: true } });
    return { attempts: attempts.map(toAttemptSummary) };
  }, { isolationLevel: 'Serializable' });
}
