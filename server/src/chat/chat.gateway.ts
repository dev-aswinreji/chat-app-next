import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { SupabaseService } from '../supabase/supabase.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway {
  @WebSocketServer() server: Server;
  private onlineUsers = new Map<string, string>();
  private userSockets = new Map<string, string>();

  constructor(private jwt: JwtService, private supabase: SupabaseService) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    try {
      const payload = this.jwt.verify(token);
      const userId = payload.sub as string;
      this.onlineUsers.set(client.id, userId);
      this.userSockets.set(userId, client.id);
      await this.supabase.db
        .from('users')
        .update({ is_online: true })
        .eq('id', userId);
      this.server.emit('presence:update', { userId, isOnline: true });

      // send presence snapshot to the new client
      const snapshot = Array.from(this.userSockets.keys()).map((id) => ({
        userId: id,
        isOnline: true,
      }));
      client.emit('presence:sync', snapshot);

      // mark undelivered messages to this user as delivered
      const { data: undelivered } = await this.supabase.db
        .from('messages')
        .update({ status: 'delivered' })
        .eq('to_user_id', userId)
        .eq('status', 'sent')
        .select('id, from_user_id');

      undelivered?.forEach((m) => {
        const senderSocket = this.userSockets.get(m.from_user_id);
        if (senderSocket) {
          this.server.to(senderSocket).emit('message:delivered', {
            messageId: m.id,
          });
        }
      });
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = this.onlineUsers.get(client.id);
    if (userId) {
      this.onlineUsers.delete(client.id);
      this.userSockets.delete(userId);
      await this.supabase.db
        .from('users')
        .update({ is_online: false })
        .eq('id', userId);
      this.server.emit('presence:update', { userId, isOnline: false });
    }
  }

  @SubscribeMessage('message:send')
  async onMessage(
    @MessageBody() payload: { toUserId: string; text: string },
    @ConnectedSocket() client: Socket,
  ) {
    const fromUserId = this.onlineUsers.get(client.id);
    if (!fromUserId) return;
    const recipientSocket = this.userSockets.get(payload.toUserId);
    const status = recipientSocket ? 'delivered' : 'sent';
    const { data } = await this.supabase.db
      .from('messages')
      .insert({
        from_user_id: fromUserId,
        to_user_id: payload.toUserId,
        text: payload.text,
        status,
      })
      .select('*')
      .single();

    const msg = {
      id: data?.id ?? Date.now(),
      fromUserId,
      toUserId: payload.toUserId,
      text: payload.text,
      createdAt: data?.created_at ?? new Date().toISOString(),
      status: data?.status ?? status,
    };
    this.server.to(client.id).emit('message:new', msg);
    if (recipientSocket) {
      this.server.to(recipientSocket).emit('message:new', msg);
    }
  }

  @SubscribeMessage('message:read')
  async onRead(
    @MessageBody() payload: { messageId: number; fromUserId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const readerId = this.onlineUsers.get(client.id);
    if (!readerId) return;

    const { data: msg } = await this.supabase.db
      .from('messages')
      .select('id, created_at')
      .eq('id', payload.messageId)
      .maybeSingle();

    if (!msg) return;

    await this.supabase.db
      .from('messages')
      .update({ status: 'read' })
      .eq('from_user_id', payload.fromUserId)
      .eq('to_user_id', readerId)
      .lte('created_at', msg.created_at);

    await this.supabase.db.from('chat_reads').upsert({
      user_id: readerId,
      peer_id: payload.fromUserId,
      last_read_at: msg.created_at,
      updated_at: new Date().toISOString(),
    });

    const senderSocket = this.userSockets.get(payload.fromUserId);
    if (senderSocket) {
      this.server.to(senderSocket).emit('message:read', {
        readerId,
        readUpTo: msg.created_at,
      });
    }
  }

  @SubscribeMessage('typing:start')
  async onTypingStart(
    @MessageBody() payload: { toUserId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const fromUserId = this.onlineUsers.get(client.id);
    if (!fromUserId) return;
    const recipientSocket = this.userSockets.get(payload.toUserId);
    if (recipientSocket) {
      this.server.to(recipientSocket).emit('typing', {
        fromUserId,
        isTyping: true,
      });
    }
  }

  @SubscribeMessage('typing:stop')
  async onTypingStop(
    @MessageBody() payload: { toUserId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const fromUserId = this.onlineUsers.get(client.id);
    if (!fromUserId) return;
    const recipientSocket = this.userSockets.get(payload.toUserId);
    if (recipientSocket) {
      this.server.to(recipientSocket).emit('typing', {
        fromUserId,
        isTyping: false,
      });
    }
  }
}
