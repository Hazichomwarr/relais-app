import { Prisma } from '@prisma/client';

export const MAX_FEEDBACK_COMMENT_LENGTH = 1000;
export const MAX_CLIENT_FEEDBACK_ID_LENGTH = 128;

export type MissionFeedbackSummary = {
  id: string;
  missionId: string;
  authorUserId: string;
  subjectUserId: string;
  direction: 'CUSTOMER_TO_RELAIS' | 'RELAIS_TO_CUSTOMER';
  rating: number;
  comment: string | null;
  clientFeedbackId: string;
  createdAt: Date;
};

export const feedbackSelect = { id: true, missionId: true, authorUserId: true, subjectUserId: true, direction: true, rating: true, comment: true, clientFeedbackId: true, createdAt: true } as const;

export function validateRating(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) throw new Error('INVALID_RATING');
  return value;
}

export function normalizeComment(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error('INVALID_COMMENT');
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > MAX_FEEDBACK_COMMENT_LENGTH) throw new Error('COMMENT_TOO_LONG');
  return normalized;
}

export function validateClientFeedbackId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_CLIENT_FEEDBACK_ID_LENGTH) throw new Error('INVALID_CLIENT_FEEDBACK_ID');
  return value;
}

export function isRetryableFeedbackConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) || /40001|serialization|deadlock|write conflict/i.test(message);
}

export function toFeedbackSummary(feedback: MissionFeedbackSummary): MissionFeedbackSummary { return feedback; }
