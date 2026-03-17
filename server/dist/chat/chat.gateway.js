"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const jwt_1 = require("@nestjs/jwt");
const socket_io_1 = require("socket.io");
const supabase_service_1 = require("../supabase/supabase.service");
let ChatGateway = class ChatGateway {
    jwt;
    supabase;
    server;
    onlineUsers = new Map();
    userSockets = new Map();
    constructor(jwt, supabase) {
        this.jwt = jwt;
        this.supabase = supabase;
    }
    async handleConnection(client) {
        const token = client.handshake.auth?.token;
        try {
            const payload = this.jwt.verify(token);
            const userId = payload.sub;
            this.onlineUsers.set(client.id, userId);
            this.userSockets.set(userId, client.id);
            await this.supabase.db
                .from('users')
                .update({ is_online: true })
                .eq('id', userId);
            this.server.emit('presence:update', { userId, isOnline: true });
            const snapshot = Array.from(this.userSockets.keys()).map((id) => ({
                userId: id,
                isOnline: true,
            }));
            client.emit('presence:sync', snapshot);
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
        }
        catch {
            client.disconnect();
        }
    }
    async handleDisconnect(client) {
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
    async onMessage(payload, client) {
        const fromUserId = this.onlineUsers.get(client.id);
        if (!fromUserId)
            return;
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
    async onRead(payload, client) {
        const readerId = this.onlineUsers.get(client.id);
        if (!readerId)
            return;
        const { data: msg } = await this.supabase.db
            .from('messages')
            .select('id, created_at')
            .eq('id', payload.messageId)
            .maybeSingle();
        if (!msg)
            return;
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
    async onTypingStart(payload, client) {
        const fromUserId = this.onlineUsers.get(client.id);
        if (!fromUserId)
            return;
        const recipientSocket = this.userSockets.get(payload.toUserId);
        if (recipientSocket) {
            this.server.to(recipientSocket).emit('typing', {
                fromUserId,
                isTyping: true,
            });
        }
    }
    async onTypingStop(payload, client) {
        const fromUserId = this.onlineUsers.get(client.id);
        if (!fromUserId)
            return;
        const recipientSocket = this.userSockets.get(payload.toUserId);
        if (recipientSocket) {
            this.server.to(recipientSocket).emit('typing', {
                fromUserId,
                isTyping: false,
            });
        }
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('message:send'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "onMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('message:read'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "onRead", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing:start'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "onTypingStart", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing:stop'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "onTypingStop", null);
exports.ChatGateway = ChatGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    __metadata("design:paramtypes", [jwt_1.JwtService, supabase_service_1.SupabaseService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map