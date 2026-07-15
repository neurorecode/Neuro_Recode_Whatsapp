import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import {
  SOCKET_NAMESPACE,
  MessageEvent,
  MessageStatusEvent,
  ConversationEvent,
} from '@nrw/shared';

/**
 * Real-time channel for agents. Authenticates the handshake with the same JWT
 * used for the REST API, then lets agents subscribe to individual conversation
 * rooms. Inbound WhatsApp messages and status updates are pushed here.
 */
@WebSocketGateway({
  namespace: SOCKET_NAMESPACE,
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  // Room every authenticated agent joins, for broadcast-to-all-agents events.
  private static readonly AGENTS_ROOM = 'agents';

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query?.token as string);
      if (!token) throw new Error('missing token');
      const payload = await this.jwt.verifyAsync(token);
      client.data.agentId = payload.sub;
      client.join(RealtimeGateway.AGENTS_ROOM);
      this.logger.debug(`agent connected: ${payload.sub} (${client.id})`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`socket disconnected: ${client.id}`);
  }

  @SubscribeMessage('conversation:subscribe')
  onSubscribe(@ConnectedSocket() client: Socket, @MessageBody() conversationId: string) {
    client.join(`conv:${conversationId}`);
  }

  @SubscribeMessage('conversation:unsubscribe')
  onUnsubscribe(@ConnectedSocket() client: Socket, @MessageBody() conversationId: string) {
    client.leave(`conv:${conversationId}`);
  }

  // ---- server-side emit helpers (called by services) ----

  emitNewMessage(event: MessageEvent) {
    this.server.to(RealtimeGateway.AGENTS_ROOM).emit('message:new', event);
    this.server.to(`conv:${event.conversationId}`).emit('message:new', event);
  }

  emitMessageStatus(event: MessageStatusEvent) {
    this.server.to(RealtimeGateway.AGENTS_ROOM).emit('message:status', event);
  }

  emitConversationUpdated(event: ConversationEvent) {
    this.server.to(RealtimeGateway.AGENTS_ROOM).emit('conversation:updated', event);
  }
}
