import { prisma } from '../../db/client.ts';
import { PrismaClient } from '@prisma/client';
import {
  lockConnection,
  terminalizeLockedConnection,
  TerminalizationError,
  type TerminalizationResult,
} from './terminalize-connection.ts';

export type AbandonConnectionInput = {
  connectionId: string;
};

export type AbandonConnectionErrorCode =
  | 'CONNECTION_NOT_FOUND'
  | 'INVALID_CONNECTION_STATE'
  | 'ACTIVE_ASSIGNMENT_CONFLICT';

export class AbandonConnectionError extends Error {
  readonly code: AbandonConnectionErrorCode;

  constructor(code: AbandonConnectionErrorCode, message: string) {
    super(message);
    this.name = 'AbandonConnectionError';
    this.code = code;
  }
}

export type AbandonConnectionResult = TerminalizationResult;

export async function abandonConnection(
  input: AbandonConnectionInput,
  client: PrismaClient = prisma,
): Promise<AbandonConnectionResult> {
  try {
    return await client.$transaction(async (transaction) => {
      const connection = await lockConnection(transaction, input.connectionId);
      return terminalizeLockedConnection(transaction, connection, 'ABANDONED');
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error instanceof TerminalizationError) {
      throw new AbandonConnectionError(error.code, error.message);
    }
    throw error;
  }
}
