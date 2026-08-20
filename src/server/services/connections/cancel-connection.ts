import { prisma } from '../../db/client.ts';
import { canOperateAsCustomer } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { PrismaClient } from '@prisma/client';
import {
  lockConnection,
  terminalizeLockedConnection,
  TerminalizationError,
  type TerminalizationResult,
} from './terminalize-connection.ts';

export type CancelConnectionInput = {
  actor: AuthorizationSubject;
  connectionId: string;
};

export type CancelConnectionErrorCode =
  | 'UNAUTHORIZED'
  | 'NOT_CONNECTION_OWNER'
  | 'CONNECTION_NOT_FOUND'
  | 'INVALID_CONNECTION_STATE'
  | 'ACTIVE_ASSIGNMENT_CONFLICT';

export class CancelConnectionError extends Error {
  readonly code: CancelConnectionErrorCode;

  constructor(code: CancelConnectionErrorCode, message: string) {
    super(message);
    this.name = 'CancelConnectionError';
    this.code = code;
  }
}

export type CancelConnectionResult = TerminalizationResult;

export async function cancelConnection(
  input: CancelConnectionInput,
  client: PrismaClient = prisma,
): Promise<CancelConnectionResult> {
  const authorization = canOperateAsCustomer(input.actor);
  if (!authorization.allowed) {
    throw new CancelConnectionError(
      'UNAUTHORIZED',
      `Customer authorization failed: ${authorization.reason}.`,
    );
  }

  try {
    return await client.$transaction(async (transaction) => {
      const connection = await lockConnection(transaction, input.connectionId);
      if (connection.customerId !== input.actor.userId) {
        throw new CancelConnectionError(
          'NOT_CONNECTION_OWNER',
          'Only the owning Customer may cancel this Connection.',
        );
      }

      return terminalizeLockedConnection(transaction, connection, 'CUSTOMER_CANCELLED');
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error instanceof TerminalizationError) {
      throw new CancelConnectionError(error.code, error.message);
    }
    throw error;
  }
}
