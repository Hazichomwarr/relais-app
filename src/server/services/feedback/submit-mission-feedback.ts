import { PrismaClient } from '@prisma/client';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import { serializableTransactionOptions } from '../../db/transaction-options.ts';
import { feedbackSelect, isRetryableFeedbackConflict, MAX_FEEDBACK_COMMENT_LENGTH, normalizeComment, toFeedbackSummary, validateClientFeedbackId, validateRating, type MissionFeedbackSummary } from './mission-feedback-workflow.ts';

export type SubmitMissionFeedbackInput = { actor: AuthorizationSubject; missionId: string; rating: number; comment?: string | null; clientFeedbackId: string };
export type SubmitMissionFeedbackResult = { status: 'CREATED' | 'EXISTING'; feedback: MissionFeedbackSummary };
export type SubmitMissionFeedbackErrorCode = 'INVALID_MISSION_ID' | 'INVALID_RATING' | 'INVALID_COMMENT' | 'COMMENT_TOO_LONG' | 'INVALID_CLIENT_FEEDBACK_ID' | 'MISSION_NOT_FOUND' | 'FEEDBACK_NOT_AVAILABLE' | 'UNAUTHORIZED' | 'FEEDBACK_ALREADY_SUBMITTED' | 'IDEMPOTENCY_CONFLICT' | 'FEEDBACK_CONFLICT';
export class SubmitMissionFeedbackError extends Error { readonly code: SubmitMissionFeedbackErrorCode; constructor(code: SubmitMissionFeedbackErrorCode, message: string) { super(message); this.name = 'SubmitMissionFeedbackError'; this.code = code; } }

function mapValidation(error: unknown): never { const code = error instanceof Error ? error.message : 'INVALID_COMMENT'; const messages: Record<string, string> = { INVALID_RATING: 'Rating must be an integer from 1 to 5.', INVALID_COMMENT: 'Comment must be text when provided.', COMMENT_TOO_LONG: `Comment cannot exceed ${MAX_FEEDBACK_COMMENT_LENGTH} characters.`, INVALID_CLIENT_FEEDBACK_ID: 'A valid client feedback id is required.' }; throw new SubmitMissionFeedbackError((code in messages ? code : 'INVALID_COMMENT') as SubmitMissionFeedbackErrorCode, messages[code] ?? 'Feedback input is invalid.'); }

async function submitOnce(input: SubmitMissionFeedbackInput, rating: number, comment: string | null, clientFeedbackId: string, client: PrismaClient): Promise<SubmitMissionFeedbackResult> {
  return client.$transaction(async (transaction) => {
    const missions = await transaction.$queryRaw<Array<{ id: string; depth: string; lifecycle: string; customerId: string }>>`
      SELECT mission."id", mission."depth", mission."lifecycle", connection."customerId"
      FROM "Mission" mission INNER JOIN "Connection" connection ON connection."id" = mission."connectionId"
      WHERE mission."id" = ${input.missionId} FOR UPDATE OF mission`;
    const mission = missions[0];
    if (!mission) throw new SubmitMissionFeedbackError('MISSION_NOT_FOUND', 'The Mission was not found.');
    if (mission.depth !== 'QUICK' || mission.lifecycle !== 'COMPLETED') throw new SubmitMissionFeedbackError('FEEDBACK_NOT_AVAILABLE', 'Feedback is available only for completed QUICK Missions.');
    const assignment = await transaction.missionAssignment.findFirst({ where: { missionId: mission.id }, orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }], select: { relaisUserId: true } });
    if (!assignment) throw new SubmitMissionFeedbackError('FEEDBACK_NOT_AVAILABLE', 'A historical Mission Relais is required for feedback.');
    const actor = await transaction.user.findUnique({ where: { id: input.actor.userId }, select: { role: true, accountStatus: true } });
    if (!actor || actor.accountStatus !== 'ACTIVE') throw new SubmitMissionFeedbackError('UNAUTHORIZED', 'Only an active Mission participant may submit feedback.');
    const isCustomer = actor.role === 'CUSTOMER' && mission.customerId === input.actor.userId;
    const isRelais = actor.role === 'RELAIS' && assignment.relaisUserId === input.actor.userId;
    if (!isCustomer && !isRelais) throw new SubmitMissionFeedbackError('UNAUTHORIZED', 'Only a historical Mission participant may submit feedback.');
    const direction = isCustomer ? 'CUSTOMER_TO_RELAIS' : 'RELAIS_TO_CUSTOMER';
    const subjectUserId = isCustomer ? assignment.relaisUserId : mission.customerId;
    const existing = await transaction.missionFeedback.findUnique({ where: { missionId_direction: { missionId: mission.id, direction } }, select: feedbackSelect });
    if (existing) {
      if (existing.clientFeedbackId === clientFeedbackId) {
        if (existing.rating !== rating || existing.comment !== comment) throw new SubmitMissionFeedbackError('IDEMPOTENCY_CONFLICT', 'The client feedback id was already used with different content.');
        return { status: 'EXISTING', feedback: toFeedbackSummary(existing) };
      }
      throw new SubmitMissionFeedbackError('FEEDBACK_ALREADY_SUBMITTED', 'Feedback was already submitted for this direction.');
    }
    const feedback = await transaction.missionFeedback.create({ data: { missionId: mission.id, authorUserId: input.actor.userId, subjectUserId, direction, rating, comment, clientFeedbackId }, select: feedbackSelect });
    return { status: 'CREATED', feedback: toFeedbackSummary(feedback) };
  }, serializableTransactionOptions());
}

export async function submitMissionFeedback(input: SubmitMissionFeedbackInput, client: PrismaClient = prisma): Promise<SubmitMissionFeedbackResult> {
  if (typeof input.missionId !== 'string' || !input.missionId.trim()) throw new SubmitMissionFeedbackError('INVALID_MISSION_ID', 'A Mission id is required.');
  let rating: number; let comment: string | null; let clientFeedbackId: string;
  try { rating = validateRating(input.rating); comment = normalizeComment(input.comment); clientFeedbackId = validateClientFeedbackId(input.clientFeedbackId); } catch (error) { mapValidation(error); }
  for (let attempt = 0; attempt < 3; attempt += 1) { try { return await submitOnce(input, rating!, comment!, clientFeedbackId!, client); } catch (error) { if (isRetryableFeedbackConflict(error) && attempt < 2) continue; if (isRetryableFeedbackConflict(error)) throw new SubmitMissionFeedbackError('FEEDBACK_CONFLICT', 'Feedback could not be submitted safely.'); throw error; } }
  throw new SubmitMissionFeedbackError('FEEDBACK_CONFLICT', 'Feedback could not be submitted safely.');
}
