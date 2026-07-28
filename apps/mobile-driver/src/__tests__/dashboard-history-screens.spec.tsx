import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { FlatList } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { DashboardScreen } from '@/dashboard/DashboardScreen';
import { ChargingHistoryScreen } from '@/history/ChargingHistoryScreen';
import { ThemeProvider } from '@/theme/ThemeProvider';
import type { ChargingHistoryItem, DashboardData, UserProfile } from '@/types/domain';

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useInfiniteQuery: jest.fn(),
  useQuery: jest.fn(),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));
jest.mock('@/api', () => ({
  api: {
    dashboard: { get: jest.fn() },
    history: { list: jest.fn() },
    vehicles: { list: jest.fn() },
  },
}));
jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
}));

const session: ChargingHistoryItem = {
  connector: { id: 'connector-1', label: 'CCS2 · 150 kW', type: 'ccs2' },
  cost: { amount: '53.87', currency: 'BRL' },
  durationSeconds: 2520,
  endedAt: '2026-07-12T19:12:00.000Z',
  energyKwh: 24.6,
  failureReason: null,
  id: 'session-1',
  startedAt: '2026-07-12T18:30:00.000Z',
  station: { city: 'São Paulo', id: 'station-1', name: 'Solis Centro' },
  status: 'completed',
  vehicle: {
    brand: 'Solis',
    id: 'vehicle-1',
    model: 'E1',
    nickname: 'Aurora',
  },
};

const dashboard: DashboardData = {
  driver: { firstName: 'Marina', name: 'Marina Souza' },
  lastSession: session,
  mostUsedConnector: { sessionCount: 2, type: 'ccs2' },
  mostUsedStation: {
    city: 'São Paulo',
    energyKwh: 40,
    id: 'station-1',
    name: 'Solis Centro',
    sessionCount: 2,
  },
  period: {
    from: '2026-07-01T03:00:00.000Z',
    timezone: 'America/Sao_Paulo',
    to: '2026-07-28T15:00:00.000Z',
  },
  primaryVehicle: {
    batteryCapacityKwh: 60,
    brand: 'Solis',
    connectorTypes: ['ccs2'],
    id: 'vehicle-1',
    model: 'E1',
    nickname: 'Aurora',
    year: 2026,
  },
  summary: {
    avoidedCo2Kg: null,
    averageDurationSeconds: 2520,
    averageEnergyPerSession: 20,
    cancelledSessions: 0,
    completedSessions: 2,
    currency: 'BRL',
    estimatedSavings: null,
    failedSessions: 0,
    totalCost: '80.00',
    totalDurationSeconds: 5040,
    totalEnergyKwh: 40,
    totalSessions: 2,
  },
};

function Providers({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('dashboard and history screens', () => {
  const queryMock = jest.mocked(useQuery);
  const infiniteQueryMock = jest.mocked(useInfiniteQuery);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1' } as UserProfile,
    } as ReturnType<typeof useAuth>);
  });

  it('renders dashboard loading and error retry states', () => {
    queryMock.mockReturnValueOnce({
      isLoading: true,
    } as ReturnType<typeof useQuery>);
    const loading = render(
      <Providers>
        <DashboardScreen />
      </Providers>,
    );
    expect(loading.getByLabelText('Carregando dashboard')).toBeTruthy();
    loading.unmount();

    const refetch = jest.fn();
    queryMock.mockReturnValueOnce({
      error: new Error('Sem conexão'),
      isError: true,
      isLoading: false,
      refetch,
    } as unknown as ReturnType<typeof useQuery>);
    const error = render(
      <Providers>
        <DashboardScreen />
      </Providers>,
    );
    fireEvent.press(error.getByText('Tentar novamente'));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(error.getByRole('alert')).toBeTruthy();
  });

  it('renders dashboard data, optional fields and quick actions', () => {
    queryMock.mockReturnValueOnce({
      data: dashboard,
      isError: false,
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);
    const screen = render(
      <Providers>
        <DashboardScreen />
      </Providers>,
    );

    expect(screen.getByText('Marina')).toBeTruthy();
    expect(screen.getAllByText('Aurora').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Economia estimada/)).toBeNull();
    expect(screen.queryByText(/CO₂ evitado/)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Histórico' }));
    expect(router.push).toHaveBeenCalledWith('/(tabs)/history');
  });

  it('renders history loading and empty states', () => {
    queryMock.mockReturnValue({ data: [] } as unknown as ReturnType<typeof useQuery>);
    infiniteQueryMock.mockReturnValueOnce({
      isLoading: true,
    } as ReturnType<typeof useInfiniteQuery>);
    const loading = render(
      <Providers>
        <ChargingHistoryScreen />
      </Providers>,
    );
    expect(loading.getByLabelText('Carregando histórico')).toBeTruthy();
    loading.unmount();

    infiniteQueryMock.mockReturnValueOnce({
      data: {
        pageParams: [null],
        pages: [
          {
            items: [],
            pageInfo: {
              endCursor: null,
              hasNextPage: false,
            },
          },
        ],
      },
      hasNextPage: false,
      isError: false,
      isFetchingNextPage: false,
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useInfiniteQuery>);
    const empty = render(
      <Providers>
        <ChargingHistoryScreen />
      </Providers>,
    );
    expect(empty.getByText('Nenhuma sessão encontrada')).toBeTruthy();
  });

  it('paginates, refreshes and opens history details', () => {
    const fetchNextPage = jest.fn();
    const refetch = jest.fn();
    queryMock.mockReturnValue({ data: [] } as unknown as ReturnType<typeof useQuery>);
    infiniteQueryMock.mockReturnValue({
      data: {
        pageParams: [null],
        pages: [
          {
            items: [session],
            pageInfo: {
              endCursor: 'next',
              hasNextPage: true,
            },
          },
        ],
      },
      fetchNextPage,
      hasNextPage: true,
      isError: false,
      isFetchingNextPage: false,
      isLoading: false,
      isRefetching: false,
      refetch,
    } as unknown as ReturnType<typeof useInfiniteQuery>);
    const screen = render(
      <Providers>
        <ChargingHistoryScreen />
      </Providers>,
    );

    fireEvent.press(screen.getByLabelText(/Solis Centro.*Concluída/));
    expect(router.push).toHaveBeenCalledWith({
      params: { sessionId: 'session-1' },
      pathname: '/(tabs)/history/[sessionId]',
    });
    const list = screen.UNSAFE_getByType(FlatList);
    fireEvent(list, 'endReached');
    fireEvent(list, 'refresh');
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
