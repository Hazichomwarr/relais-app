import assert from 'node:assert/strict';
import test from 'node:test';

import {
  RELAIS_ELIGIBILITY_STATUSES,
  USER_ACCOUNT_STATUSES,
  USER_ROLES,
} from '../constants/identity.ts';
import {
  canOperateAsAdmin,
  canOperateAsCustomer,
  canOperateAsRelais,
  canUseApplication,
} from './authorization.ts';

const subject = (role, accountStatus, relaisEligibility) => ({
  userId: 'test-user',
  role,
  accountStatus,
  relaisEligibility,
});

const assertAllowed = (result) => assert.deepEqual(result, { allowed: true });
const assertDenied = (result, reason) =>
  assert.deepEqual(result, { allowed: false, reason });

test('active account may use the application', () => {
  assertAllowed(canUseApplication(subject(USER_ROLES.CUSTOMER, USER_ACCOUNT_STATUSES.ACTIVE)));
});

test('suspended and deactivated accounts cannot use the application', () => {
  assertDenied(
    canUseApplication(subject(USER_ROLES.CUSTOMER, USER_ACCOUNT_STATUSES.SUSPENDED)),
    'ACCOUNT_NOT_ACTIVE',
  );
  assertDenied(
    canUseApplication(subject(USER_ROLES.CUSTOMER, USER_ACCOUNT_STATUSES.DEACTIVATED)),
    'ACCOUNT_NOT_ACTIVE',
  );
});

test('customer authorization requires an active customer account', () => {
  assertAllowed(canOperateAsCustomer(subject(USER_ROLES.CUSTOMER, USER_ACCOUNT_STATUSES.ACTIVE)));
  assertAllowed(
    canOperateAsCustomer(
      subject(
        USER_ROLES.CUSTOMER,
        USER_ACCOUNT_STATUSES.ACTIVE,
        RELAIS_ELIGIBILITY_STATUSES.UNDER_REVIEW,
      ),
    ),
  );
  assertDenied(
    canOperateAsCustomer(subject(USER_ROLES.CUSTOMER, USER_ACCOUNT_STATUSES.SUSPENDED)),
    'ACCOUNT_NOT_ACTIVE',
  );
  assertDenied(
    canOperateAsCustomer(subject(USER_ROLES.CUSTOMER, USER_ACCOUNT_STATUSES.DEACTIVATED)),
    'ACCOUNT_NOT_ACTIVE',
  );
});

test('relais authorization requires an active approved Relais', () => {
  assertAllowed(
    canOperateAsRelais(
      subject(
        USER_ROLES.RELAIS,
        USER_ACCOUNT_STATUSES.ACTIVE,
        RELAIS_ELIGIBILITY_STATUSES.APPROVED,
      ),
    ),
  );

  for (const eligibility of [
    RELAIS_ELIGIBILITY_STATUSES.UNDER_REVIEW,
    RELAIS_ELIGIBILITY_STATUSES.REVOKED,
  ]) {
    assertDenied(
      canOperateAsRelais(
        subject(USER_ROLES.RELAIS, USER_ACCOUNT_STATUSES.ACTIVE, eligibility),
      ),
      'RELAIS_NOT_APPROVED',
    );
  }

  assertDenied(
    canOperateAsRelais(
      subject(
        USER_ROLES.RELAIS,
        USER_ACCOUNT_STATUSES.SUSPENDED,
        RELAIS_ELIGIBILITY_STATUSES.APPROVED,
      ),
    ),
    'ACCOUNT_NOT_ACTIVE',
  );
});

test('admin authorization requires an active admin account', () => {
  assertAllowed(canOperateAsAdmin(subject(USER_ROLES.ADMIN, USER_ACCOUNT_STATUSES.ACTIVE)));
  assertDenied(
    canOperateAsAdmin(subject(USER_ROLES.ADMIN, USER_ACCOUNT_STATUSES.SUSPENDED)),
    'ACCOUNT_NOT_ACTIVE',
  );
});

test('roles do not grant authorization across operational boundaries', () => {
  assertDenied(
    canOperateAsRelais(subject(USER_ROLES.CUSTOMER, USER_ACCOUNT_STATUSES.ACTIVE)),
    'WRONG_ROLE',
  );
  assertDenied(
    canOperateAsAdmin(subject(USER_ROLES.RELAIS, USER_ACCOUNT_STATUSES.ACTIVE)),
    'WRONG_ROLE',
  );
  assertDenied(
    canOperateAsCustomer(subject(USER_ROLES.ADMIN, USER_ACCOUNT_STATUSES.ACTIVE)),
    'WRONG_ROLE',
  );
});
