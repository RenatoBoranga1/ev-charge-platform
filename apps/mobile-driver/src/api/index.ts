import type { ApiClients } from './contracts';
import { createMockApiClients } from './mock-api';
import { createRestApiClients } from './rest-api';
import { getApiMode } from '@/config/runtime';

function createApiClients(): ApiClients {
  const mode = getApiMode();

  if (mode === 'mock') {
    return createMockApiClients();
  }

  if (mode === 'api') {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) {
      throw new Error('EXPO_PUBLIC_API_URL é obrigatória quando EXPO_PUBLIC_API_MODE=api.');
    }
    return createRestApiClients(apiUrl);
  }

  throw new Error(`EXPO_PUBLIC_API_MODE inválido: ${mode}`);
}

export const api = createApiClients();
export type { ApiClients } from './contracts';
