import { Controller, Get, Query } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('messages')
export class MessagesController {
  constructor(private supabase: SupabaseService) {}

  @Get()
  async list(
    @Query('userId') userId: string,
    @Query('withUserId') withUserId: string,
  ) {
    const { data } = await this.supabase.db
      .from('messages')
      .select('*')
      .or(
        `and(from_user_id.eq.${userId},to_user_id.eq.${withUserId}),and(from_user_id.eq.${withUserId},to_user_id.eq.${userId})`
      )
      .order('created_at', { ascending: true });
    return data || [];
  }
}
