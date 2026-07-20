import * as SecureStore from 'expo-secure-store';

import { tokenStorage } from '@/auth/token-storage';

jest.mock('expo-secure-store', () => ({
  deleteItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const getItemAsync = jest.mocked(SecureStore.getItemAsync);
const setItemAsync = jest.mocked(SecureStore.setItemAsync);
const deleteItemAsync = jest.mocked(SecureStore.deleteItemAsync);

describe('tokenStorage', () => {
  it('returns both tokens only when the secure pair is complete', async () => {
    getItemAsync
      .mockResolvedValueOnce('access')
      .mockResolvedValueOnce('refresh');
    await expect(tokenStorage.getTokens()).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    getItemAsync.mockResolvedValueOnce('access').mockResolvedValueOnce(null);
    await expect(tokenStorage.getTokens()).resolves.toBeNull();
  });

  it('writes and clears both token keys through SecureStore', async () => {
    await tokenStorage.setTokens({
      accessToken: 'access',
      refreshToken: 'refresh',
    });
    expect(setItemAsync).toHaveBeenCalledWith('solis.access-token', 'access');
    expect(setItemAsync).toHaveBeenCalledWith('solis.refresh-token', 'refresh');

    await tokenStorage.clearTokens();
    expect(deleteItemAsync).toHaveBeenCalledWith('solis.access-token');
    expect(deleteItemAsync).toHaveBeenCalledWith('solis.refresh-token');
  });
});
