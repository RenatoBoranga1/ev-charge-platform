import {
  fireEvent,
  render,
  waitFor,
} from '@testing-library/react-native';

import { ProfileForm } from '@/components/ProfileForm';
import { ProfileSettingsForm } from '@/components/ProfileSettingsForm';
import { VehicleCard } from '@/components/VehicleCard';
import { VehicleEmptyState } from '@/components/VehicleEmptyState';
import { VehicleForm } from '@/components/VehicleForm';
import { mockProfile, mockVehicles } from '@/mocks/data';
import { ThemeProvider } from '@/theme/ThemeProvider';

describe('profile and garage forms', () => {
  it('validates and submits the complete profile through accessible fields', async () => {
    const onSubmit = jest.fn();
    const screen = render(
      <ThemeProvider>
        <ProfileForm profile={mockProfile} onSubmit={onSubmit} />
      </ThemeProvider>,
    );

    fireEvent.changeText(screen.getByLabelText('Nome'), 'A');
    fireEvent.changeText(screen.getByLabelText('E-mail'), 'invalid');
    fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByText('Informe seu nome.')).toBeTruthy();
    expect(await screen.findByText('Informe um e-mail válido.')).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText('Nome'), 'Ana');
    fireEvent.changeText(screen.getByLabelText('E-mail'), 'ana@solis.local');
    fireEvent.changeText(
      screen.getByLabelText('URL da foto'),
      'https://cdn.solis.local/ana.png',
    );
    fireEvent.press(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          avatarUrl: 'https://cdn.solis.local/ana.png',
          email: 'ana@solis.local',
          firstName: 'Ana',
          recordVersion: mockProfile.recordVersion,
        }),
      ),
    );
  });

  it('submits theme, notification, data and privacy preferences', async () => {
    const onSubmit = jest.fn();
    const screen = render(
      <ThemeProvider>
        <ProfileSettingsForm profile={mockProfile} onSubmit={onSubmit} />
      </ThemeProvider>,
    );

    fireEvent.press(screen.getByText('Escuro'));
    fireEvent(
      screen.getByLabelText('Novidades e promoções'),
      'valueChange',
      true,
    );
    fireEvent(
      screen.getByLabelText('Economia de dados'),
      'valueChange',
      true,
    );
    fireEvent(
      screen.getByLabelText('Compartilhar métricas anônimas'),
      'valueChange',
      true,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Salvar preferências' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          notifications: expect.objectContaining({ promotions: true }),
          preferences: { dataSaver: true },
          privacy: expect.objectContaining({ analyticsConsent: true }),
          recordVersion: mockProfile.recordVersion,
          theme: 'DARK',
        }),
      ),
    );
  });

  it('validates steps and submits a complete hybrid vehicle', async () => {
    const onSubmit = jest.fn();
    const screen = render(
      <ThemeProvider>
        <VehicleForm submitLabel="Salvar veículo" onSubmit={onSubmit} />
      </ThemeProvider>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
    expect(await screen.findByText('Informe um apelido.')).toBeTruthy();

    fireEvent.changeText(screen.getByLabelText('Apelido'), 'Meu híbrido');
    fireEvent.changeText(screen.getByLabelText('Fabricante'), 'Solis');
    fireEvent.changeText(screen.getByLabelText('Modelo'), 'Hybrid');
    fireEvent.changeText(screen.getByLabelText('Ano'), '2026');
    fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('Energia e autonomia')).toBeTruthy();
    fireEvent.press(screen.getByText('Híbrido'));
    fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByText('Compatibilidade e preferência')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Placa opcional'), 'TST9A99');
    fireEvent.changeText(
      screen.getByLabelText('VIN opcional'),
      '9BWZZZ377VT004251',
    );
    fireEvent.changeText(screen.getByLabelText('Observações'), 'Teste');
    fireEvent.press(screen.getByText('Inativo'));
    fireEvent.press(screen.getByRole('button', { name: 'Salvar veículo' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          brand: 'Solis',
          licensePlate: 'TST9A99',
          nickname: 'Meu híbrido',
          status: 'INACTIVE',
          vehicleType: 'HEV',
          vin: '9BWZZZ377VT004251',
        }),
      ),
    );
  });

  it('renders accessible vehicle cards and empty garage actions', () => {
    const onPress = jest.fn();
    const onAdd = jest.fn();
    const vehicle = {
      ...mockVehicles[0]!,
      licensePlate: 'BRA2E19',
    };
    const screen = render(
      <ThemeProvider>
        <VehicleCard vehicle={vehicle} onPress={onPress} />
        <VehicleEmptyState onAdd={onAdd} />
      </ThemeProvider>,
    );

    const card = screen.getByRole('button', {
      name: /Aurora da Marina.*veículo principal/,
    });
    expect(card.props.accessibilityHint).toBe('Abre os detalhes do veículo');
    expect(screen.getByText('Placa BR•••19')).toBeTruthy();
    fireEvent.press(card);
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar veículo' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('uses the filtered empty-state action and preserves initial vehicle values', async () => {
    const onSubmit = jest.fn();
    const onClear = jest.fn();
    const initial = mockVehicles[0]!;
    const screen = render(
      <ThemeProvider>
        <VehicleEmptyState filtered onAdd={onClear} />
        <VehicleForm
          initial={initial}
          submitLabel="Atualizar veículo"
          onSubmit={onSubmit}
        />
      </ThemeProvider>,
    );

    expect(screen.getByDisplayValue(initial.nickname)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Limpar filtros' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
