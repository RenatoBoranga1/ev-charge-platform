import { fireEvent, render } from '@testing-library/react-native';

import { AppButton } from '@/components/AppButton';
import { ThemeProvider } from '@/theme/ThemeProvider';

describe('AppButton', () => {
  it('exposes an accessible action and handles presses', () => {
    const onPress = jest.fn();
    const screen = render(
      <ThemeProvider>
        <AppButton
          label="Iniciar recarga"
          accessibilityHint="Valida os dados e solicita o início"
          onPress={onPress}
        />
      </ThemeProvider>,
    );

    const button = screen.getByRole('button', { name: 'Iniciar recarga' });
    expect(button.props.accessibilityHint).toBe(
      'Valida os dados e solicita o início',
    );

    fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('blocks interaction while disabled', () => {
    const onPress = jest.fn();
    const screen = render(
      <ThemeProvider>
        <AppButton label="Indisponível" disabled onPress={onPress} />
      </ThemeProvider>,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Indisponível' }));
    expect(onPress).not.toHaveBeenCalled();
  });
});
