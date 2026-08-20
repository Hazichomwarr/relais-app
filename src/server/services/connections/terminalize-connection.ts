import { Prisma, PrismaClient } from '@prisma/client';

export type TerminalOutcome =
  | 'CUSTOMER_CANCELLED'
  | 'DECLINED_BY_RELAIS'
  | 'NO_RELAIS_AVAILABLE'
  | 'ABANDONED';

export type TerminalizationStatus = 'ENDED' | 'ALREADY_ENDED';

export type TerminalizationResult = {
  status: TerminalizationStatus;
  connectionId: string;
  lifecycle: 'ENDED';
  terminalOutcome: string;
  endedAt: Date;
  connectedAt: Date | null;
  assignmentEnded: boolean;
};

export type TerminalizationErrorCode =
  | 'CONNECTION_NOT_FOUND'
  | 'INVALID_CONNECTION_STATE'
  | 'ACTIVE_ASSIGNMENT_CONFLICT';

export class TerminalizationError extends Error {
  readonly code: TerminalizationErrorCode;

  constructor(code: TerminalizationErrorCode, message: string) {
    super(message);
    this.name = 'TerminalizationError';
    this.code = code;
  }
}

export type LockedConnection = {
  id: string;
  customerId: string;
  lifecycle: 'MATCHING' | 'CONNECTED' | 'ENDED';
  terminalOutcome: string | null;
  connectedAt: Date | null;
  endedAt: Date | null;
};

export async function lockConnection(
  transaction: Prisma.TransactionClient,
  connectionId: string,
): Promise<LockedConnection> {
  const rows = await transaction.$queryRaw<LockedConnection[]>`
    SELECT
      "id",
      "customerId",
      "lifecycle",
      "terminalOutcome",
      "connectedAt",
      "endedAt"
    FROM "Connection"
    WHERE "id" = ${connectionId}
    FOR UPDATE
  `;
  const connection = rows[0];

  if (!connection) {
    throw new TerminalizationError(
      'CONNECTION_NOT_FOUND',
      'The Connection was not found.',
    );
  }

  return connection;
}

export async function terminalizeLockedConnection(
  transaction: Prisma.TransactionClient,
  connection: LockedConnection,
  outcome: TerminalOutcome,
  options: { requireNoActiveAssignment?: boolean } = {},
): Promise<TerminalizationResult> {
  const activeAssignment = await transaction.connectionAssignment.findFirst({
    where: { connectionId: connection.id, endedAt: null },
    select: { id: true },
  });

  if (connection.lifecycle === 'ENDED') {
    if (activeAssignment) {
      throw new TerminalizationError(
        'ACTIVE_ASSIGNMENT_CONFLICT',
        'A terminal Connection cannot retain an active assignment.',
      );
    }

    if (!connection.endedAt || !connection.terminalOutcome) {
      throw new TerminalizationError(
        'INVALID_CONNECTION_STATE',
        'The Connection has an incomplete terminal state.',
      );
    }

    return {
      status: 'ALREADY_ENDED',
      connectionId: connection.id,
      lifecycle: 'ENDED',
      terminalOutcome: connection.terminalOutcome,
      endedAt: connection.endedAt,
      connectedAt: connection.connectedAt,
      assignmentEnded: false,
    };
  }

  if (connection.lifecycle !== 'MATCHING' && connection.lifecycle !== 'CONNECTED') {
    throw new TerminalizationError(
      'INVALID_CONNECTION_STATE',
      'Only MATCHING or CONNECTED Connections may be ended.',
    );
  }

  if (options.requireNoActiveAssignment && activeAssignment) {
    throw new TerminalizationError(
      'ACTIVE_ASSIGNMENT_CONFLICT',
      'This terminal outcome requires a Connection without an active assignment.',
    );
  }

  const endedRows = await transaction.$queryRaw<Array<{ endedAt: Date }>>`
    UPDATE "Connection"
    SET
      "lifecycle" = CAST('ENDED' AS "ConnectionLifecycle"),
      "terminalOutcome" = CAST(${outcome} AS "ConnectionTerminalOutcome"),
      "endedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${connection.id}
    RETURNING "endedAt"
  `;
  const endedAt = endedRows[0]?.endedAt;

  if (!endedAt) {
    throw new TerminalizationError(
      'INVALID_CONNECTION_STATE',
      'The Connection could not be terminalized.',
    );
  }

  if (activeAssignment) {
    await transaction.connectionAssignment.updateMany({
      where: { connectionId: connection.id, endedAt: null },
      data: { endedAt },
    });
  }

  return {
    status: 'ENDED',
    connectionId: connection.id,
    lifecycle: 'ENDED',
    terminalOutcome: outcome,
    endedAt,
    connectedAt: connection.connectedAt,
    assignmentEnded: Boolean(activeAssignment),
  };
}
