import { prisma } from '../../db/client.ts';
import { canOperateAsCustomer } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { PrismaClient } from '../../../../generated/prisma/client.ts';

const MAX_REQUEST_KEY_LENGTH = 128;
const MAX_LANGUAGE_LENGTH = 16;

export type RequestConnectionInput = {
  actor: AuthorizationSubject;
  requestKey: string;
  preferredLanguage?: string | null;
};

export type ConnectionRequestErrorCode =
  | 'UNAUTHORIZED'
  | 'CUSTOMER_PROFILE_MISSING'
  | 'INVALID_REQUEST_KEY'
  | 'INVALID_LANGUAGE';

export class ConnectionRequestError extends Error {
  readonly code: ConnectionRequestErrorCode;

  constructor(code: ConnectionRequestErrorCode, message: string) {
    super(message);
    this.name = 'ConnectionRequestError';
    this.code = code;
  }
}

export type ConnectionRequestResult = {
  status: 'CREATED' | 'EXISTING';
  connection: {
    id: string;
    lifecycle: 'MATCHING' | 'CONNECTED' | 'ENDED';
    preferredLanguage: string | null;
    createdAt: Date;
  };
};

type ConnectionRecord = ConnectionRequestResult['connection'];

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function toConnectionResult(
  status: ConnectionRequestResult['status'],
  connection: ConnectionRecord,
): ConnectionRequestResult {
  return { status, connection };
}

function normalizeRequestKey(requestKey: string): string {
  if (typeof requestKey !== 'string') {
    throw new ConnectionRequestError(
      'INVALID_REQUEST_KEY',
      'A request key is required.',
    );
  }

  const normalized = requestKey.trim();
  if (!normalized || normalized.length > MAX_REQUEST_KEY_LENGTH) {
    throw new ConnectionRequestError(
      'INVALID_REQUEST_KEY',
      `Request key must be between 1 and ${MAX_REQUEST_KEY_LENGTH} characters.`,
    );
  }

  return normalized;
}

function normalizeLanguage(language: string): string {
  if (typeof language !== 'string') {
    throw new ConnectionRequestError(
      'INVALID_LANGUAGE',
      'Preferred language must be a string.',
    );
  }

  const normalized = language.trim();
  if (!normalized || normalized.length > MAX_LANGUAGE_LENGTH) {
    throw new ConnectionRequestError(
      'INVALID_LANGUAGE',
      `Preferred language must be between 1 and ${MAX_LANGUAGE_LENGTH} characters.`,
    );
  }

  return normalized;
}

function toStoredLanguage(
  explicitLanguage: RequestConnectionInput['preferredLanguage'],
  savedLanguage: string | null | undefined,
): string | null {
  if (explicitLanguage !== undefined && explicitLanguage !== null) {
    return normalizeLanguage(explicitLanguage);
  }

  return savedLanguage?.trim() || null;
}

export async function requestConnection(
  input: RequestConnectionInput,
  client: PrismaClient = prisma,
): Promise<ConnectionRequestResult> {
  const authorization = canOperateAsCustomer(input.actor);
  if (!authorization.allowed) {
    throw new ConnectionRequestError(
      'UNAUTHORIZED',
      `Customer authorization failed: ${authorization.reason}.`,
    );
  }

  const requestKey = normalizeRequestKey(input.requestKey);
  const profile = await client.customerProfile.findUnique({
    where: { userId: input.actor.userId },
    select: { preferredLanguage: true },
  });

  if (!profile) {
    throw new ConnectionRequestError(
      'CUSTOMER_PROFILE_MISSING',
      'The Customer profile is missing.',
    );
  }

  const preferredLanguage = toStoredLanguage(
    input.preferredLanguage,
    profile.preferredLanguage,
  );

  try {
    const connection = await client.$transaction((transaction) =>
      transaction.connection.create({
        data: {
          customerId: input.actor.userId,
          requestKey,
          lifecycle: 'MATCHING',
          preferredLanguage,
        },
        select: {
          id: true,
          lifecycle: true,
          preferredLanguage: true,
          createdAt: true,
        },
      }),
    );

    return toConnectionResult('CREATED', connection);
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await client.connection.findFirst({
      where: { customerId: input.actor.userId, requestKey },
      select: {
        id: true,
        lifecycle: true,
        preferredLanguage: true,
        createdAt: true,
      },
    });

    if (!existing) {
      throw error;
    }

    return toConnectionResult('EXISTING', existing);
  }
}
