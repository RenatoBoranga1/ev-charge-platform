import type { ApiClients } from './contracts';
import { createMockApiClients } from './mock-api';
import { createRestApiClients } from './rest-api';

function createApiClients(): ApiClients {
  const mode = process.env.EXPO_PUBLIC_API_MODE ?? 'mock';

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
