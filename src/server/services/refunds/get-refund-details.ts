import { PrismaClient } from '@prisma/client';
import { canOperateAsAdmin, canOperateAsCustomer } from '../../../lib/authorization.ts';
import type { AuthorizationSubject } from '../../../types/identity.ts';
import { prisma } from '../../db/client.ts';
import { executionSelect, type RefundExecutionSummary } from './refund-workflow.ts';

export type GetRefundDetailsInput = { actor: AuthorizationSubject; refundEntitlementId: string };
export type GetRefundDetailsResult = { entitlement: { id: string; missionId: string; originalAmount: number; refundRateBasisPoints: number; entitledAmount: number; currency: string; reason: 'BEFORE_EXECUTION_STARTED' | 'AFTER_EXECUTION_STARTED'; policyVersion: 'QUICK_V1'; createdAt: Date }; executions: Array<Omit<RefundExecutionSummary, 'destinationPhoneNumber'> & { destinationPhoneNumber: string | null }> };
export type GetRefundDetailsErrorCode = 'INVALID_REFUND_ENTITLEMENT_ID' | 'REFUND_ENTITLEMENT_NOT_FOUND' | 'UNAUTHORIZED';
export class GetRefundDetailsError extends Error { readonly code: GetRefundDetailsErrorCode; constructor(code: GetRefundDetailsErrorCode, message: string) { super(message); this.name = 'GetRefundDetailsError'; this.code = code; } }

export async function getRefundDetails(input: GetRefundDetailsInput, client: PrismaClient = prisma): Promise<GetRefundDetailsResult> {
  if (typeof input.refundEntitlementId !== 'string' || !input.refundEntitlementId.trim()) throw new GetRefundDetailsError('INVALID_REFUND_ENTITLEMENT_ID', 'A refund entitlement id is required.');
  return client.$transaction(async (transaction) => {
    const entitlement = await transaction.refundEntitlement.findUnique({ where: { id: input.refundEntitlementId }, select: { id: true, missionId: true, originalAmount: true, refundRateBasisPoints: true, entitledAmount: true, currency: true, reason: true, policyVersion: true, createdAt: true, mission: { select: { connection: { select: { customerId: true } } } }, executions: { orderBy: [{ initiatedAt: 'asc' }, { id: 'asc' }], select: executionSelect } } });
    if (!entitlement) throw new GetRefundDetailsError('REFUND_ENTITLEMENT_NOT_FOUND', 'The Refund Entitlement was not found.');
    const actor = await transaction.user.findUnique({ where: { id: input.actor.userId }, select: { role: true, accountStatus: true } });
    const customerAllowed = canOperateAsCustomer(input.actor).allowed && actor?.role === 'CUSTOMER' && actor.accountStatus === 'ACTIVE' && entitlement.mission.connection.customerId === input.actor.userId;
    const adminAllowed = canOperateAsAdmin(input.actor).allowed && actor?.role === 'ADMIN' && actor.accountStatus === 'ACTIVE';
    if (!customerAllowed && !adminAllowed) throw new GetRefundDetailsError('UNAUTHORIZED', 'Only the owning Customer or an active Admin may read refund details.');
    return { entitlement: { id: entitlement.id, missionId: entitlement.missionId, originalAmount: entitlement.originalAmount, refundRateBasisPoints: entitlement.refundRateBasisPoints, entitledAmount: entitlement.entitledAmount, currency: entitlement.currency, reason: entitlement.reason, policyVersion: entitlement.policyVersion, createdAt: entitlement.createdAt }, executions: entitlement.executions.map((execution) => ({ ...execution, destinationPhoneNumber: adminAllowed ? execution.destinationPhoneNumber : null })) };
  }, { isolationLevel: 'Serializable' });
}
