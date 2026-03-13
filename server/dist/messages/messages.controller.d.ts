import { SupabaseService } from '../supabase/supabase.service';
export declare class MessagesController {
    private supabase;
    constructor(supabase: SupabaseService);
    list(userId: string, withUserId: string): Promise<any[]>;
}
