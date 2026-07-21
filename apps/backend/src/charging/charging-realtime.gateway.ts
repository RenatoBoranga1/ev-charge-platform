import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';

import type { AuthUser } from '../auth/auth-user';
import { environment } from '../config/environment';
import { PrismaService } from '../database/prisma.service';
import {
  chargingSessionInclude,
  type ChargingSessionMetrics,
  toChargingSessionMetrics,
} from './charging-session.presenter';

interface ChargingServerToClientEvents {
  'charging:error': (payload: { message: string }) => void;
  'charging:metrics': (payload: ChargingSessionMetrics) => void;
}

interface AuthenticatedSocketData {
  user?: AuthUser;
}

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/charging',
  transports: ['websocket'],
})
export class ChargingRealtimeGateway {
  @WebSocketServer()
  private server!: Namespace<
    Record<string, never>,
    ChargingServerToClientEvents,
    Record<string, never>,
    AuthenticatedSocketData
  >;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(
    client: Socket<
      Record<string, never>,
      ChargingServerToClientEvents,
      Record<string, never>,
      AuthenticatedSocketData
    >,
  ): Promise<void> {
    const token =
      typeof client.handshake.auth.token === 'string'
        ? client.handshake.auth.token
        : undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      client.data.user = await this.jwt.verifyAsync<AuthUser>(token, {
        secret: environment.jwtAccessSecret,
      });
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('charging:subscribe')
  async subscribe(
    @ConnectedSocket()
    client: Socket<
      Record<string, never>,
      ChargingServerToClientEvents,
      Record<string, never>,
      AuthenticatedSocketData
    >,
    @MessageBody() payload: { sessionId?: string },
  ): Promise<void> {
    const user = client.data.user;
    if (!user || typeof payload.sessionId !== 'string') {
      client.disconnect(true);
      return;
    }

    const session = await this.prisma.chargingSession.findFirst({
      include: chargingSessionInclude,
      where: {
        deletedAt: null,
        id: payload.sessionId,
        userId: user.sub,
      },
    });
    if (!session) {
      client.emit('charging:error', { message: 'Session not found.' });
      return;
    }

    await client.join('charging-session:' + session.id);
    client.emit('charging:metrics', toChargingSessionMetrics(session));
  }

  publish(event: ChargingSessionMetrics): void {
    this.server
      ?.to('charging-session:' + event.sessionId)
      .emit('charging:metrics', event);
  }
}
