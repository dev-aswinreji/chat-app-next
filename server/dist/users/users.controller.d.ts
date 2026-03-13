import { SupabaseService } from '../supabase/supabase.service';
export declare class UsersController {
    private supabase;
    constructor(supabase: SupabaseService);
    list(): Promise<{
        id: any;
        username: any;
        full_name: any;
        is_online: any;
    }[]>;
}
