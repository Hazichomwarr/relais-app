import { prisma } from '../../db/client.ts';
import { RELAIS_AVAILABILITY_STATUSES } from '../../../constants/identity.ts';
import { canOperateAsRelais } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import type { RelaisAvailability } from '../../../types/identity.ts';
import { PrismaClient } from '@prisma/client';

export type SetRelaisAvailabilityInput = {
  actor: AuthorizationSubject;
  availability: RelaisAvailability;
};

export type RelaisAvailabilityErrorCode =
  | 'ACCOUNT_NOT_ACTIVE'
  | 'WRONG_ROLE'
  | 'RELAIS_NOT_APPROVED'
  | 'RELAIS_PROFILE_MISSING'
  | 'INVALID_AVAILABILITY';

export class RelaisAvailabilityError extends Error {
  readonly code: RelaisAvailabilityErrorCode;

  constructor(code: RelaisAvailabilityErrorCode, message: string) {
    super(message);
    this.name = 'RelaisAvailabilityError';
    this.code = code;
  }
}

export type RelaisAvailabilityResult = {
  relaisId: string;
  availability: RelaisAvailability;
  availabilityChangedAt: Date;
};

type AvailabilityRow = {
  id: string;
  availability: RelaisAvailability;
  availabilityChangedAt: Date;
};

function isRelaisAvailability(value: unknown): value is RelaisAvailability {
  return (
    value === RELAIS_AVAILABILITY_STATUSES.AVAILABLE ||
    value === RELAIS_AVAILABILITY_STATUSES.UNAVAILABLE
  );
}

export async function setRelaisAvailability(
  input: SetRelaisAvailabilityInput,
  client: PrismaClient = prisma,
): Promise<RelaisAvailabilityResult> {
  if (!isRelaisAvailability(input.availability)) {
    throw new RelaisAvailabilityError(
      'INVALID_AVAILABILITY',
      'Availability must be AVAILABLE or UNAVAILABLE.',
    );
  }

  const authorization = canOperateAsRelais(input.actor);
  if (!authorization.allowed) {
    throw new RelaisAvailabilityError(
      authorization.reason,
      `Relais authorization failed: ${authorization.reason}.`,
    );
  }

  return client.$transaction(async (transaction) => {
    const profile = await transaction.relaisProfile.findUnique({
      where: { userId: input.actor.userId },
      select: { id: true },
    });

    if (!profile) {
      throw new RelaisAvailabilityError(
        'RELAIS_PROFILE_MISSING',
        'The Relais profile is missing.',
      );
    }

    const rows = await transaction.$queryRaw<AvailabilityRow[]>`
      UPDATE "RelaisProfile"
      SET
        "availability" = CAST(${input.availability} AS "RelaisAvailability"),
        "availabilityChangedAt" = CASE
          WHEN "availability" = CAST(${input.availability} AS "RelaisAvailability")
            THEN "availabilityChangedAt"
          ELSE CURRENT_TIMESTAMP
        END
      WHERE "id" = ${profile.id}
      RETURNING "id", "availability", "availabilityChangedAt"
    `;

    const updated = rows[0];
    if (!updated) {
      throw new RelaisAvailabilityError(
        'RELAIS_PROFILE_MISSING',
        'The Relais profile is missing.',
      );
    }

    return {
      relaisId: updated.id,
      availability: updated.availability,
      availabilityChangedAt: updated.availabilityChangedAt,
    };
  });
}
