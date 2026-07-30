import { createMockApiClients } from '@/api/mock-api';

describe('mock financial vertical slice', () => {
  const api = createMockApiClients();

  it('creates a Pix top-up idempotently and credits the wallet once', async () => {
    const before = await api.payments.getWallet();
    const input = {
      amountMinor: '5000',
      currency: 'BRL' as const,
      idempotencyKey: `test-${Date.now()}`,
      method: 'PIX' as const,
    };
    const created = await api.payments.createTopUp(input);
    const replay = await api.payments.createTopUp(input);
    expect(replay.id).toBe(created.id);
    expect(created.status).toBe('PENDING');

    await api.payments.getTopUp(created.id);
    const captured = await api.payments.getTopUp(created.id);
    const after = await api.payments.getWallet();
    expect(captured.status).toBe('CAPTURED');
    expect(BigInt(after.availableBalanceMinor) - BigInt(before.availableBalanceMinor)).toBe(5000n);

    await api.payments.getTopUp(created.id);
    const stable = await api.payments.getWallet();
    expect(stable.availableBalanceMinor).toBe(after.availableBalanceMinor);
    expect((await api.payments.listWalletTransactions()).items[0]).toMatchObject({
      amountMinor: '5000',
      direction: 'CREDIT',
      paymentIntentId: created.id,
      type: 'TOP_UP',
    });
  });

  it('requires explicit consent for automatic top-ups', async () => {
    const method = (await api.payments.list()).find((item) => item.type === 'CREDIT_CARD')!;
    const request = {
      consentConfirmed: false,
      currency: 'BRL' as const,
      enabled: true,
      minimumBalanceMinor: '5000',
      paymentMethodId: method.id,
      rechargeAmountMinor: '10000',
    };
    await expect(api.payments.updateAutoRecharge(request)).rejects.toThrow('consentimento');
    const enabled = await api.payments.updateAutoRecharge({
      ...request,
      consentConfirmed: true,
    });
    expect(enabled).toMatchObject({ enabled: true, paymentMethodId: method.id });
    expect(await api.payments.disableAutoRecharge()).toMatchObject({ enabled: false });
  });

  it('returns a safe receipt for an owned mock session', async () => {
    const receipt = await api.payments.getReceipt('session-history-001');
    expect(receipt).toMatchObject({
      amountMinor: '5387',
      currency: 'BRL',
      payment: { reference: null, status: 'CAPTURED' },
      status: 'ISSUED',
    });
  });
});
