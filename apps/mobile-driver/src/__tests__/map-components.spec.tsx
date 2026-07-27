import { fireEvent, render } from '@testing-library/react-native';

import {
  getStationMarkerVisual,
  StationClusterMarker,
  StationMapMarker,
} from '@/components/StationMapMarker';
import { StationPreviewCard } from '@/components/StationPreviewCard';
import type { Station } from '@/types/domain';

const station: Station = {
  id: 'station-a',
  name: 'Estação Centro',
  address: '',
  latitude: -23.55,
  longitude: -46.63,
  distanceKm: 0.42,
  availableConnectors: 0,
  totalConnectors: 0,
  maximumPowerKw: 0,
  plugTypes: [],
  pricePerKwh: 0,
  rating: 0,
  openingHours: '',
  isOpen24Hours: false,
  hasParking: false,
  operator: '',
  status: 'OFFLINE',
  connectors: [],
};

describe('map components', () => {
  it.each([
    ['AVAILABLE', 'success'],
    ['PARTIAL', 'warning'],
    ['OCCUPIED', 'danger'],
    ['RESERVED', 'danger'],
    ['OFFLINE', 'neutral'],
    ['MAINTENANCE', 'neutral'],
    ['UNKNOWN', 'neutral'],
  ] as const)('maps %s to the %s visual tone', (status, tone) => {
    expect(getStationMarkerVisual(status).tone).toBe(tone);
    if (status !== 'UNKNOWN') {
      render(<StationMapMarker selected={false} status={status} />);
    }
  });

  it('announces connector availability and cluster size', () => {
    const marker = render(
      <StationMapMarker
        availableConnectors={2}
        selected
        status="AVAILABLE"
        totalConnectors={4}
      />,
    );
    expect(
      marker.getByLabelText(
        'Disponível. 2 de 4 conectores disponíveis.',
      ),
    ).toBeTruthy();
    const cluster = render(<StationClusterMarker count={7} />);
    expect(cluster.getByLabelText('Agrupamento com 7 estações')).toBeTruthy();
  });

  it('renders safe fallbacks for incomplete station metadata', () => {
    const onDetails = jest.fn();
    const onRoute = jest.fn();
    const screen = render(
      <StationPreviewCard
        station={station}
        onDetails={onDetails}
        onReserve={jest.fn()}
        onRoute={onRoute}
      />,
    );
    expect(screen.getByText('Conectores não informados')).toBeTruthy();
    expect(screen.getByText('Preço não informado')).toBeTruthy();
    expect(screen.getByText('Operador não informado')).toBeTruthy();
    fireEvent.press(screen.getByText('Detalhes'));
    fireEvent.press(screen.getByText('Traçar rota'));
    expect(onDetails).toHaveBeenCalledTimes(1);
    expect(onRoute).toHaveBeenCalledTimes(1);

    const unnamed = render(
      <StationPreviewCard
        station={{ ...station, name: '', address: 'Rua Central' }}
        onDetails={jest.fn()}
        onRoute={jest.fn()}
      />,
    );
    expect(unnamed.getByText('Estação sem nome')).toBeTruthy();
    expect(unnamed.getByText(/Rua Central/)).toBeTruthy();
  });

  it('renders rich metadata and selection or reservation actions', () => {
    const completeStation: Station = {
      ...station,
      status: 'AVAILABLE',
      availableConnectors: 2,
      totalConnectors: 4,
      maximumPowerKw: 150,
      pricePerKwh: 2.1,
      plugTypes: ['CCS2'],
      operator: 'Rede Solis',
      rating: 4.8,
      openingHours: '24 horas',
    };
    const onReserve = jest.fn();
    const reserveCard = render(
      <StationPreviewCard
        station={completeStation}
        onDetails={jest.fn()}
        onReserve={onReserve}
        onRoute={jest.fn()}
      />,
    );
    fireEvent.press(reserveCard.getByText('Reservar conector'));
    expect(onReserve).toHaveBeenCalledTimes(1);
    expect(reserveCard.getByText('CCS2')).toBeTruthy();

    const onSelect = jest.fn();
    const selectCard = render(
      <StationPreviewCard
        station={completeStation}
        onDetails={jest.fn()}
        onRoute={jest.fn()}
        onSelect={onSelect}
      />,
    );
    fireEvent.press(selectCard.getByText('Selecionar estação'));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
