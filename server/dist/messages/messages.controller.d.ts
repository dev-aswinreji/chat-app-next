import type { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';
import { MarkReadDto } from './messages.dto';
export declare class MessagesController {
    private supabase;
    constructor(supabase: SupabaseService);
    list(userId: string, withUserId: string): Promise<any[]>;
    markRead(dto: MarkReadDto, req: Request): Promise<{
        ok: boolean;
        readUpTo?: undefined;
    } | {
        ok: boolean;
        readUpTo: any;
    }>;
    lastSeen(withUserId: string, req: Request): Promise<{
        userId: string;
        withUserId: string;
        lastReadAt: any;
    }>;
    unreadCounts(req: Request): Promise<{
        fromUserId: any;
        unreadCount: any;
    }[]>;
}
