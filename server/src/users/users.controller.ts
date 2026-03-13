import { Controller, Get } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('users')
export class UsersController {
  constructor(private supabase: SupabaseService) {}

  @Get()
  async list() {
    const { data } = await this.supabase.db
      .from('users')
      .select('id, username, full_name, is_online')
      .order('created_at', { ascending: true });
    return data || [];
  }
}
