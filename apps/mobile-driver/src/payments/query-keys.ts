export const paymentKeys = {
  all: (userId: string) => ['payments', userId] as const,
  methods: (userId: string) => [...paymentKeys.all(userId), 'methods'] as const,
  wallet: (userId: string) => [...paymentKeys.all(userId), 'wallet'] as const,
  transactions: (userId: string, cursor?: string) =>
    [...paymentKeys.wallet(userId), 'transactions', cursor ?? 'first'] as const,
  intent: (userId: string, paymentId: string) =>
    [...paymentKeys.all(userId), 'intent', paymentId] as const,
  autoRecharge: (userId: string) =>
    [...paymentKeys.wallet(userId), 'auto-recharge'] as const,
  receipt: (userId: string, chargingSessionId: string) =>
    [...paymentKeys.all(userId), 'receipt', chargingSessionId] as const,
};
