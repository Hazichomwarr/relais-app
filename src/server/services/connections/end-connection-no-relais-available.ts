import { prisma } from '../../db/client.ts';
import { PrismaClient } from '@prisma/client';
import {
  lockConnection,
  terminalizeLockedConnection,
  TerminalizationError,
  type TerminalizationResult,
} from './terminalize-connection.ts';

export type EndConnectionNoRelaisAvailableInput = {
  connectionId: string;
};

export type EndConnectionNoRelaisAvailableErrorCode =
  | 'CONNECTION_NOT_FOUND'
  | 'INVALID_CONNECTION_STATE'
  | 'ACTIVE_ASSIGNMENT_CONFLICT';

export class EndConnectionNoRelaisAvailableError extends Error {
  readonly code: EndConnectionNoRelaisAvailableErrorCode;

  constructor(code: EndConnectionNoRelaisAvailableErrorCode, message: string) {
    super(message);
    this.name = 'EndConnectionNoRelaisAvailableError';
    this.code = code;
  }
}

export type EndConnectionNoRelaisAvailableResult = TerminalizationResult;

export async function endConnectionNoRelaisAvailable(
  input: EndConnectionNoRelaisAvailableInput,
  client: PrismaClient = prisma,
): Promise<EndConnectionNoRelaisAvailableResult> {
  try {
    return await client.$transaction(async (transaction) => {
      const connection = await lockConnection(transaction, input.connectionId);
      return terminalizeLockedConnection(
        transaction,
        connection,
        'NO_RELAIS_AVAILABLE',
        { requireNoActiveAssignment: true },
      );
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error instanceof TerminalizationError) {
      throw new EndConnectionNoRelaisAvailableError(error.code, error.message);
    }
    throw error;
  }
}
