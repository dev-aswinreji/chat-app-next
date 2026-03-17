import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
import { SignInDto, SignUpDto } from './auth.dto';
type TokenMeta = {
    ip?: string;
    userAgent?: string;
};
export declare class AuthService {
    private supabase;
    private jwt;
    constructor(supabase: SupabaseService, jwt: JwtService);
    signUp(dto: SignUpDto, meta?: TokenMeta): Promise<{
        user: {
            id: any;
            username: any;
            full_name: any;
        };
        accessToken: string;
        refreshToken: string;
    }>;
    signIn(dto: SignInDto, meta?: TokenMeta): Promise<{
        user: {
            id: any;
            username: any;
            full_name: any;
        };
        accessToken: string;
        refreshToken: string;
    }>;
    refresh(refreshToken: string, meta?: TokenMeta): Promise<{
        user: {
            id: any;
            username: any;
            full_name: any;
        };
        accessToken: string;
        refreshToken: string;
        newTokenId: `${string}-${string}-${string}-${string}-${string}`;
    }>;
    logout(refreshToken: string): Promise<void>;
    listSessions(userId: string): Promise<{
        id: any;
        created_at: any;
        expires_at: any;
        ip: any;
        user_agent: any;
    }[]>;
    revokeSession(userId: string, sessionId: string): Promise<void>;
    revokeAllSessions(userId: string): Promise<void>;
    getUserById(id: string): Promise<{
        id: any;
        username: any;
        full_name: any;
    } | null>;
    private issueTokens;
    private rotateRefreshToken;
    private revokeToken;
    private revokeFamily;
    private hashToken;
    private generateRefreshToken;
}
export {};
