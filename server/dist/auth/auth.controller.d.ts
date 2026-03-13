import { AuthService } from './auth.service';
import { SignInDto, SignUpDto } from './auth.dto';
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
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
