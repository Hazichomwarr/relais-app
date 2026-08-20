import { prisma } from '../../db/client.ts';
import { PrismaClient } from '@prisma/client';

export const MAX_ACTIVE_CONNECTIONS_PER_RELAIS = 3;

const MAX_LANGUAGE_LENGTH = 16;

export type MatchConnectionInput = {
  connectionId: string;
};

export type MatchConnectionResult =
  | {
      status: 'MATCHED';
      connectionId: string;
      assignmentId: string;
      relaisUserId: string;
      conversationId: string;
      connectedAt: Date;
    }
  | {
      status: 'ALREADY_MATCHED';
      connectionId: string;
      assignmentId: string;
      relaisUserId: string;
      conversationId: string;
      connectedAt: Date;
    }
  | {
      status: 'NO_RELAIS_AVAILABLE';
      connectionId: string;
    };

export type MatchConnectionErrorCode =
  | 'CONNECTION_NOT_FOUND'
  | 'CONNECTION_NOT_MATCHING'
  | 'CONNECTION_CUSTOMER_INVALID'
  | 'CONNECTION_ALREADY_ASSIGNED'
  | 'MATCHING_CONFLICT'
  | 'INVALID_CONNECTION_ID';

export class MatchConnectionError extends Error {
  readonly code: MatchConnectionErrorCode;

  constructor(code: MatchConnectionErrorCode, message: string) {
    super(message);
    this.name = 'MatchConnectionError';
    this.code = code;
  }
}

type LockedConnection = {
  id: string;
  customerId: string;
  lifecycle: 'MATCHING' | 'CONNECTED' | 'ENDED';
  preferredLanguage: string | null;
  connectedAt: Date | null;
};

type CandidateRelais = {
  relaisProfileId: string;
  relaisUserId: string;
};

function normalizeLanguage(language: string | null): string | null {
  if (language === null) {
    return null;
  }

  const normalized = language
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();
  return normalized.length > 0 && normalized.length <= MAX_LANGUAGE_LENGTH
    ? normalized
    : null;
}

function assertConnectionId(connectionId: string): void {
  if (typeof connectionId !== 'string' || !connectionId.trim()) {
    throw new MatchConnectionError(
      'INVALID_CONNECTION_ID',
      'A Connection id is required.',
    );
  }
}

function isSerializationConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'P2034' || error.code === '40001')
  ) || message.includes('40001') || message.includes('could not serialize access');
}

