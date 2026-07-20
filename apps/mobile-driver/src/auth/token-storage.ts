import * as SecureStore from 'expo-secure-store';

import type { AuthTokens } from '@/types/domain';

const accessTokenKey = 'solis.access-token';
const refreshTokenKey = 'solis.refresh-token';

export const tokenStorage = {
  getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(accessTokenKey);
  },

  getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(refreshTokenKey);
  },

  async getTokens(): Promise<AuthTokens | null> {
    const [accessToken, refreshToken] = await Promise.all([
      this.getAccessToken(),
      this.getRefreshToken(),
    ]);

    if (!accessToken || !refreshToken) return null;
    return { accessToken, refreshToken };
  },

  async setTokens(tokens: AuthTokens): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(accessTokenKey, tokens.accessToken),
      SecureStore.setItemAsync(refreshTokenKey, tokens.refreshToken),
    ]);
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(accessTokenKey),
      SecureStore.deleteItemAsync(refreshTokenKey),
    ]);
  },
};
