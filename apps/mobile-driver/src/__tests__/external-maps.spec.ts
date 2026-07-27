import {
  buildExternalRouteLinks,
  openExternalRoute,
} from '@/navigation/external-maps';

describe('external navigation', () => {
  it('builds encoded native and web links from coordinates', () => {
    expect(
      buildExternalRouteLinks(
        {
          latitude: -23.5,
          longitude: -46.6,
          label: 'Estação Sé',
        },
        'android',
      ),
    ).toEqual({
      primary:
        'google.navigation:q=-23.5%2C-46.6%20(Esta%C3%A7%C3%A3o%20S%C3%A9)&mode=d',
      fallback:
        'https://www.google.com/maps/dir/?api=1&destination=-23.5%2C-46.6%20(Esta%C3%A7%C3%A3o%20S%C3%A9)',
    });
  });

  it('uses address on iOS and rejects a missing destination', () => {
    expect(
      buildExternalRouteLinks({ address: 'Av. Paulista, 1000' }, 'ios'),
    ).toEqual({
      primary: 'maps://?daddr=Av.%20Paulista%2C%201000&dirflg=d',
      fallback:
        'https://www.google.com/maps/dir/?api=1&destination=Av.%20Paulista%2C%201000',
    });
    expect(buildExternalRouteLinks({}, 'android')).toBeNull();
  });

  it('opens the native app and falls back to the browser', async () => {
    const nativeAdapter = {
      canOpenURL: jest.fn().mockResolvedValue(true),
      openURL: jest.fn().mockResolvedValue(undefined),
    };
    const native = await openExternalRoute(
      { latitude: 1, longitude: 2 },
      { adapter: nativeAdapter, platform: 'android' },
    );
    expect(native).toEqual({
      ok: true,
      openedUrl: 'google.navigation:q=1%2C2&mode=d',
    });

    const fallbackAdapter = {
      canOpenURL: jest
        .fn()
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true),
      openURL: jest.fn().mockResolvedValue(undefined),
    };
    const fallback = await openExternalRoute(
      { address: 'Rua A' },
      { adapter: fallbackAdapter, platform: 'ios' },
    );
    expect(fallback.ok).toBe(true);
    expect(fallbackAdapter.openURL).toHaveBeenCalledWith(
      expect.stringContaining('https://www.google.com/maps/dir/'),
    );
  });

  it('reports unavailable, cancelled and missing destinations', async () => {
    const unavailable = {
      canOpenURL: jest.fn().mockResolvedValue(false),
      openURL: jest.fn(),
    };
    await expect(
      openExternalRoute(
        { address: 'Rua A' },
        { adapter: unavailable, platform: 'android' },
      ),
    ).resolves.toEqual({ ok: false, code: 'unavailable' });
    await expect(
      openExternalRoute({}, { adapter: unavailable }),
    ).resolves.toEqual({ ok: false, code: 'missing-destination' });

    const cancelled = {
      canOpenURL: jest.fn().mockResolvedValue(true),
      openURL: jest.fn().mockRejectedValue(new Error('User cancelled')),
    };
    await expect(
      openExternalRoute(
        { address: 'Rua A' },
        { adapter: cancelled, platform: 'ios' },
      ),
    ).resolves.toEqual({ ok: false, code: 'cancelled' });

    const nonErrorFailure = {
      canOpenURL: jest.fn().mockResolvedValue(true),
      openURL: jest.fn().mockRejectedValue('failure'),
    };
    await expect(
      openExternalRoute(
        { address: 'Rua A' },
        { adapter: nonErrorFailure, platform: 'android' },
      ),
    ).resolves.toEqual({ ok: false, code: 'unavailable' });
  });
});
