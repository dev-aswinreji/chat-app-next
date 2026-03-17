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
exports.MessagesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const supabase_service_1 = require("../supabase/supabase.service");
const messages_dto_1 = require("./messages.dto");
let MessagesController = class MessagesController {
    supabase;
    constructor(supabase) {
        this.supabase = supabase;
    }
    async list(userId, withUserId) {
        const { data } = await this.supabase.db
            .from('messages')
            .select('*')
            .or(`and(from_user_id.eq.${userId},to_user_id.eq.${withUserId}),and(from_user_id.eq.${withUserId},to_user_id.eq.${userId})`)
            .order('created_at', { ascending: true });
        return data || [];
    }
    async markRead(dto, req) {
        const user = req.user;
        const { data: last } = await this.supabase.db
            .from('messages')
            .select('id, created_at')
            .eq('from_user_id', dto.withUserId)
            .eq('to_user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!last)
            return { ok: true };
        await this.supabase.db
            .from('messages')
            .update({ status: 'read' })
            .eq('from_user_id', dto.withUserId)
            .eq('to_user_id', user.id)
            .lte('created_at', last.created_at);
        await this.supabase.db
            .from('chat_reads')
            .upsert({
            user_id: user.id,
            peer_id: dto.withUserId,
            last_read_at: last.created_at,
            updated_at: new Date().toISOString(),
        });
        return { ok: true, readUpTo: last.created_at };
    }
    async lastSeen(withUserId, req) {
        const user = req.user;
        const { data } = await this.supabase.db
            .from('chat_reads')
            .select('last_read_at')
            .eq('user_id', withUserId)
            .eq('peer_id', user.id)
            .maybeSingle();
        return {
            userId: user.id,
            withUserId,
            lastReadAt: data?.last_read_at ?? null,
        };
    }
    async unreadCounts(req) {
        const user = req.user;
        const { data } = await this.supabase.db
            .from('unread_counts')
            .select('from_user_id, unread_count')
            .eq('to_user_id', user.id);
        return (data || []).map((row) => ({
            fromUserId: row.from_user_id,
            unreadCount: row.unread_count,
        }));
    }
};
exports.MessagesController = MessagesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('userId')),
    __param(1, (0, common_1.Query)('withUserId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)('read'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiBody)({ type: messages_dto_1.MarkReadDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [messages_dto_1.MarkReadDto, Object]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "markRead", null);
__decorate([
    (0, common_1.Get)('last-seen'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOkResponse)({ type: messages_dto_1.LastSeenResponseDto }),
    __param(0, (0, common_1.Query)('withUserId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "lastSeen", null);
__decorate([
    (0, common_1.Get)('unread-counts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOkResponse)({ type: [messages_dto_1.UnreadCountDto] }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "unreadCounts", null);
exports.MessagesController = MessagesController = __decorate([
    (0, swagger_1.ApiTags)('messages'),
    (0, common_1.Controller)('messages'),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService])
], MessagesController);
//# sourceMappingURL=messages.controller.js.map