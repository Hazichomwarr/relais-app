import { PrismaClient } from '@prisma/client';
import { canOperateAsAdmin, canOperateAsCustomer, canOperateAsRelais } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import type { MissionUpdateSummary } from './create-mission-update.ts';

export const DEFAULT_MISSION_UPDATE_PAGE_SIZE = 50;
export const MAX_MISSION_UPDATE_PAGE_SIZE = 100;

export type ListMissionUpdatesInput = {
  actor: AuthorizationSubject;
  missionId: string;
  cursor?: string | null;
  limit?: number;
};

export type ListMissionUpdatesResult = {
  updates: MissionUpdateSummary[];
  nextCursor: string | null;
};

export type ListMissionUpdatesErrorCode =
  | 'INVALID_MISSION_ID'
  | 'INVALID_CURSOR'
  | 'INVALID_LIMIT'
  | 'MISSION_NOT_FOUND'
  | 'UNAUTHORIZED';

export class ListMissionUpdatesError extends Error {
  readonly code: ListMissionUpdatesErrorCode;

  constructor(code: ListMissionUpdatesErrorCode, message: string) {
    super(message);
    this.name = 'ListMissionUpdatesError';
    this.code = code;
  }
}

function getLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_MISSION_UPDATE_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MISSION_UPDATE_PAGE_SIZE) {
    throw new ListMissionUpdatesError('INVALID_LIMIT', `Limit must be an integer between 1 and ${MAX_MISSION_UPDATE_PAGE_SIZE}.`);
  }
  return limit;
}

export async function listMissionUpdates(
  input: ListMissionUpdatesInput,
  client: PrismaClient = prisma,
): Promise<ListMissionUpdatesResult> {
  if (typeof input.missionId !== 'string' || !input.missionId.trim()) {
    throw new ListMissionUpdatesError('INVALID_MISSION_ID', 'A Mission id is required.');
  }
  const limit = getLimit(input.limit);
  if (input.cursor !== undefined && input.cursor !== null && !input.cursor.trim()) {
    throw new ListMissionUpdatesError('INVALID_CURSOR', 'Cursor cannot be empty.');
  }

  return client.$transaction(async (transaction) => {
    const mission = await transaction.mission.findUnique({
      where: { id: input.missionId },
      select: {
        id: true,
        connection: { select: { customerId: true } },
        assignments: { where: { relaisUserId: input.actor.userId, endedAt: null }, select: { id: true }, take: 1 },
      },
    });
    if (!mission) throw new ListMissionUpdatesError('MISSION_NOT_FOUND', 'The Mission was not found.');

    const actor = await transaction.user.findUnique({
      where: { id: input.actor.userId },
      select: { role: true, accountStatus: true, relaisProfile: { select: { eligibility: true } } },
    });
    const customerAllowed = canOperateAsCustomer(input.actor).allowed && actor?.role === 'CUSTOMER' && actor.accountStatus === 'ACTIVE' && mission.connection.customerId === input.actor.userId;
    const relaisAllowed = canOperateAsRelais(input.actor).allowed && actor?.role === 'RELAIS' && actor.accountStatus === 'ACTIVE' && actor.relaisProfile?.eligibility === 'APPROVED' && mission.assignments.length > 0;
    const adminAllowed = canOperateAsAdmin(input.actor).allowed && actor?.role === 'ADMIN' && actor.accountStatus === 'ACTIVE';
    if (!customerAllowed && !relaisAllowed && !adminAllowed) throw new ListMissionUpdatesError('UNAUTHORIZED', 'The actor may not read this Mission history.');

    const anchor = input.cursor
      ? await transaction.missionUpdate.findFirst({ where: { id: input.cursor, missionId: mission.id }, select: { id: true, createdAt: true } })
      : null;
    if (input.cursor && !anchor) throw new ListMissionUpdatesError('INVALID_CURSOR', 'Cursor is not valid for this Mission.');

    const updates = await transaction.missionUpdate.findMany({
      where: {
        missionId: mission.id,
        ...(anchor ? { OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }] } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      select: { id: true, missionId: true, authorUserId: true, type: true, text: true, createdAt: true },
    });
    const hasMore = updates.length > limit;
    const page = updates.slice(0, limit).reverse();
    return { updates: page, nextCursor: hasMore && page[0] ? page[0].id : null };
  }, { isolationLevel: 'Serializable' });
}
