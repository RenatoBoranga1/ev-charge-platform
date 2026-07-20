import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { AuthProvider, getInitialRoute, useAuth } from '@/auth/AuthProvider';
import { tokenStorage } from '@/auth/token-storage';
import { api } from '@/api';

jest.mock('@/api', () => ({
  api: {
    auth: { login: jest.fn(), register: jest.fn() },
    users: { getMe: jest.fn() },
  },
}));

jest.mock('@/auth/token-storage', () => ({
  tokenStorage: {
    clearTokens: jest.fn(),
    getTokens: jest.fn(),
    setTokens: jest.fn(),
  },
}));

const profile = {
  avoidedCo2Kg: 0,
  chargingSessions: 0,
  email: 'driver@example.com',
  estimatedSavings: 0,
  id: 'user-1',
  name: 'Driver',
  totalEnergyKwh: 0,
};

function Harness() {
  const auth = useAuth();
  return (
    <>
      <Text testID="status">
        {auth.isLoading ? 'loading' : auth.user?.email ?? 'anonymous'}
      </Text>
      <Pressable
        testID="login"
        onPress={() =>
          void auth.signIn({ email: profile.email, password: 'password' })
        }
      />
      <Pressable testID="logout" onPress={() => void auth.signOut()} />
    </>
  );
}

describe('AuthProvider', () => {
  it('selects public and private initial routes', () => {
    expect(getInitialRoute(false)).toBe('/(auth)/login');
    expect(getInitialRoute(true)).toBe('/(tabs)/stations');
  });

  it('restores, creates and clears a secure session', async () => {
    jest.mocked(tokenStorage.getTokens).mockResolvedValue(null);
    jest.mocked(api.auth.login).mockResolvedValue({
      tokens: { accessToken: 'access', refreshToken: 'refresh' },
      user: profile,
    });

    const screen = render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));

    fireEvent.press(screen.getByTestId('login'));
    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent(profile.email),
    );
    expect(tokenStorage.setTokens).toHaveBeenCalledWith({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    fireEvent.press(screen.getByTestId('logout'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(tokenStorage.clearTokens).toHaveBeenCalled();
  });

  it('clears invalid persisted tokens', async () => {
    jest.mocked(tokenStorage.getTokens).mockResolvedValue({
      accessToken: 'expired',
      refreshToken: 'expired',
    });
    jest.mocked(api.users.getMe).mockRejectedValue(new Error('expired'));

    const screen = render(
      <AuthProvider>
        <Harness />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(tokenStorage.clearTokens).toHaveBeenCalled();
  });
});
