export declare class SignUpDto {
    username: string;
    fullName: string;
    password: string;
}
export declare class SignInDto {
    username: string;
    password: string;
}
export declare class AuthResponseDto {
    accessToken: string;
    user: {
        id: string;
        username: string;
        full_name: string;
    };
}
export declare class MeResponseDto {
    id: string;
    username: string;
    full_name: string;
}
export declare class SessionDto {
    id: string;
    created_at: string;
    expires_at: string;
    ip?: string;
    user_agent?: string;
}