async function matchOnce(
  connectionId: string,
  client: PrismaClient,
): Promise<MatchConnectionResult> {
  return client.$transaction(
    async (transaction) => {
      const connections = await transaction.$queryRaw<LockedConnection[]>`
        SELECT
          c."id",
          c."customerId",
          c."lifecycle",
          c."preferredLanguage",
          c."connectedAt"
        FROM "Connection" c
        INNER JOIN "User" customer ON customer."id" = c."customerId"
        WHERE c."id" = ${connectionId}
        FOR UPDATE OF c
      `;
      const connection = connections[0];

      if (!connection) {
        throw new MatchConnectionError(
          'CONNECTION_NOT_FOUND',
          'The Connection was not found.',
        );
      }

      const activeAssignment = await transaction.connectionAssignment.findFirst({
        where: { connectionId, endedAt: null },
        select: { id: true, relaisUserId: true },
      });

      if (connection.lifecycle === 'CONNECTED') {
        const conversation = await transaction.conversation.findUnique({
          where: { connectionId },
          select: { id: true },
        });

        if (!activeAssignment || !conversation || !connection.connectedAt) {
          throw new MatchConnectionError(
            'MATCHING_CONFLICT',
            'The connected Connection is missing its assignment or Conversation.',
          );
        }

        return {
          status: 'ALREADY_MATCHED',
          connectionId,
          assignmentId: activeAssignment.id,
          relaisUserId: activeAssignment.relaisUserId,
          conversationId: conversation.id,
          connectedAt: connection.connectedAt,
        };
      }

      if (connection.lifecycle !== 'MATCHING') {
        throw new MatchConnectionError(
          'CONNECTION_NOT_MATCHING',
          'Only MATCHING Connections may be matched.',
        );
      }

      if (activeAssignment) {
        throw new MatchConnectionError(
          'CONNECTION_ALREADY_ASSIGNED',
          'The MATCHING Connection already has an active assignment.',
        );
      }

      const customer = await transaction.user.findUnique({
        where: { id: connection.customerId },
        select: { role: true, accountStatus: true },
      });
      if (!customer || customer.role !== 'CUSTOMER' || customer.accountStatus !== 'ACTIVE') {
        throw new MatchConnectionError(
          'CONNECTION_CUSTOMER_INVALID',
          'The Connection customer is not an active Customer.',
        );
      }

      const preferredLanguage = normalizeLanguage(connection.preferredLanguage);
      const candidates = await transaction.$queryRaw<CandidateRelais[]>`
        SELECT
          rp."id" AS "relaisProfileId",
          u."id" AS "relaisUserId"
        FROM "RelaisProfile" rp
        INNER JOIN "User" u ON u."id" = rp."userId"
        LEFT JOIN (
          SELECT
            ca."relaisUserId",
            COUNT(*) FILTER (WHERE c2."lifecycle" <> CAST('ENDED' AS "ConnectionLifecycle")) AS "activeLoad",
            MAX(ca."assignedAt") AS "latestAssignmentAt"
          FROM "ConnectionAssignment" ca
          INNER JOIN "Connection" c2 ON c2."id" = ca."connectionId"
          WHERE ca."endedAt" IS NULL
          GROUP BY ca."relaisUserId"
        ) load ON load."relaisUserId" = u."id"
        WHERE u."role" = CAST('RELAIS' AS "UserRole")
          AND u."accountStatus" = CAST('ACTIVE' AS "UserAccountStatus")
          AND rp."eligibility" = CAST('APPROVED' AS "RelaisEligibility")
          AND rp."availability" = CAST('AVAILABLE' AS "RelaisAvailability")
          AND COALESCE(load."activeLoad", 0) < ${MAX_ACTIVE_CONNECTIONS_PER_RELAIS}
          AND (
            ${preferredLanguage}::text IS NULL
            OR EXISTS (
              SELECT 1
              FROM "RelaisLanguage" supported
              WHERE supported."relaisProfileId" = rp."id"
                AND LOWER(BTRIM(supported."languageCode")) = ${preferredLanguage}
            )
          )
        ORDER BY
          COALESCE(load."activeLoad", 0) ASC,
          load."latestAssignmentAt" ASC NULLS FIRST,
          rp."id" ASC
        FOR UPDATE OF rp, u
        LIMIT 1
      `;
      const candidate = candidates[0];

      if (!candidate) {
        return { status: 'NO_RELAIS_AVAILABLE', connectionId };
      }

      const assignment = await transaction.connectionAssignment.create({
        data: {
          connectionId,
          relaisUserId: candidate.relaisUserId,
          assignedByUserId: null,
        },
        select: { id: true, relaisUserId: true, assignedAt: true },
      });
      const conversation = await transaction.conversation.create({
        data: { connectionId },
        select: { id: true },
      });
      const updated = await transaction.connection.update({
        where: { id: connectionId },
        data: { lifecycle: 'CONNECTED', connectedAt: assignment.assignedAt },
        select: { connectedAt: true },
      });

      if (!updated.connectedAt) {
        throw new MatchConnectionError(
          'MATCHING_CONFLICT',
          'The Connection did not receive a connected timestamp.',
        );
      }

      return {
        status: 'MATCHED',
        connectionId,
        assignmentId: assignment.id,
        relaisUserId: assignment.relaisUserId,
        conversationId: conversation.id,
        connectedAt: updated.connectedAt,
      };
    },
    { isolationLevel: 'Serializable' },
  );
}

export async function matchConnection(
  input: MatchConnectionInput,
  client: PrismaClient = prisma,
): Promise<MatchConnectionResult> {
  assertConnectionId(input.connectionId);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await matchOnce(input.connectionId, client);
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 2) {
        throw error;
      }
    }
  }

  throw new MatchConnectionError(
    'MATCHING_CONFLICT',
    'Matching could not be completed safely.',
  );
}
