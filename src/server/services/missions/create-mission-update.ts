import { PrismaClient } from '@prisma/client';
import { canOperateAsRelais } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';

export const MAX_MISSION_UPDATE_TEXT_LENGTH = 2_000;

export type CreateMissionUpdateInput = {
  actor: AuthorizationSubject;
  missionId: string;
  type: 'PROGRESS' | 'NOTE';
  text: string;
  clientUpdateId: string;
};

export type MissionUpdateSummary = {
  id: string;
  missionId: string;
  authorUserId: string;
  type: 'PROGRESS' | 'NOTE';
  text: string;
  createdAt: Date;
};

export type CreateMissionUpdateResult = {
  status: 'CREATED' | 'EXISTING';
  update: MissionUpdateSummary;
};

export type CreateMissionUpdateErrorCode =
  | 'INVALID_MISSION_ID'
  | 'INVALID_UPDATE_TYPE'
  | 'INVALID_UPDATE_TEXT'
  | 'INVALID_CLIENT_UPDATE_ID'
  | 'MISSION_NOT_FOUND'
  | 'INVALID_MISSION_DEPTH'
  | 'INVALID_MISSION_STATE'
  | 'MISSION_ASSIGNMENT_MISSING'
  | 'IDEMPOTENCY_CONFLICT'
  | 'UNAUTHORIZED'
  | 'UPDATE_CONFLICT';

export class CreateMissionUpdateError extends Error {
  readonly code: CreateMissionUpdateErrorCode;

  constructor(code: CreateMissionUpdateErrorCode, message: string) {
    super(message);
    this.name = 'CreateMissionUpdateError';
    this.code = code;
  }
}

const updateSelect = {
  id: true,
  missionId: true,
  authorUserId: true,
  type: true,
  text: true,
  createdAt: true,
} as const;

function validateInput(input: CreateMissionUpdateInput): void {
  if (typeof input.missionId !== 'string' || !input.missionId.trim()) {
    throw new CreateMissionUpdateError('INVALID_MISSION_ID', 'A Mission id is required.');
  }
  if (input.type !== 'PROGRESS' && input.type !== 'NOTE') {
    throw new CreateMissionUpdateError('INVALID_UPDATE_TYPE', 'Mission Update type is invalid.');
  }
  if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > MAX_MISSION_UPDATE_TEXT_LENGTH) {
    throw new CreateMissionUpdateError('INVALID_UPDATE_TEXT', `Mission Update text must be between 1 and ${MAX_MISSION_UPDATE_TEXT_LENGTH} characters.`);
  }
  if (typeof input.clientUpdateId !== 'string' || !input.clientUpdateId.trim() || input.clientUpdateId.length > 128) {
    throw new CreateMissionUpdateError('INVALID_CLIENT_UPDATE_ID', 'A valid client update id is required.');
  }
  if (!canOperateAsRelais(input.actor).allowed) {
    throw new CreateMissionUpdateError('UNAUTHORIZED', 'Only an active approved Relais may create Mission Updates.');
  }
}

function isRetryableConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (typeof error === 'object' && error !== null && 'code' in error &&
    (error.code === 'P2002' || error.code === 'P2034' || error.code === '40001')) ||
    message.includes('40001') || message.includes('could not serialize access') ||
    message.includes('TransactionWriteConflict') || message.includes('write conflict') || message.includes('deadlock');
}

async function createOnce(input: CreateMissionUpdateInput, client: PrismaClient): Promise<CreateMissionUpdateResult> {
  return client.$transaction(async (transaction) => {
    const missions = await transaction.$queryRaw<Array<{
      id: string;
      depth: 'QUICK' | 'MANAGED';
      lifecycle: 'PENDING_EXECUTION' | 'ACTIVE' | 'COMPLETION_PENDING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
      executionStartedAt: Date | null;
    }>>`
      SELECT "id", "depth", "lifecycle", "executionStartedAt"
      FROM "Mission"
      WHERE "id" = ${input.missionId}
      FOR UPDATE
    `;
    const mission = missions[0];
    if (!mission) throw new CreateMissionUpdateError('MISSION_NOT_FOUND', 'The Mission was not found.');
    if (mission.depth !== 'QUICK') throw new CreateMissionUpdateError('INVALID_MISSION_DEPTH', 'Only QUICK Mission Updates are implemented.');
    if (mission.lifecycle !== 'ACTIVE' || !mission.executionStartedAt) {
      throw new CreateMissionUpdateError('INVALID_MISSION_STATE', 'Mission Updates require an ACTIVE Mission whose execution has started.');
    }

    const assignments = await transaction.$queryRaw<Array<{
      id: string;
      relaisUserId: string;
      role: string;
      accountStatus: string;
      eligibility: string | null;
    }>>`
      SELECT ma."id", ma."relaisUserId", u."role", u."accountStatus", rp."eligibility"
      FROM "MissionAssignment" ma
      JOIN "User" u ON u."id" = ma."relaisUserId"
      LEFT JOIN "RelaisProfile" rp ON rp."userId" = u."id"
      WHERE ma."missionId" = ${mission.id} AND ma."endedAt" IS NULL
      FOR UPDATE OF ma
    `;
    if (assignments.length !== 1) {
      throw new CreateMissionUpdateError('MISSION_ASSIGNMENT_MISSING', 'Exactly one active Mission Relais assignment is required.');
    }
    const assignment = assignments[0];
    if (assignment.relaisUserId !== input.actor.userId || assignment.role !== 'RELAIS' || assignment.accountStatus !== 'ACTIVE' || assignment.eligibility !== 'APPROVED') {
      throw new CreateMissionUpdateError('UNAUTHORIZED', 'Only the current active approved Mission Relais may create updates.');
    }

    const existing = await transaction.missionUpdate.findUnique({
      where: { missionId_authorUserId_clientUpdateId: { missionId: mission.id, authorUserId: input.actor.userId, clientUpdateId: input.clientUpdateId } },
      select: updateSelect,
    });
    if (existing) {
      if (existing.type !== input.type || existing.text !== input.text) {
        throw new CreateMissionUpdateError('IDEMPOTENCY_CONFLICT', 'The client update id was already used with different content.');
      }
      return { status: 'EXISTING', update: existing };
    }

    const update = await transaction.missionUpdate.create({
      data: { missionId: mission.id, authorUserId: input.actor.userId, type: input.type, text: input.text, clientUpdateId: input.clientUpdateId },
      select: updateSelect,
    });
    return { status: 'CREATED', update };
  }, { isolationLevel: 'Serializable', maxWait: 30_000, timeout: 30_000 });
}

export async function createMissionUpdate(input: CreateMissionUpdateInput, client: PrismaClient = prisma): Promise<CreateMissionUpdateResult> {
  validateInput(input);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await createOnce(input, client);
    } catch (error) {
      if (isRetryableConflict(error) && attempt < 2) continue;
      if (isRetryableConflict(error)) throw new CreateMissionUpdateError('UPDATE_CONFLICT', 'Mission Update could not be created safely.');
      throw error;
    }
  }
  throw new CreateMissionUpdateError('UPDATE_CONFLICT', 'Mission Update could not be created safely.');
}
