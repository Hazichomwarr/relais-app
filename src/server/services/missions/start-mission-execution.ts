import { PrismaClient } from '@prisma/client';
import { canOperateAsRelais } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import { serializableTransactionOptions } from '../../db/transaction-options.ts';

export type StartMissionExecutionInput = {
  actor: AuthorizationSubject;
  missionId: string;
};

export type StartMissionExecutionResult = {
  status: 'STARTED' | 'ALREADY_STARTED';
  mission: {
    id: string;
    depth: 'QUICK';
    lifecycle: 'ACTIVE';
    executionStartedAt: Date;
  };
};

export type StartMissionExecutionErrorCode =
  | 'INVALID_MISSION_ID'
  | 'MISSION_NOT_FOUND'
  | 'INVALID_MISSION_DEPTH'
  | 'INVALID_MISSION_STATE'
  | 'MISSION_ASSIGNMENT_MISSING'
  | 'UNAUTHORIZED'
  | 'EXECUTION_START_CONFLICT';

export class StartMissionExecutionError extends Error {
  readonly code: StartMissionExecutionErrorCode;

  constructor(code: StartMissionExecutionErrorCode, message: string) {
    super(message);
    this.name = 'StartMissionExecutionError';
    this.code = code;
  }
}

type LockedMission = {
  id: string;
  depth: 'QUICK' | 'MANAGED';
  lifecycle: 'PENDING_EXECUTION' | 'ACTIVE' | 'COMPLETION_PENDING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  executionStartedAt: Date | null;
};

function validateInput(input: StartMissionExecutionInput): void {
  if (typeof input.missionId !== 'string' || !input.missionId.trim()) {
    throw new StartMissionExecutionError('INVALID_MISSION_ID', 'A Mission id is required.');
  }
  if (!canOperateAsRelais(input.actor).allowed) {
    throw new StartMissionExecutionError('UNAUTHORIZED', 'Only an active approved Relais may start execution.');
  }
}

function isRetryableConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (typeof error === 'object' && error !== null && 'code' in error &&
    (error.code === 'P2034' || error.code === '40001')) ||
    message.includes('40001') || message.includes('could not serialize access') ||
    message.includes('TransactionWriteConflict') || message.includes('write conflict') || message.includes('deadlock');
}

async function startOnce(input: StartMissionExecutionInput, client: PrismaClient): Promise<StartMissionExecutionResult> {
  return client.$transaction(async (transaction) => {
    const missions = await transaction.$queryRaw<LockedMission[]>`
      SELECT "id", "depth", "lifecycle", "executionStartedAt"
      FROM "Mission"
      WHERE "id" = ${input.missionId}
      FOR UPDATE
    `;
    const mission = missions[0];
    if (!mission) throw new StartMissionExecutionError('MISSION_NOT_FOUND', 'The Mission was not found.');
    if (mission.depth !== 'QUICK') {
      throw new StartMissionExecutionError('INVALID_MISSION_DEPTH', 'Only QUICK Mission execution is implemented.');
    }
    if (mission.lifecycle !== 'ACTIVE') {
      throw new StartMissionExecutionError('INVALID_MISSION_STATE', 'Only an ACTIVE Mission may start execution.');
    }

    const assignments = await transaction.missionAssignment.findMany({
      where: { missionId: mission.id, endedAt: null },
      select: {
        id: true,
        relaisUserId: true,
        relaisUser: { select: { role: true, accountStatus: true, relaisProfile: { select: { eligibility: true } } } },
      },
      take: 2,
    });
    if (assignments.length !== 1) {
      throw new StartMissionExecutionError('MISSION_ASSIGNMENT_MISSING', 'Exactly one active Mission Relais assignment is required.');
    }
    const assignment = assignments[0];
    if (
      assignment.relaisUserId !== input.actor.userId ||
      assignment.relaisUser.role !== 'RELAIS' ||
      assignment.relaisUser.accountStatus !== 'ACTIVE' ||
      assignment.relaisUser.relaisProfile?.eligibility !== 'APPROVED'
    ) {
      throw new StartMissionExecutionError('UNAUTHORIZED', 'Only the current active approved Mission Relais may start execution.');
    }

    if (mission.executionStartedAt) {
      return {
        status: 'ALREADY_STARTED',
        mission: { id: mission.id, depth: 'QUICK', lifecycle: 'ACTIVE', executionStartedAt: mission.executionStartedAt },
      };
    }

    const started = await transaction.$queryRaw<Array<{ id: string; executionStartedAt: Date }>>`
      UPDATE "Mission"
      SET "executionStartedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${mission.id}
        AND "lifecycle" = CAST('ACTIVE' AS "MissionLifecycle")
        AND "executionStartedAt" IS NULL
      RETURNING "id", "executionStartedAt"
    `;
    const row = started[0];
    if (!row) throw new StartMissionExecutionError('EXECUTION_START_CONFLICT', 'Mission execution could not start safely.');
    return {
      status: 'STARTED',
      mission: { id: row.id, depth: 'QUICK', lifecycle: 'ACTIVE', executionStartedAt: row.executionStartedAt },
    };
  }, serializableTransactionOptions());
}

export async function startMissionExecution(
  input: StartMissionExecutionInput,
  client: PrismaClient = prisma,
): Promise<StartMissionExecutionResult> {
  validateInput(input);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await startOnce(input, client);
    } catch (error) {
      if (isRetryableConflict(error) && attempt < 2) continue;
      if (isRetryableConflict(error)) {
        throw new StartMissionExecutionError('EXECUTION_START_CONFLICT', 'Mission execution could not start safely.');
      }
      throw error;
    }
  }
  throw new StartMissionExecutionError('EXECUTION_START_CONFLICT', 'Mission execution could not start safely.');
}
