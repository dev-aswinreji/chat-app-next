import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';
import { SignInDto, SignUpDto } from './auth.dto';
export declare class AuthService {
    private supabase;
    private jwt;
    constructor(supabase: SupabaseService, jwt: JwtService);
    signUp(dto: SignUpDto): Promise<{
        error: string;
        user?: undefined;
        token?: undefined;
    } | {
        user: {
            id: any;
            username: any;
            full_name: any;
        };
        token: string;
        error?: undefined;
    }>;
    signIn(dto: SignInDto): Promise<{
        user: {
            id: any;
            username: any;
            full_name: any;
        };
        token: string;
    }>;
}
