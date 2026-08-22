import { Prisma } from '@prisma/client';
import { canOperateAsAdmin } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';

export const MAX_REFUND_PROVIDER_LENGTH = 64;
export const MAX_CLIENT_REFUND_ID_LENGTH = 128;
export const MAX_EXTERNAL_REFERENCE_LENGTH = 128;
export const MAX_FAILURE_REASON_LENGTH = 1000;

export type RefundExecutionSummary = {
  id: string;
  refundEntitlementId: string;
  amount: number;
  currency: string;
  method: 'MOBILE_MONEY' | 'CARD' | 'BANK_TRANSFER' | 'CASH' | 'MANUAL_TRANSFER';
  provider: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  externalReference: string | null;
  clientRefundId: string;
  destinationPhoneNumber: string;
  initiatedByUserId: string;
  confirmedByUserId: string | null;
  confirmationSource: 'MANUAL' | 'PROVIDER' | null;
  initiatedAt: Date;
  confirmedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
};

export const executionSelect = { id: true, refundEntitlementId: true, amount: true, currency: true, method: true, provider: true, status: true, externalReference: true, clientRefundId: true, destinationPhoneNumber: true, initiatedByUserId: true, confirmedByUserId: true, confirmationSource: true, initiatedAt: true, confirmedAt: true, failedAt: true, failureReason: true } as const;

export function assertActiveAdmin(actor: AuthorizationSubject): void {
  if (!canOperateAsAdmin(actor).allowed) throw new Error('UNAUTHORIZED');
}

export async function verifyActiveAdmin(transaction: Prisma.TransactionClient, actor: AuthorizationSubject): Promise<void> {
  const admin = await transaction.user.findUnique({ where: { id: actor.userId }, select: { role: true, accountStatus: true } });
  if (!admin || admin.role !== 'ADMIN' || admin.accountStatus !== 'ACTIVE') throw new Error('UNAUTHORIZED');
}

export function validateProvider(provider: unknown): string {
  if (typeof provider !== 'string' || !provider.trim()) throw new Error('INVALID_PROVIDER');
  if (provider.length > MAX_REFUND_PROVIDER_LENGTH) throw new Error('PROVIDER_TOO_LONG');
  return provider;
}

export function validateClientRefundId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_CLIENT_REFUND_ID_LENGTH) throw new Error('INVALID_CLIENT_REFUND_ID');
  return value;
}

export function validateExternalReference(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_EXTERNAL_REFERENCE_LENGTH) throw new Error('INVALID_EXTERNAL_REFERENCE');
  return value;
}

export function validateFailureReason(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value.trim()) throw new Error('INVALID_FAILURE_REASON');
  if (value.length > MAX_FAILURE_REASON_LENGTH) throw new Error('FAILURE_REASON_TOO_LONG');
  return value;
}

export function isVerifiedPhone(phoneNumber: string | null, verifiedAt: Date | null): phoneNumber is string {
  return Boolean(phoneNumber && verifiedAt && /^\+[1-9]\d{7,14}$/.test(phoneNumber));
}

export function isRetryableRefundConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) || /40001|serialization|deadlock|write conflict/i.test(message);
}

export function toExecutionSummary(execution: RefundExecutionSummary): RefundExecutionSummary { return execution; }
