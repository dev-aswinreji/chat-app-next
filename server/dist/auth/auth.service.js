"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const crypto_1 = require("crypto");
const supabase_service_1 = require("../supabase/supabase.service");
const auth_constants_1 = require("./auth.constants");
let AuthService = class AuthService {
    supabase;
    jwt;
    constructor(supabase, jwt) {
        this.supabase = supabase;
        this.jwt = jwt;
    }
    async signUp(dto, meta) {
        const { data: existing } = await this.supabase.db
            .from('users')
            .select('id')
            .eq('username', dto.username)
            .maybeSingle();
        if (existing) {
            throw new common_1.ConflictException('Username already taken');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const { data, error } = await this.supabase.db
            .from('users')
            .insert({
            username: dto.username,
            full_name: dto.fullName,
            password_hash: passwordHash,
            is_online: false,
        })
            .select('id, username, full_name')
            .single();
        if (error)
            throw new common_1.ConflictException(error.message);
        const { accessToken, refreshToken } = await this.issueTokens(data, meta);
        return { user: data, accessToken, refreshToken };
    }
    async signIn(dto, meta) {
        const { data, error } = await this.supabase.db
            .from('users')
            .select('id, username, full_name, password_hash')
            .eq('username', dto.username)
            .single();
        if (error || !data)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const valid = await bcrypt.compare(dto.password, data.password_hash);
        if (!valid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const { accessToken, refreshToken } = await this.issueTokens({ id: data.id, username: data.username, full_name: data.full_name }, meta);
        return {
            user: { id: data.id, username: data.username, full_name: data.full_name },
            accessToken,
            refreshToken,
        };
    }
    async refresh(refreshToken, meta) {
        if (!refreshToken)
            throw new common_1.UnauthorizedException('Missing refresh token');
        const tokenHash = this.hashToken(refreshToken);
        const { data: tokenRow } = await this.supabase.db
            .from('refresh_tokens')
            .select('*')
            .eq('token_hash', tokenHash)
            .maybeSingle();
        if (!tokenRow)
            throw new common_1.UnauthorizedException('Invalid refresh token');
        if (tokenRow.revoked_at) {
            await this.revokeFamily(tokenRow.family_id);
            throw new common_1.UnauthorizedException('Refresh token reuse detected');
        }
        if (new Date(tokenRow.expires_at) < new Date()) {
            await this.revokeToken(tokenRow.id);
            throw new common_1.UnauthorizedException('Refresh token expired');
        }
        const { data: user } = await this.supabase.db
            .from('users')
            .select('id, username, full_name')
            .eq('id', tokenRow.user_id)
            .single();
        if (!user)
            throw new common_1.UnauthorizedException('User not found');
        const { accessToken, refreshToken: newRefreshToken, newTokenId } = await this.rotateRefreshToken(user, tokenRow, meta);
        return { user, accessToken, refreshToken: newRefreshToken, newTokenId };
    }
    async logout(refreshToken) {
        if (!refreshToken)
            return;
        const tokenHash = this.hashToken(refreshToken);
        const { data: tokenRow } = await this.supabase.db
            .from('refresh_tokens')
            .select('id')
            .eq('token_hash', tokenHash)
            .maybeSingle();
        if (!tokenRow)
            return;
        await this.revokeToken(tokenRow.id);
    }
    async listSessions(userId) {
        const { data } = await this.supabase.db
            .from('refresh_tokens')
            .select('id, created_at, expires_at, ip, user_agent')
            .eq('user_id', userId)
            .is('revoked_at', null)
            .order('created_at', { ascending: false });
        return data || [];
    }
    async revokeSession(userId, sessionId) {
        await this.supabase.db
            .from('refresh_tokens')
            .update({ revoked_at: new Date().toISOString() })
            .eq('id', sessionId)
            .eq('user_id', userId);
    }
    async revokeAllSessions(userId) {
        await this.supabase.db
            .from('refresh_tokens')
            .update({ revoked_at: new Date().toISOString() })
            .eq('user_id', userId);
    }
    async getUserById(id) {
        const { data } = await this.supabase.db
            .from('users')
            .select('id, username, full_name')
            .eq('id', id)
            .single();
        return data;
    }
    async issueTokens(user, meta) {
        const accessToken = this.jwt.sign({ sub: user.id, username: user.username }, { expiresIn: auth_constants_1.ACCESS_TOKEN_TTL });
        const refreshToken = this.generateRefreshToken();
        const tokenHash = this.hashToken(refreshToken);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + auth_constants_1.REFRESH_TOKEN_TTL_DAYS * 86400000);
        const familyId = (0, crypto_1.randomUUID)();
        await this.supabase.db.from('refresh_tokens').insert({
            id: (0, crypto_1.randomUUID)(),
            user_id: user.id,
            token_hash: tokenHash,
            expires_at: expiresAt.toISOString(),
            created_at: now.toISOString(),
            revoked_at: null,
            replaced_by: null,
            family_id: familyId,
            ip: meta?.ip || null,
            user_agent: meta?.userAgent || null,
        });
        return { accessToken, refreshToken };
    }
    async rotateRefreshToken(user, oldTokenRow, meta) {
        const accessToken = this.jwt.sign({ sub: user.id, username: user.username }, { expiresIn: auth_constants_1.ACCESS_TOKEN_TTL });
        const newRefreshToken = this.generateRefreshToken();
        const newTokenId = (0, crypto_1.randomUUID)();
        const tokenHash = this.hashToken(newRefreshToken);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + auth_constants_1.REFRESH_TOKEN_TTL_DAYS * 86400000);
        await this.supabase.db.from('refresh_tokens').insert({
            id: newTokenId,
            user_id: user.id,
            token_hash: tokenHash,
            expires_at: expiresAt.toISOString(),
            created_at: now.toISOString(),
            revoked_at: null,
            replaced_by: null,
            family_id: oldTokenRow.family_id,
            ip: meta?.ip || null,
            user_agent: meta?.userAgent || null,
        });
        await this.supabase.db
            .from('refresh_tokens')
            .update({ revoked_at: now.toISOString(), replaced_by: newTokenId })
            .eq('id', oldTokenRow.id);
        return {
            accessToken,
            refreshToken: newRefreshToken,
            newTokenId,
        };
    }
    async revokeToken(id) {
        await this.supabase.db
            .from('refresh_tokens')
            .update({ revoked_at: new Date().toISOString() })
            .eq('id', id);
    }
    async revokeFamily(familyId) {
        await this.supabase.db
            .from('refresh_tokens')
            .update({ revoked_at: new Date().toISOString() })
            .eq('family_id', familyId);
    }
    hashToken(token) {
        return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
    }
    generateRefreshToken() {
        return (0, crypto_1.randomBytes)(64).toString('hex');
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService, jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map