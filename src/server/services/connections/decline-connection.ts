import { prisma } from '../../db/client.ts';
import { canOperateAsRelais } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { PrismaClient } from '@prisma/client';
import {
  lockConnection,
  terminalizeLockedConnection,
  TerminalizationError,
  type TerminalizationResult,
} from './terminalize-connection.ts';

export type DeclineConnectionInput = {
  actor: AuthorizationSubject;
  connectionId: string;
};

export type DeclineConnectionErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_ASSIGNED_RELAIS'
  | 'CONNECTION_NOT_FOUND'
  | 'INVALID_CONNECTION_STATE'
  | 'ACTIVE_ASSIGNMENT_CONFLICT';

export class DeclineConnectionError extends Error {
  readonly code: DeclineConnectionErrorCode;

  constructor(code: DeclineConnectionErrorCode, message: string) {
    super(message);
    this.name = 'DeclineConnectionError';
    this.code = code;
  }
}

export type DeclineConnectionResult = TerminalizationResult;

export async function declineConnection(
  input: DeclineConnectionInput,
  client: PrismaClient = prisma,
): Promise<DeclineConnectionResult> {
  const authorization = canOperateAsRelais(input.actor);
  if (!authorization.allowed) {
    throw new DeclineConnectionError(
      'UNAUTHORIZED',
      `Relais authorization failed: ${authorization.reason}.`,
    );
  }

  try {
    return await client.$transaction(async (transaction) => {
      const connection = await lockConnection(transaction, input.connectionId);
      const assignment = await transaction.connectionAssignment.findFirst({
        where: {
          connectionId: input.connectionId,
          relaisUserId: input.actor.userId,
          endedAt: null,
        },
        select: { id: true },
      });

      if (!assignment) {
        throw new DeclineConnectionError(
          'NOT_ASSIGNED_RELAIS',
          'Only the currently assigned Relais may decline this Connection.',
        );
      }

      if (connection.lifecycle !== 'CONNECTED' && connection.lifecycle !== 'ENDED') {
        throw new DeclineConnectionError(
          'INVALID_CONNECTION_STATE',
          'Only a CONNECTED Connection may be declined by a Relais.',
        );
      }

      return terminalizeLockedConnection(transaction, connection, 'DECLINED_BY_RELAIS');
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error instanceof TerminalizationError) {
      throw new DeclineConnectionError(error.code, error.message);
    }
    throw error;
  }
}
