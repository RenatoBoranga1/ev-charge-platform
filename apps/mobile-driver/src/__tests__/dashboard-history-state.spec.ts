import { customPeriodQuery, dashboardPeriodQuery, periodLabel } from '@/dashboard/periods';
import {
  chargingHistoryKeys,
  chargingSessionKeys,
  dashboardKeys,
  invalidateChargingHistory,
} from '@/history/query-keys';

describe('dashboard periods and history cache state', () => {
  const now = new Date('2026-07-28T15:00:00.000Z');

  it('creates stable current-month and rolling period queries', () => {
    const month = dashboardPeriodQuery('CURRENT_MONTH', now);
    const sevenDays = dashboardPeriodQuery('LAST_7_DAYS', now);

    expect(month.to).toBe(now.toISOString());
    expect(new Date(month.from!).getDate()).toBe(1);
    expect(new Date(sevenDays.to!).getTime() - new Date(sevenDays.from!).getTime()).toBe(
      7 * 24 * 60 * 60 * 1000,
    );
    expect(
      periodLabel({
        from: month.from!,
        timezone: month.timezone!,
        to: month.to!,
      }),
    ).toContain('–');
  });

  it('validates custom ranges, future dates and the maximum interval', () => {
    expect(customPeriodQuery('2026-07-01', '2026-07-20', now)).toEqual(
      expect.objectContaining({
        from: expect.any(String),
        to: expect.any(String),
      }),
    );
    expect(() => customPeriodQuery('2026-07-20', '2026-07-01', now)).toThrow('inicial');
    expect(() => customPeriodQuery('2026-07-01', '2026-07-29', now)).toThrow('futuro');
    expect(() => customPeriodQuery('2024-01-01', '2026-07-01', now)).toThrow('366');
    expect(() => customPeriodQuery('invalid', '2026-07-01', now)).toThrow('válidas');
  });

  it('isolates cache keys per user and invalidates only related dashboard/session data', async () => {
    const filters = { limit: 20, sort: 'RECENT' as const };
    expect(dashboardKeys.detail('user-a', {})).not.toEqual(dashboardKeys.detail('user-b', {}));
    expect(chargingHistoryKeys.list('user-a', filters)).not.toEqual(
      chargingHistoryKeys.list('user-b', filters),
    );
    expect(chargingSessionKeys.detail('user-a', 'session-1')).not.toEqual(
      chargingSessionKeys.detail('user-a', 'session-2'),
    );

    const invalidateQueries = jest.fn().mockResolvedValue(undefined);
    await invalidateChargingHistory({ invalidateQueries }, 'user-a', 'session-1');
    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['dashboard', 'user-a'],
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['charging-history', 'user-a'],
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ['charging-session-history', 'user-a', 'session-1', 'detail'],
    });
  });
});
