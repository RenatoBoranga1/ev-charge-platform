import { act, fireEvent, render } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';
import {
  SafeAreaProvider,
  type Metrics,
} from 'react-native-safe-area-context';

import {
  Avatar,
  Badge,
  BottomSheet,
  Card,
  Chip,
  FAB,
  FeedbackProvider,
  NavigationBar,
  OutlinedButton,
  PrimaryButton,
  SearchBar,
  SecondaryButton,
  Snackbar,
  Surface,
  Tag,
  Toast,
  useFeedback,
} from '@/design-system';
import { usePreferencesStore } from '@/stores/preferences-store';
import { ThemeProvider, useAppTheme } from '@/theme/ThemeProvider';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
};

function TestProviders({ children }: PropsWithChildren) {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>{children}</ThemeProvider>
    </SafeAreaProvider>
  );
}

describe('Solis design system', () => {
  beforeEach(() => {
    usePreferencesStore.setState({
      themeMode: 'light',
      dynamicColorSeed: 'solis',
    });
  });

  it('keeps all button variants accessible and interactive', () => {
    const onPress = jest.fn();
    const screen = render(
      <TestProviders>
        <PrimaryButton label="Primário" onPress={onPress} />
        <SecondaryButton label="Secundário" onPress={onPress} />
        <OutlinedButton label="Contorno" onPress={onPress} />
        <FAB accessibilityLabel="Adicionar" icon="add" onPress={onPress} />
      </TestProviders>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Primário' }));
    fireEvent.press(screen.getByRole('button', { name: 'Secundário' }));
    fireEvent.press(screen.getByRole('button', { name: 'Contorno' }));
    fireEvent.press(screen.getByRole('button', { name: 'Adicionar' }));
    expect(onPress).toHaveBeenCalledTimes(4);
  });

  it('supports search, chips, tags, badges, avatars and surfaces', () => {
    const onChangeText = jest.fn();
    const onChipPress = jest.fn();
    const onRemove = jest.fn();
    const screen = render(
      <TestProviders>
        <SearchBar
          onChangeText={onChangeText}
          placeholder="Pesquisar"
          value="Solis"
        />
        <Chip
          label="Rápida"
          onPress={onChipPress}
          onRemove={onRemove}
          selected
        />
        <Tag label="Online" tone="success" />
        <Badge value={120} />
        <Avatar name="Julio Greca" />
        <Surface rounded>
          <Text>Superfície</Text>
        </Surface>
        <Card>
          <Text>Cartão</Text>
        </Card>
      </TestProviders>,
    );

    fireEvent.changeText(screen.getByLabelText('Pesquisar'), 'Recarga');
    fireEvent.press(screen.getByRole('button', { name: 'Limpar pesquisa' }));
    fireEvent.press(screen.getByText('Rápida'));
    fireEvent.press(
      screen.getAllByRole('button', { name: 'Remover Rápida' })[0]!,
    );

    expect(onChangeText).toHaveBeenCalledWith('Recarga');
    expect(onChangeText).toHaveBeenCalledWith('');
    expect(onChipPress).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.getByText('99+')).toBeTruthy();
    expect(screen.getByText('JG')).toBeTruthy();
  });

  it('renders feedback, bottom sheet and navigation semantics', () => {
    const onDismiss = jest.fn();
    const onSelect = jest.fn();
    const screen = render(
      <TestProviders>
        <Snackbar message="Sessão iniciada" visible onDismiss={onDismiss} />
        <Toast message="Preferências salvas" visible tone="success" />
        <BottomSheet visible title="Filtros" onDismiss={onDismiss}>
          <Text>Conteúdo do painel</Text>
        </BottomSheet>
        <NavigationBar
          activeKey="charge"
          items={[
            { key: 'stations', label: 'Estações', icon: 'location-outline' },
            { key: 'charge', label: 'Recarga', icon: 'flash-outline' },
          ]}
          onSelect={onSelect}
        />
      </TestProviders>,
    );

    expect(screen.getByText('Sessão iniciada')).toBeTruthy();
    expect(screen.getByText('Preferências salvas')).toBeTruthy();
    expect(screen.getByText('Conteúdo do painel')).toBeTruthy();
    fireEvent.press(screen.getByText('Estações'));
    expect(onSelect).toHaveBeenCalledWith('stations');
  });

  it('persists mode and dynamic seed through the existing preference store', () => {
    function ThemeProbe() {
      const theme = useAppTheme();
      return (
        <View>
          <Text>{theme.mode}</Text>
          <Text>{theme.dynamicColorSeed}</Text>
        </View>
      );
    }

    const screen = render(
      <TestProviders>
        <ThemeProbe />
      </TestProviders>,
    );
    expect(screen.getByText('light')).toBeTruthy();
    expect(screen.getByText('solis')).toBeTruthy();

    act(() => {
      usePreferencesStore.getState().setThemeMode('dark');
      usePreferencesStore.getState().setDynamicColorSeed('ocean');
    });
    expect(usePreferencesStore.getState()).toMatchObject({
      themeMode: 'dark',
      dynamicColorSeed: 'ocean',
    });
  });

  it('offers app-level imperative feedback without coupling screens to hosts', () => {
    function FeedbackHarness() {
      const feedback = useFeedback();
      return (
        <PrimaryButton
          label="Salvar"
          onPress={() => feedback.showToast('Salvo', { tone: 'success' })}
        />
      );
    }

    const screen = render(
      <TestProviders>
        <FeedbackProvider>
          <FeedbackHarness />
        </FeedbackProvider>
      </TestProviders>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText('Salvo')).toBeTruthy();
  });
});
