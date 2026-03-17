import type { Request, Response } from 'express';
import { SignInDto, SignUpDto } from './auth.dto';
import { AuthService } from './auth.service';
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
    signUp(dto: SignUpDto, req: Request, res: Response): Promise<{
        user: {
            id: any;
            username: any;
            full_name: any;
        };
        accessToken: string;
    }>;
    signIn(dto: SignInDto, req: Request, res: Response): Promise<{
        user: {
            id: any;
            username: any;
            full_name: any;
        };
        accessToken: string;
    }>;
    refresh(req: Request, res: Response): Promise<{
        user: {
            id: any;
            username: any;
            full_name: any;
        };
        accessToken: string;
    }>;
    logout(req: Request, res: Response): Promise<{
        ok: boolean;
    }>;
    me(req: Request): Promise<{
        id: any;
        username: any;
        full_name: any;
    } | null>;
    sessions(req: Request): Promise<{
        id: any;
        created_at: any;
        expires_at: any;
        ip: any;
        user_agent: any;
    }[]>;
    revokeAll(req: Request): Promise<{
        ok: boolean;
    }>;
    revoke(req: Request, body: {
        sessionId: string;
    }): Promise<{
        ok: boolean;
    }>;
    private setRefreshCookie;
    private getCookieOptions;
    private getMeta;
}
