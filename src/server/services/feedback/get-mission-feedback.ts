import { PrismaClient } from '@prisma/client';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import { feedbackSelect, type MissionFeedbackSummary } from './mission-feedback-workflow.ts';

export type GetMissionFeedbackInput = { actor: AuthorizationSubject; missionId: string };
export type GetMissionFeedbackResult = { missionId: string; myFeedback: MissionFeedbackSummary | null; counterpartFeedback: MissionFeedbackSummary | null; feedback?: MissionFeedbackSummary[] };
export type GetMissionFeedbackErrorCode = 'INVALID_MISSION_ID' | 'MISSION_NOT_FOUND' | 'FEEDBACK_NOT_AVAILABLE' | 'UNAUTHORIZED';
export class GetMissionFeedbackError extends Error { readonly code: GetMissionFeedbackErrorCode; constructor(code: GetMissionFeedbackErrorCode, message: string) { super(message); this.name = 'GetMissionFeedbackError'; this.code = code; } }

export async function getMissionFeedback(input: GetMissionFeedbackInput, client: PrismaClient = prisma): Promise<GetMissionFeedbackResult> {
  if (typeof input.missionId !== 'string' || !input.missionId.trim()) throw new GetMissionFeedbackError('INVALID_MISSION_ID', 'A Mission id is required.');
  return client.$transaction(async (transaction) => {
    const mission = await transaction.mission.findUnique({ where: { id: input.missionId }, select: { id: true, depth: true, lifecycle: true, connection: { select: { customerId: true } }, assignments: { orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }], take: 1, select: { relaisUserId: true } } } });
    if (!mission) throw new GetMissionFeedbackError('MISSION_NOT_FOUND', 'The Mission was not found.');
    if (mission.depth !== 'QUICK' || mission.lifecycle !== 'COMPLETED' || !mission.assignments[0]) throw new GetMissionFeedbackError('FEEDBACK_NOT_AVAILABLE', 'Feedback is available only for completed QUICK Missions.');
    const actor = await transaction.user.findUnique({ where: { id: input.actor.userId }, select: { role: true, accountStatus: true } });
    if (!actor || actor.accountStatus !== 'ACTIVE') throw new GetMissionFeedbackError('UNAUTHORIZED', 'Only active Mission participants or Admins may read feedback.');
    const isCustomer = actor.role === 'CUSTOMER' && mission.connection.customerId === input.actor.userId;
    const isRelais = actor.role === 'RELAIS' && mission.assignments[0].relaisUserId === input.actor.userId;
    const isAdmin = actor.role === 'ADMIN';
    if (!isCustomer && !isRelais && !isAdmin) throw new GetMissionFeedbackError('UNAUTHORIZED', 'The actor may not read this Mission feedback.');
    const feedback = await transaction.missionFeedback.findMany({ where: { missionId: mission.id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: feedbackSelect });
    if (isAdmin) return { missionId: mission.id, myFeedback: null, counterpartFeedback: null, feedback };
    const direction = isCustomer ? 'CUSTOMER_TO_RELAIS' : 'RELAIS_TO_CUSTOMER';
    return { missionId: mission.id, myFeedback: feedback.find((item) => item.direction === direction) ?? null, counterpartFeedback: null };
  }, { isolationLevel: 'Serializable' });
}
