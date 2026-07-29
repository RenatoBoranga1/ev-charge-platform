import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { PropsWithChildren } from 'react';

import ActiveChargeScreen from '../../app/(tabs)/charge/active';
import { useAuth } from '@/auth/AuthProvider';
import StationDetailsScreen from '../../app/(tabs)/stations/[stationId]';
import { chargingRealtimeClient } from '@/realtime';
import { useChargingStore } from '@/stores/charging-store';
import { ThemeProvider } from '@/theme/ThemeProvider';
import type { ChargingSession, Station, UserProfile } from '@/types/domain';

jest.mock('@tanstack/react-query', () => ({
  useMutation: jest.fn(),
  useQuery: jest.fn(),
  useQueryClient: jest.fn(),
}));
jest.mock('@/auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));
jest.mock('@/api', () => ({
  api: {
    charging: {
      getActive: jest.fn(),
      getMetrics: jest.fn(),
      stop: jest.fn(),
    },
    vehicles: { list: jest.fn() },
  },
}));
jest.mock('@/history/query-keys', () => ({
  invalidateChargingHistory: jest.fn(),
}));
jest.mock('@/stores/charging-store', () => ({
  useChargingStore: jest.fn(),
}));
jest.mock('@/realtime', () => ({
  chargingRealtimeClient: {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    reconnect: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockReturnValue(jest.fn()),
    subscribeConnection: jest.fn().mockReturnValue(jest.fn()),
    subscribeError: jest.fn().mockReturnValue(jest.fn()),
  },
}));
jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: jest.fn().mockReturnValue({ stationId: 'station-1' }),
}));

const activeSession: ChargingSession = {
  connectorId: 'connector-1',
  connectorLabel: 'CCS2 · 150 kW',
  currentPowerKw: 42.5,
  elapsedSeconds: 900,
  energyKwh: 8.4,
  estimatedBatteryPercent: 58,
  estimatedCost: 18.9,
  id: 'session-active',
  paymentMethodId: 'payment-1',
  startedAt: '2026-07-29T12:00:00.000Z',
  stationId: 'station-1',
  stationName: 'Solis Centro',
  status: 'charging',
  tariffPerKwh: 2.25,
  vehicleId: 'vehicle-1',
};

function Providers({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('operational branding screens', () => {
  const queryMock = jest.mocked(useQuery);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1' } as UserProfile,
    } as ReturnType<typeof useAuth>);
    jest.mocked(useQueryClient).mockReturnValue({} as ReturnType<typeof useQueryClient>);
    jest.mocked(useMutation).mockReturnValue({
      error: null,
      isPending: false,
      mutate: jest.fn(),
    } as unknown as ReturnType<typeof useMutation>);
    jest.mocked(useChargingStore).mockImplementation((selector) =>
      selector({
        activeSession,
        applyRealtimeEvent: jest.fn(),
        setActiveSession: jest.fn(),
        setSummary: jest.fn(),
      } as never),
    );
    queryMock
      .mockReturnValue({
        data: undefined,
        isError: false,
        isLoading: false,
      } as unknown as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({ data: [] } as unknown as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: undefined,
        isError: false,
        isLoading: false,
      } as unknown as ReturnType<typeof useQuery>)
      .mockReturnValueOnce({
        data: undefined,
      } as unknown as ReturnType<typeof useQuery>);
  });

  it('shows a truthful charging flow and an accessible textual chart summary', () => {
    const screen = render(
      <Providers>
        <ActiveChargeScreen />
      </Providers>,
    );

    expect(screen.getByLabelText('Fluxo de recarga: energia, carregador e veículo')).toBeTruthy();
    expect(screen.getByText('A origem da energia não é inferida pela sessão.')).toBeTruthy();
    expect(
      screen.getByRole('image', {
        name: /Gráfico de potência com 1 medição.*máxima 42.5 quilowatts/,
      }),
    ).toBeTruthy();
    expect(screen.getByText(/Mín\. 42\.5 kW.*Máx\. 42\.5 kW/)).toBeTruthy();
  });

  it('announces realtime failures and exposes retry without hiding known data', async () => {
    jest.mocked(chargingRealtimeClient.subscribeError).mockImplementationOnce((listener) => {
      listener('Conexão instável.');
      return jest.fn();
    });
    const screen = render(
      <Providers>
        <ActiveChargeScreen />
      </Providers>,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Conexão instável. Os últimos dados conhecidos continuam visíveis.',
    );
    fireEvent.press(screen.getByRole('button', { name: 'Tentar reconectar' }));
    await waitFor(() => expect(chargingRealtimeClient.reconnect).toHaveBeenCalledTimes(1));
    expect(screen.getByText('8.40')).toBeTruthy();
  });

  it('keeps the operational navigation actions unchanged', () => {
    const screen = render(
      <Providers>
        <ActiveChargeScreen />
      </Providers>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Ver localização' }));
    expect(router.push).toHaveBeenCalledWith('/(tabs)/stations');
  });

  it('keeps station details truthful when optional metadata is absent', () => {
    const station: Station = {
      address: '',
      availableConnectors: 0,
      connectors: [],
      distanceKm: 0,
      hasParking: false,
      id: 'station-1',
      isOpen24Hours: false,
      latitude: -23.55,
      longitude: -46.63,
      maximumPowerKw: 0,
      name: 'Estação Centro',
      openingHours: '',
      operator: '',
      plugTypes: [],
      pricePerKwh: 0,
      rating: 0,
      status: 'OFFLINE',
      totalConnectors: 0,
    };
    queryMock.mockReset();
    queryMock.mockReturnValue({
      data: station,
      isError: false,
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const screen = render(
      <Providers>
        <StationDetailsScreen />
      </Providers>,
    );

    expect(screen.getAllByText('Endereço não informado')).not.toHaveLength(0);
    expect(
      screen.getByText('Os conectores desta estação ainda não foram informados.'),
    ).toBeTruthy();
    expect(screen.queryByLabelText(/Avaliação/)).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Iniciar recarga' }));
    expect(router.push).toHaveBeenCalledWith('/(tabs)/charge');
  });
});
