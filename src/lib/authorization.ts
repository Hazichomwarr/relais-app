import {
  RELAIS_ELIGIBILITY_STATUSES,
  USER_ACCOUNT_STATUSES,
  USER_ROLES,
} from '../constants/identity.ts';
import type { AuthorizationSubject } from '../types/identity.ts';

export type AuthorizationFailureReason =
  | 'ACCOUNT_NOT_ACTIVE'
  | 'WRONG_ROLE'
  | 'RELAIS_NOT_APPROVED';

export type AuthorizationResult =
  | { allowed: true }
  | { allowed: false; reason: AuthorizationFailureReason };

const allowed = (): AuthorizationResult => ({ allowed: true });

const denied = (reason: AuthorizationFailureReason): AuthorizationResult => ({
  allowed: false,
  reason,
});

export function canUseApplication(subject: AuthorizationSubject): AuthorizationResult {
  return subject.accountStatus === USER_ACCOUNT_STATUSES.ACTIVE
    ? allowed()
    : denied('ACCOUNT_NOT_ACTIVE');
}

export function canOperateAsCustomer(subject: AuthorizationSubject): AuthorizationResult {
  const accountResult = canUseApplication(subject);
  if (!accountResult.allowed) {
    return accountResult;
  }

  return subject.role === USER_ROLES.CUSTOMER ? allowed() : denied('WRONG_ROLE');
}

export function canOperateAsRelais(subject: AuthorizationSubject): AuthorizationResult {
  const accountResult = canUseApplication(subject);
  if (!accountResult.allowed) {
    return accountResult;
  }

  if (subject.role !== USER_ROLES.RELAIS) {
    return denied('WRONG_ROLE');
  }

  return subject.relaisEligibility === RELAIS_ELIGIBILITY_STATUSES.APPROVED
    ? allowed()
    : denied('RELAIS_NOT_APPROVED');
}

export function canOperateAsAdmin(subject: AuthorizationSubject): AuthorizationResult {
  const accountResult = canUseApplication(subject);
  if (!accountResult.allowed) {
    return accountResult;
  }

  return subject.role === USER_ROLES.ADMIN ? allowed() : denied('WRONG_ROLE');
}
