import { createRestApiClients } from '@/api/rest-api';
import { tokenStorage } from '@/auth/token-storage';

jest.mock('@/auth/token-storage', () => ({
  tokenStorage: {
    clearTokens: jest.fn(),
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
    setTokens: jest.fn(),
  },
}));
jest.mock('@/logging/AppLogger', () => ({
  AppLogger: { error: jest.fn(), warn: jest.fn() },
}));

function response(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: jest.fn().mockResolvedValue(body === undefined ? '' : JSON.stringify(body)),
  } as unknown as Response;
}

describe('REST payments API', () => {
  const fetchMock = jest.fn();
  const api = createRestApiClients('http://localhost:8000/');

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
    jest.mocked(tokenStorage.getAccessToken).mockResolvedValue('access-token');
  });

  it('uses the user-scoped payment method routes and maps masked cards', async () => {
    const raw = {
      brand: 'Visa',
      expirationMonth: 12,
      expirationYear: 2029,
      id: 'method-id',
      isDefault: true,
      lastFour: '4242',
      provider: 'solis-mock',
      status: 'ACTIVE',
      type: 'CARD',
    };
    fetchMock
      .mockResolvedValueOnce(response([raw]))
      .mockResolvedValueOnce(response(raw, 201))
      .mockResolvedValueOnce(response([raw]))
      .mockResolvedValueOnce(response(undefined, 204));

    expect(await api.payments.list()).toEqual([
      expect.objectContaining({
        expiry: '12/29',
        id: 'method-id',
        lastFour: '4242',
        type: 'CREDIT_CARD',
      }),
    ]);
    await api.payments.createMethod({
      brand: 'Visa',
      expirationMonth: 12,
      expirationYear: 2029,
      lastFour: '4242',
      type: 'CARD',
    });
    await api.payments.setDefault('method-id');
    await api.payments.remove('method-id');

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      'http://localhost:8000/v1/users/me/payment-methods',
      'http://localhost:8000/v1/users/me/payment-methods',
      'http://localhost:8000/v1/users/me/payment-methods/method-id/default',
      'http://localhost:8000/v1/users/me/payment-methods/method-id',
    ]);
    expect(fetchMock.mock.calls[2]?.[1]).toEqual(expect.objectContaining({ method: 'PATCH' }));
  });

  it('keeps minor units as strings across wallet, Pix, automation and receipts', async () => {
    const wallet = {
      availableBalanceMinor: '9007199254740993',
      currency: 'BRL',
      id: 'wallet-id',
      reservedBalanceMinor: '0',
      status: 'ACTIVE',
      updatedAt: '2026-07-30T10:00:00.000Z',
      version: 1,
    };
    const intent = {
      amountMinor: '5000',
      authorizedAmountMinor: '0',
      capturedAmountMinor: '0',
      createdAt: '2026-07-30T10:00:00.000Z',
      currency: 'BRL',
      expiresAt: '2026-07-30T10:15:00.000Z',
      id: 'payment-id',
      isTerminal: false,
      metadata: { copyPasteCode: 'PIX-CODE' },
      refundedAmountMinor: '0',
      status: 'PENDING',
      type: 'WALLET_TOP_UP',
      updatedAt: '2026-07-30T10:00:00.000Z',
    };
    const rule = {
      cooldownUntil: null,
      currency: 'BRL',
      enabled: false,
      failureCount: 0,
      id: null,
      minimumBalanceMinor: '5000',
      paymentMethodId: null,
      rechargeAmountMinor: '10000',
    };
    fetchMock
      .mockResolvedValueOnce(response(wallet))
      .mockResolvedValueOnce(response({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(response(intent, 201))
      .mockResolvedValueOnce(response(intent))
      .mockResolvedValueOnce(response(intent))
      .mockResolvedValueOnce(response(intent))
      .mockResolvedValueOnce(response(rule))
      .mockResolvedValueOnce(response({ ...rule, enabled: true }))
      .mockResolvedValueOnce(response(rule))
      .mockResolvedValueOnce(response({ receiptNumber: 'SOLIS-1' }));

    expect((await api.payments.getWallet()).availableBalanceMinor).toBe('9007199254740993');
    await api.payments.listWalletTransactions();
    await api.payments.createTopUp({
      amountMinor: '5000',
      currency: 'BRL',
      idempotencyKey: 'rest-test',
      method: 'PIX',
    });
    await api.payments.getTopUp('payment-id');
    await api.payments.getPayment('payment-id');
    await api.payments.cancelPayment('payment-id');
    await api.payments.getAutoRecharge();
    await api.payments.updateAutoRecharge({
      consentConfirmed: true,
      currency: 'BRL',
      enabled: true,
      minimumBalanceMinor: '5000',
      paymentMethodId: 'method-id',
      rechargeAmountMinor: '10000',
    });
    await api.payments.disableAutoRecharge();
    await api.payments.getReceipt('session-id');

    expect(fetchMock.mock.calls[2]?.[1]?.body).toBe(
      JSON.stringify({
        amountMinor: '5000',
        currency: 'BRL',
        idempotencyKey: 'rest-test',
        method: 'PIX',
      }),
    );
    expect(fetchMock.mock.calls[9]?.[0]).toContain(
      '/v1/users/me/charging-sessions/session-id/receipt',
    );
    for (const call of fetchMock.mock.calls) {
      expect(new Headers(call[1]?.headers).get('Authorization')).toBe('Bearer access-token');
    }
  });
});
