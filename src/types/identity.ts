import {
  RELAIS_AVAILABILITY_STATUSES,
  RELAIS_ELIGIBILITY_STATUSES,
  USER_ACCOUNT_STATUSES,
  USER_ROLES,
} from '../constants/identity.ts';

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export type UserAccountStatus =
  (typeof USER_ACCOUNT_STATUSES)[keyof typeof USER_ACCOUNT_STATUSES];

export type RelaisEligibility =
  (typeof RELAIS_ELIGIBILITY_STATUSES)[keyof typeof RELAIS_ELIGIBILITY_STATUSES];

export type RelaisAvailability =
  (typeof RELAIS_AVAILABILITY_STATUSES)[keyof typeof RELAIS_AVAILABILITY_STATUSES];

export type AuthorizationSubject = {
  userId: string;
  role: UserRole;
  accountStatus: UserAccountStatus;
  relaisEligibility?: RelaisEligibility | null;
};
