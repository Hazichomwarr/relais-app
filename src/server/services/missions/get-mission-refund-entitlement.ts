import { PrismaClient } from '@prisma/client';
import { canOperateAsAdmin, canOperateAsCustomer } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import type { RefundEntitlementSummary } from './cancel-quick-mission.ts';

export type GetMissionRefundEntitlementInput = { actor: AuthorizationSubject; missionId: string };
export type GetMissionRefundEntitlementErrorCode = 'INVALID_MISSION_ID' | 'MISSION_NOT_FOUND' | 'REFUND_ENTITLEMENT_NOT_FOUND' | 'UNAUTHORIZED';
export class GetMissionRefundEntitlementError extends Error { readonly code: GetMissionRefundEntitlementErrorCode; constructor(code: GetMissionRefundEntitlementErrorCode, message: string) { super(message); this.name = 'GetMissionRefundEntitlementError'; this.code = code; } }

export async function getMissionRefundEntitlement(input: GetMissionRefundEntitlementInput, client: PrismaClient = prisma): Promise<RefundEntitlementSummary> {
  if (typeof input.missionId !== 'string' || !input.missionId.trim()) throw new GetMissionRefundEntitlementError('INVALID_MISSION_ID', 'A Mission id is required.');
  return client.$transaction(async (transaction) => {
    const mission = await transaction.mission.findUnique({ where: { id: input.missionId }, select: { id: true, connection: { select: { customerId: true } } } });
    if (!mission) throw new GetMissionRefundEntitlementError('MISSION_NOT_FOUND', 'The Mission was not found.');
    const actor = await transaction.user.findUnique({ where: { id: input.actor.userId }, select: { role: true, accountStatus: true } });
    const customerAllowed = canOperateAsCustomer(input.actor).allowed && actor?.role === 'CUSTOMER' && actor.accountStatus === 'ACTIVE' && mission.connection.customerId === input.actor.userId;
    const adminAllowed = canOperateAsAdmin(input.actor).allowed && actor?.role === 'ADMIN' && actor.accountStatus === 'ACTIVE';
    if (!customerAllowed && !adminAllowed) throw new GetMissionRefundEntitlementError('UNAUTHORIZED', 'Only the owning Customer or an active Admin may read this entitlement.');
    const entitlement = await transaction.refundEntitlement.findUnique({ where: { missionId: mission.id }, select: { id: true, missionId: true, paymentObligationId: true, cancellationId: true, originalAmount: true, refundRateBasisPoints: true, entitledAmount: true, currency: true, reason: true, policyVersion: true, createdAt: true } });
    if (!entitlement) throw new GetMissionRefundEntitlementError('REFUND_ENTITLEMENT_NOT_FOUND', 'No refund entitlement exists for this Mission.');
    return entitlement;
  }, { isolationLevel: 'Serializable' });
}
