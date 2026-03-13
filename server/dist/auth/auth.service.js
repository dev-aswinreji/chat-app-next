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
const supabase_service_1 = require("../supabase/supabase.service");
let AuthService = class AuthService {
    supabase;
    jwt;
    constructor(supabase, jwt) {
        this.supabase = supabase;
        this.jwt = jwt;
    }
    async signUp(dto) {
        const { data: existing } = await this.supabase.db
            .from('users')
            .select('id')
            .eq('username', dto.username)
            .maybeSingle();
        if (existing) {
            return { error: 'Username already taken' };
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
            return { error: error.message };
        const token = this.jwt.sign({ sub: data.id, username: data.username });
        return { user: data, token };
    }
    async signIn(dto) {
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
        const token = this.jwt.sign({ sub: data.id, username: data.username });
        return { user: { id: data.id, username: data.username, full_name: data.full_name }, token };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService, jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map