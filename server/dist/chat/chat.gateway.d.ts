import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { SupabaseService } from '../supabase/supabase.service';
export declare class ChatGateway {
    private jwt;
    private supabase;
    server: Server;
    private onlineUsers;
    private userSockets;
    constructor(jwt: JwtService, supabase: SupabaseService);
    handleConnection(client: Socket): Promise<void>;
    handleDisconnect(client: Socket): Promise<void>;
    onMessage(payload: {
        toUserId: string;
        text: string;
    }, client: Socket): Promise<void>;
    onRead(payload: {
        messageId: number;
        fromUserId: string;
    }, client: Socket): Promise<void>;
}
