export const QUICK_REFUND_POLICY = {
  BEFORE_EXECUTION_STARTED: 10_000,
  AFTER_EXECUTION_STARTED: 5_000,
  POLICY_VERSION: 'QUICK_V1',
  BASIS_POINTS: 10_000,
} as const;

export type QuickRefundReason = 'BEFORE_EXECUTION_STARTED' | 'AFTER_EXECUTION_STARTED';

export function calculateQuickEntitlement(amount: number, rateBasisPoints: number): number {
  return Math.floor((amount * rateBasisPoints) / QUICK_REFUND_POLICY.BASIS_POINTS);
}
