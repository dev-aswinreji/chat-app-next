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
        await this.supabase.db
            .from('messages')
            .update({ status: 'read' })
            .eq('id', payload.messageId);
        const senderSocket = this.userSockets.get(payload.fromUserId);
        if (senderSocket) {
            this.server.to(senderSocket).emit('message:read', {
                messageId: payload.messageId,
                readerId,
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
exports.ChatGateway = ChatGateway = __decorate([
    (0, websockets_1.WebSocketGateway)({ cors: { origin: '*' } }),
    __metadata("design:paramtypes", [jwt_1.JwtService, supabase_service_1.SupabaseService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map