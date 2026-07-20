import { render } from '@testing-library/react-native';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AppLogger } from '@/logging/AppLogger';

jest.mock('@/logging/AppLogger', () => ({
  AppLogger: { error: jest.fn() },
}));

function Broken(): never {
  throw new Error('render failed');
}

describe('AppErrorBoundary', () => {
  it('logs render failures and presents a recoverable global fallback', () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const screen = render(
      <AppErrorBoundary>
        <Broken />
      </AppErrorBoundary>,
    );

    expect(screen.getByText('Algo saiu do esperado')).toBeTruthy();
    expect(AppLogger.error).toHaveBeenCalledWith(
      'ui.error-boundary.caught',
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
    consoleError.mockRestore();
  });
});
