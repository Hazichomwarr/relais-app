import { Prisma } from '@prisma/client';
import { canOperateAsCustomer, canOperateAsRelais } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';

export const MAX_COMPLETION_SUMMARY_LENGTH = 2000;
export const MAX_COMPLETION_NOTE_LENGTH = 2000;
export const MAX_COMPLETION_ID_LENGTH = 128;

export type CompletionAttemptSummary = {
  id: string;
  missionId: string;
  proposedByUserId: string;
  summary: string;
  status: 'PENDING' | 'CONFIRMED' | 'DISPUTED';
  clientCompletionId: string;
  proposedAt: Date;
  respondedAt: Date | null;
  responseByUserId: string | null;
  problemNote: string | null;
};

export function isRetryableCompletionConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2002' || error.code === 'P2034';
  }
  return error instanceof Error && /serialization|deadlock|could not serialize|write conflict/i.test(error.message);
}

export function validateCompletionId(value: unknown): void {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_COMPLETION_ID_LENGTH) {
    throw new Error('INVALID_CLIENT_COMPLETION_ID');
  }
}

export function validateSummary(value: unknown, code = 'INVALID_SUMMARY'): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  if (value.length > MAX_COMPLETION_SUMMARY_LENGTH) throw new Error('SUMMARY_TOO_LONG');
  return value;
}

export function validateNote(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value.trim()) throw new Error('INVALID_PROBLEM_NOTE');
  if (value.length > MAX_COMPLETION_NOTE_LENGTH) throw new Error('PROBLEM_NOTE_TOO_LONG');
  return value;
}

export async function readCurrentActor(
  transaction: Prisma.TransactionClient,
  actor: AuthorizationSubject,
) {
  return transaction.user.findUnique({
    where: { id: actor.userId },
    select: { id: true, role: true, accountStatus: true, relaisProfile: { select: { eligibility: true } } },
  });
}

export function assertCustomerActor(actor: AuthorizationSubject): void {
  if (!canOperateAsCustomer(actor).allowed) throw new Error('UNAUTHORIZED');
}

export function assertRelaisActor(actor: AuthorizationSubject): void {
  if (!canOperateAsRelais(actor).allowed) throw new Error('UNAUTHORIZED');
}

export function toAttemptSummary(attempt: {
  id: string;
  missionId: string;
  proposedByUserId: string;
  summary: string;
  status: 'PENDING' | 'CONFIRMED' | 'DISPUTED';
  clientCompletionId: string;
  proposedAt: Date;
  respondedAt: Date | null;
  responseByUserId: string | null;
  problemNote: string | null;
}): CompletionAttemptSummary {
  return attempt;
}

export async function retryCompletionTransaction<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableCompletionConflict(error) || attempt === 2) throw error;
    }
  }
  throw lastError;
}
