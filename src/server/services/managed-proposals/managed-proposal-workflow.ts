import { Prisma } from '@prisma/client';

export const DEFAULT_MANAGED_PROPOSAL_CURRENCY = 'XOF';
export const MAX_MANAGED_PROPOSAL_TITLE_LENGTH = 200;
export const MAX_MANAGED_PROPOSAL_SUMMARY_LENGTH = 4000;
export const MAX_MANAGED_PROPOSAL_DURATION_LENGTH = 100;
export const MAX_MANAGED_PROPOSAL_AMOUNT = 10_000_000;
export const MAX_CLIENT_PROPOSAL_ID_LENGTH = 128;

export type ManagedProposalSummary = {
  id: string; conversationId: string; connectionId: string; customerUserId: string; relaisUserId: string;
  status: 'DRAFT' | 'SENT' | 'SUPERSEDED' | 'ACCEPTED' | 'REJECTED'; title: string; summary: string;
  estimatedDurationText: string | null; serviceAmount: number; currency: string; version: number;
  clientProposalId: string; createdAt: Date; updatedAt: Date;
};

export const proposalSelect = { id: true, conversationId: true, connectionId: true, customerUserId: true, relaisUserId: true, status: true, title: true, summary: true, estimatedDurationText: true, serviceAmount: true, currency: true, version: true, clientProposalId: true, createdAt: true, updatedAt: true } as const;

export function validateProposalText(value: unknown, emptyCode: string, tooLongCode: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(emptyCode);
  const normalized = value.trim();
  if (normalized.length > max) throw new Error(tooLongCode);
  return normalized;
}

export function normalizeDuration(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error('INVALID_DURATION');
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > MAX_MANAGED_PROPOSAL_DURATION_LENGTH) throw new Error('DURATION_TOO_LONG');
  return normalized;
}

export function validateServiceAmount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error('INVALID_SERVICE_AMOUNT');
  if (value > MAX_MANAGED_PROPOSAL_AMOUNT) throw new Error('SERVICE_AMOUNT_TOO_HIGH');
  return value;
}

export function validateClientProposalId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_CLIENT_PROPOSAL_ID_LENGTH) throw new Error('INVALID_CLIENT_PROPOSAL_ID');
  return value;
}

export function isRetryableProposalConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) || /40001|serialization|deadlock|write conflict/i.test(message);
}

export function toProposalSummary(proposal: ManagedProposalSummary): ManagedProposalSummary { return proposal; }
