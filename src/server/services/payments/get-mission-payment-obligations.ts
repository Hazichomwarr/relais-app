import { PrismaClient } from '@prisma/client';
import { canOperateAsCustomer, canOperateAsRelais } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import type { PaymentObligationSummary } from './create-quick-payment-obligation.ts';

export type GetMissionPaymentObligationsInput = {
  actor: AuthorizationSubject;
  missionId: string;
};

export type GetMissionPaymentObligationsResult = {
  obligations: PaymentObligationSummary[];
};

export type GetMissionPaymentObligationsErrorCode =
  | 'INVALID_MISSION_ID'
  | 'MISSION_NOT_FOUND'
  | 'UNAUTHORIZED';

export class GetMissionPaymentObligationsError extends Error {
  readonly code: GetMissionPaymentObligationsErrorCode;

  constructor(code: GetMissionPaymentObligationsErrorCode, message: string) {
    super(message);
    this.name = 'GetMissionPaymentObligationsError';
    this.code = code;
  }
}

export async function getMissionPaymentObligations(
  input: GetMissionPaymentObligationsInput,
  client: PrismaClient = prisma,
): Promise<GetMissionPaymentObligationsResult> {
  if (typeof input.missionId !== 'string' || !input.missionId.trim()) {
    throw new GetMissionPaymentObligationsError('INVALID_MISSION_ID', 'A Mission id is required.');
  }
  const customerAuthorization = canOperateAsCustomer(input.actor);
  const relaisAuthorization = canOperateAsRelais(input.actor);

  return client.$transaction(async (transaction) => {
    const mission = await transaction.mission.findUnique({
      where: { id: input.missionId },
      select: {
        id: true,
        connection: { select: { customerId: true } },
        assignments: {
          where: { relaisUserId: input.actor.userId, endedAt: null },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!mission) {
      throw new GetMissionPaymentObligationsError('MISSION_NOT_FOUND', 'The Mission was not found.');
    }

    const actor = await transaction.user.findUnique({
      where: { id: input.actor.userId },
      select: { role: true, accountStatus: true, relaisProfile: { select: { eligibility: true } } },
    });
    const customerAllowed =
      customerAuthorization.allowed &&
      actor?.role === 'CUSTOMER' &&
      actor.accountStatus === 'ACTIVE' &&
      mission.connection.customerId === input.actor.userId;
    const relaisAllowed =
      relaisAuthorization.allowed &&
      actor?.role === 'RELAIS' &&
      actor.accountStatus === 'ACTIVE' &&
      actor.relaisProfile?.eligibility === 'APPROVED' &&
      mission.assignments.length > 0;
    if (!customerAllowed && !relaisAllowed) {
      throw new GetMissionPaymentObligationsError(
        'UNAUTHORIZED',
        'Only the owning Customer or current Mission Relais may read Payment Obligations.',
      );
    }

    const obligations = await transaction.paymentObligation.findMany({
      where: { missionId: mission.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        missionId: true,
        purpose: true,
        amount: true,
        currency: true,
        status: true,
        sourceQuickOfferId: true,
        createdAt: true,
        settledAt: true,
        cancelledAt: true,
      },
    });
    return { obligations };
  }, { isolationLevel: 'Serializable', maxWait: 30_000, timeout: 30_000 });
}
