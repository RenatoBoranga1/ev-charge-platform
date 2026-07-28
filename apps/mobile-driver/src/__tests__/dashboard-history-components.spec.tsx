import { fireEvent, render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { View } from 'react-native';

import {
  Co2SummaryCard,
  DashboardEmptyState,
  SavingsSummaryCard,
} from '@/dashboard/DashboardComponents';
import {
  ChargingHistoryErrorState,
  ChargingHistoryItem,
  ChargingSessionEnergyChart,
} from '@/history/ChargingHistoryComponents';
import { ThemeProvider } from '@/theme/ThemeProvider';
import type {
  ChargingHistoryItem as HistoryItem,
  ChargingSessionMetricsData,
} from '@/types/domain';

function Providers({ children }: PropsWithChildren) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

const completedSession: HistoryItem = {
  connector: {
    id: 'connector-1',
    label: 'CCS2 · 150 kW',
    type: 'ccs2',
  },
  cost: { amount: '53.87', currency: 'BRL' },
  durationSeconds: 2520,
  endedAt: '2026-07-12T19:12:00.000Z',
  energyKwh: 24.6,
  failureReason: null,
  id: 'session-1',
  startedAt: '2026-07-12T18:30:00.000Z',
  station: {
    city: 'São Paulo',
    id: 'station-1',
    name: 'Solis Centro',
  },
  status: 'completed',
  vehicle: {
    brand: 'Solis',
    id: 'vehicle-1',
    model: 'E1',
    nickname: 'Aurora',
  },
};

describe('dashboard and history components', () => {
  it('exposes a concise accessible history item and opens details', () => {
    const onPress = jest.fn();
    const screen = render(
      <Providers>
        <ChargingHistoryItem item={completedSession} onPress={onPress} />
      </Providers>,
    );

    const card = screen.getByLabelText(/Solis Centro.*24.6 quilowatt-hora.*Concluída/);
    fireEvent.press(card);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/R\$/)).toBeTruthy();
  });

  it('hides cost, savings and CO2 when the backend has no reliable value', () => {
    const screen = render(
      <Providers>
        <View>
          <ChargingHistoryItem item={{ ...completedSession, cost: null }} onPress={jest.fn()} />
          <SavingsSummaryCard value={null} />
          <Co2SummaryCard value={null} />
        </View>
      </Providers>,
    );

    expect(screen.queryByText(/R\$/)).toBeNull();
    expect(screen.queryByText(/Economia estimada/)).toBeNull();
    expect(screen.queryByText(/CO₂ evitado/)).toBeNull();
  });

  it('provides retry and useful empty-dashboard actions', () => {
    const onRetry = jest.fn();
    const onMap = jest.fn();
    const screen = render(
      <Providers>
        <ChargingHistoryErrorState message="Sem conexão" onRetry={onRetry} />
        <DashboardEmptyState onMap={onMap} />
      </Providers>,
    );

    fireEvent.press(screen.getByText('Tentar novamente'));
    fireEvent.press(screen.getByText('Encontrar uma estação'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onMap).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('renders a textual metrics fallback and an accessible chart', () => {
    const empty: ChargingSessionMetricsData = {
      points: [],
      sessionId: 'session-1',
      summary: {
        averagePowerKw: null,
        maximumPowerKw: null,
        originalPointCount: 0,
        returnedPointCount: 0,
      },
    };
    const chart: ChargingSessionMetricsData = {
      points: [
        {
          accumulatedEnergyKwh: 1,
          powerKw: 40,
          sampledAt: '2026-07-12T18:30:00.000Z',
        },
        {
          accumulatedEnergyKwh: 2,
          powerKw: 50,
          sampledAt: '2026-07-12T18:31:00.000Z',
        },
      ],
      sessionId: 'session-1',
      summary: {
        averagePowerKw: 45,
        maximumPowerKw: 50,
        originalPointCount: 2,
        returnedPointCount: 2,
      },
    };
    const screen = render(
      <Providers>
        <ChargingSessionEnergyChart data={empty} />
        <ChargingSessionEnergyChart data={chart} />
      </Providers>,
    );

    expect(screen.getByText(/medições históricas suficientes/)).toBeTruthy();
    expect(
      screen.getByRole('image', {
        name: /Gráfico com 2 pontos.*Potência máxima 50/,
      }),
    ).toBeTruthy();
  });
});
