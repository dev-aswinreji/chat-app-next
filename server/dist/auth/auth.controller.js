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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_dto_1 = require("./auth.dto");
const auth_service_1 = require("./auth.service");
const auth_constants_1 = require("./auth.constants");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
let AuthController = class AuthController {
    auth;
    constructor(auth) {
        this.auth = auth;
    }
    signUp(dto, req, res) {
        return this.auth.signUp(dto, this.getMeta(req)).then((result) => {
            if ('refreshToken' in result) {
                this.setRefreshCookie(res, result.refreshToken);
            }
            return { user: result.user, accessToken: result.accessToken };
        });
    }
    signIn(dto, req, res) {
        return this.auth.signIn(dto, this.getMeta(req)).then((result) => {
            this.setRefreshCookie(res, result.refreshToken);
            return { user: result.user, accessToken: result.accessToken };
        });
    }
    async refresh(req, res) {
        const token = req.cookies?.[auth_constants_1.REFRESH_COOKIE_NAME];
        const result = await this.auth.refresh(token, this.getMeta(req));
        this.setRefreshCookie(res, result.refreshToken);
        return { user: result.user, accessToken: result.accessToken };
    }
    async logout(req, res) {
        const token = req.cookies?.[auth_constants_1.REFRESH_COOKIE_NAME];
        await this.auth.logout(token);
        res.clearCookie(auth_constants_1.REFRESH_COOKIE_NAME, this.getCookieOptions());
        return { ok: true };
    }
    async me(req) {
        const user = req.user;
        return this.auth.getUserById(user.id);
    }
    async sessions(req) {
        const user = req.user;
        return this.auth.listSessions(user.id);
    }
    async revokeAll(req) {
        const user = req.user;
        await this.auth.revokeAllSessions(user.id);
        return { ok: true };
    }
    async revoke(req, body) {
        const user = req.user;
        await this.auth.revokeSession(user.id, body.sessionId);
        return { ok: true };
    }
    setRefreshCookie(res, token) {
        res.cookie(auth_constants_1.REFRESH_COOKIE_NAME, token, {
            ...this.getCookieOptions(),
            maxAge: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7) * 86400000,
        });
    }
    getCookieOptions() {
        return {
            httpOnly: true,
            secure: process.env.COOKIE_SECURE === 'true',
            sameSite: process.env.COOKIE_SAMESITE || 'strict',
            path: '/auth',
        };
    }
    getMeta(req) {
        return {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('signup'),
    (0, swagger_1.ApiBody)({ type: auth_dto_1.SignUpDto }),
    (0, swagger_1.ApiOkResponse)({ type: auth_dto_1.AuthResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.SignUpDto, Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "signUp", null);
__decorate([
    (0, common_1.Post)('login'),
    (0, swagger_1.ApiBody)({ type: auth_dto_1.SignInDto }),
    (0, swagger_1.ApiOkResponse)({ type: auth_dto_1.AuthResponseDto }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [auth_dto_1.SignInDto, Object, Object]),
    __metadata("design:returntype", void 0)
], AuthController.prototype, "signIn", null);
__decorate([
    (0, common_1.Post)('refresh'),
    (0, swagger_1.ApiCookieAuth)('refresh_token'),
    (0, swagger_1.ApiOkResponse)({ type: auth_dto_1.AuthResponseDto }),
    (0, swagger_1.ApiUnauthorizedResponse)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refresh", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, swagger_1.ApiCookieAuth)('refresh_token'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOkResponse)({ type: auth_dto_1.MeResponseDto }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Get)('sessions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOkResponse)({ type: [auth_dto_1.SessionDto] }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "sessions", null);
__decorate([
    (0, common_1.Post)('sessions/revoke-all'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "revokeAll", null);
__decorate([
    (0, common_1.Post)('sessions/revoke'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiBody)({ schema: { properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "revoke", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map