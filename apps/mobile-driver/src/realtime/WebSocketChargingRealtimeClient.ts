import { io, type Socket } from 'socket.io-client';

import type {
  ChargingConnectionState,
  ChargingRealtimeClient,
} from './ChargingRealtimeClient';
import { tokenStorage } from '@/auth/token-storage';
import type { ChargingSessionRealtimeEvent } from '@/types/domain';

interface ServerEvents {
  'charging:error': (payload: { message: string }) => void;
  'charging:metrics': (event: ChargingSessionRealtimeEvent) => void;
}

interface ClientEvents {
  'charging:subscribe': (payload: { sessionId: string }) => void;
}

export class WebSocketChargingRealtimeClient implements ChargingRealtimeClient {
  private socket: Socket<ServerEvents, ClientEvents> | null = null;
  private sessionId: string | null = null;
  private connectionState: ChargingConnectionState = 'disconnected';
  private readonly listeners = new Set<
    (event: ChargingSessionRealtimeEvent) => void
  >();
  private readonly connectionListeners = new Set<
    (state: ChargingConnectionState) => void
  >();
  private readonly errorListeners = new Set<(message: string) => void>();

  constructor(private readonly baseUrl: string) {}

  async connect(sessionId: string): Promise<void> {
    this.socket?.disconnect();
    this.sessionId = sessionId;
    this.setConnectionState('connecting');

    const token = await tokenStorage.getAccessToken();
    if (!token) {
      this.setConnectionState('disconnected');
      throw new Error('Sessao expirada. Entre novamente.');
    }

    const endpoint = this.baseUrl
      .replace(/^ws:/, 'http:')
      .replace(/^wss:/, 'https:')
      .replace(/\/$/, '');
    const socket = io(endpoint + '/charging', {
      auth: { token },
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      transports: ['websocket'],
    });
    this.socket = socket;

    socket.on('charging:metrics', (event) => {
      this.listeners.forEach((listener) => listener(event));
    });
    socket.on('charging:error', ({ message }) => {
      this.setConnectionState('disconnected');
      this.errorListeners.forEach((listener) => listener(message));
      socket.disconnect();
    });
    socket.on('connect', () => {
      this.setConnectionState('connected');
      socket.emit('charging:subscribe', { sessionId });
    });
    socket.on('disconnect', () => {
      this.setConnectionState(socket.active ? 'reconnecting' : 'disconnected');
    });
    socket.io.on('reconnect_attempt', () => {
      this.setConnectionState('reconnecting');
    });

    await new Promise<void>((resolve, reject) => {
      const connected = () => {
        socket.off('connect_error', failed);
        resolve();
      };
      const failed = (error: Error) => {
        socket.off('connect', connected);
        this.setConnectionState(
          socket.active ? 'reconnecting' : 'disconnected',
        );
        reject(
          new Error(
            error.message ||
              'Nao foi possivel conectar as atualizacoes em tempo real.',
          ),
        );
      };
      socket.once('connect', connected);
      socket.once('connect_error', failed);
      socket.connect();
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.sessionId = null;
    this.setConnectionState('disconnected');
  }

  async reconnect(): Promise<void> {
    const sessionId = this.sessionId;
    if (!sessionId) throw new Error('Sessao nao selecionada para reconexao.');
    await this.connect(sessionId);
  }

  subscribe(
    listener: (event: ChargingSessionRealtimeEvent) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeConnection(
    listener: (state: ChargingConnectionState) => void,
  ): () => void {
    this.connectionListeners.add(listener);
    listener(this.connectionState);
    return () => this.connectionListeners.delete(listener);
  }

  subscribeError(listener: (message: string) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  private setConnectionState(state: ChargingConnectionState): void {
    this.connectionState = state;
    this.connectionListeners.forEach((listener) => listener(state));
  }
}
