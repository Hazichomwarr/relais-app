import { parsePhoneNumberFromString } from 'libphonenumber-js';

import { prisma } from '../../db/client.ts';
import type { VerifiedPhoneIdentity } from '../../identity/verified-phone.ts';
import { PrismaClient } from '@prisma/client';

const MAX_LANGUAGE_LENGTH = 16;

export type ProvisionCustomerInput = {
  verifiedPhone: VerifiedPhoneIdentity;
  preferredLanguage?: string | null;
};

export type ProvisionCustomerErrorCode =
  | 'INVALID_PHONE_NUMBER'
  | 'INVALID_VERIFICATION_CONTEXT'
  | 'ACCOUNT_NOT_ACTIVE'
  | 'IDENTITY_ROLE_CONFLICT'
  | 'CUSTOMER_PROFILE_MISSING'
  | 'INVALID_LANGUAGE';

export class ProvisionCustomerError extends Error {
  readonly code: ProvisionCustomerErrorCode;

  constructor(code: ProvisionCustomerErrorCode, message: string) {
    super(message);
    this.name = 'ProvisionCustomerError';
    this.code = code;
  }
}

export type ProvisionCustomerResult = {
  status: 'CREATED' | 'EXISTING';
  customer: {
    id: string;
    phoneNumber: string;
    phoneVerifiedAt: Date;
    role: 'CUSTOMER';
    accountStatus: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
    preferredLanguage: string | null;
  };
};

type UserWithCustomerProfile = {
  id: string;
  phoneNumber: string | null;
  phoneVerifiedAt: Date | null;
  role: 'CUSTOMER' | 'RELAIS' | 'ADMIN';
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  customerProfile: { preferredLanguage: string | null } | null;
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

export function normalizeVerifiedPhone(phoneNumber: string): string {
  if (typeof phoneNumber !== 'string') {
    throw new ProvisionCustomerError(
      'INVALID_PHONE_NUMBER',
      'Phone number must be a string.',
    );
  }

  const parsed = parsePhoneNumberFromString(phoneNumber);
  if (!parsed || !parsed.isValid()) {
    throw new ProvisionCustomerError(
      'INVALID_PHONE_NUMBER',
      'Phone number must be a valid international number.',
    );
  }

  return parsed.number;
}

function validateVerificationContext(identity: VerifiedPhoneIdentity): void {
  if (
    !identity ||
    !(identity.verifiedAt instanceof Date) ||
    Number.isNaN(identity.verifiedAt.getTime())
  ) {
    throw new ProvisionCustomerError(
      'INVALID_VERIFICATION_CONTEXT',
      'A trusted phone verification timestamp is required.',
    );
  }
}

function normalizePreferredLanguage(language: string | null | undefined): string | null {
  if (language === undefined || language === null) {
    return null;
  }

  if (typeof language !== 'string') {
    throw new ProvisionCustomerError(
      'INVALID_LANGUAGE',
      'Preferred language must be a string.',
    );
  }

  const normalized = language.trim();
  if (!normalized || normalized.length > MAX_LANGUAGE_LENGTH) {
    throw new ProvisionCustomerError(
      'INVALID_LANGUAGE',
      `Preferred language must be between 1 and ${MAX_LANGUAGE_LENGTH} characters.`,
    );
  }

  return normalized;
}

function selectCustomer(user: UserWithCustomerProfile, verifiedAt: Date): ProvisionCustomerResult {
  if (user.role !== 'CUSTOMER') {
    throw new ProvisionCustomerError(
      'IDENTITY_ROLE_CONFLICT',
      'This phone number already belongs to a non-Customer identity.',
    );
  }

  if (user.accountStatus !== 'ACTIVE') {
    throw new ProvisionCustomerError(
      'ACCOUNT_NOT_ACTIVE',
      'This Customer account is not active.',
    );
  }

  if (!user.customerProfile || !user.phoneNumber || !user.phoneVerifiedAt) {
    throw new ProvisionCustomerError(
      'CUSTOMER_PROFILE_MISSING',
      'The existing Customer identity is incomplete.',
    );
  }

  return {
    status: 'EXISTING',
    customer: {
      id: user.id,
      phoneNumber: user.phoneNumber,
      phoneVerifiedAt: user.phoneVerifiedAt ?? verifiedAt,
      role: 'CUSTOMER',
      accountStatus: user.accountStatus,
      preferredLanguage: user.customerProfile.preferredLanguage,
    },
  };
}

async function findExistingCustomer(
  client: PrismaClient,
  phoneNumber: string,
  verifiedAt: Date,
): Promise<ProvisionCustomerResult | null> {
  const user = await client.user.findUnique({
    where: { phoneNumber },
    select: {
      id: true,
      phoneNumber: true,
      phoneVerifiedAt: true,
      role: true,
      accountStatus: true,
      customerProfile: { select: { preferredLanguage: true } },
    },
  });

  return user ? selectCustomer(user, verifiedAt) : null;
}

export async function provisionCustomerFromVerifiedPhone(
  input: ProvisionCustomerInput,
  client: PrismaClient = prisma,
): Promise<ProvisionCustomerResult> {
  validateVerificationContext(input.verifiedPhone);
  const phoneNumber = normalizeVerifiedPhone(input.verifiedPhone.phoneNumber);
  const preferredLanguage = normalizePreferredLanguage(input.preferredLanguage);

  const existing = await findExistingCustomer(
    client,
    phoneNumber,
    input.verifiedPhone.verifiedAt,
  );
  if (existing) {
    return existing;
  }

  try {
    const created = await client.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: {
          phoneNumber,
          phoneVerifiedAt: input.verifiedPhone.verifiedAt,
          role: 'CUSTOMER',
          accountStatus: 'ACTIVE',
          customerProfile: {
            create: { preferredLanguage },
          },
        },
        select: {
          id: true,
          phoneNumber: true,
          phoneVerifiedAt: true,
          role: true,
          accountStatus: true,
          customerProfile: { select: { preferredLanguage: true } },
        },
      });

      if (!user.phoneNumber || !user.phoneVerifiedAt || !user.customerProfile) {
        throw new ProvisionCustomerError(
          'CUSTOMER_PROFILE_MISSING',
          'Customer provisioning did not create a complete identity.',
        );
      }

      return {
        status: 'CREATED' as const,
        customer: {
          id: user.id,
          phoneNumber: user.phoneNumber,
          phoneVerifiedAt: user.phoneVerifiedAt,
          role: 'CUSTOMER' as const,
          accountStatus: user.accountStatus,
          preferredLanguage: user.customerProfile.preferredLanguage,
        },
      };
    });

    return created;
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const racedExisting = await findExistingCustomer(
      client,
      phoneNumber,
      input.verifiedPhone.verifiedAt,
    );
    if (racedExisting) {
      return racedExisting;
    }

    throw error;
  }
}
