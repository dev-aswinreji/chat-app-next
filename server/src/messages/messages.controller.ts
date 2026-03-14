import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { LastSeenResponseDto, MarkReadDto } from './messages.dto';

@ApiTags('messages')
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

  @Post('read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: MarkReadDto })
  async markRead(@Body() dto: MarkReadDto, @Req() req: Request) {
    const user = req.user as { id: string };
    const { data: last } = await this.supabase.db
      .from('messages')
      .select('id, created_at')
      .eq('from_user_id', dto.withUserId)
      .eq('to_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!last) return { ok: true };

    await this.supabase.db
      .from('messages')
      .update({ status: 'read' })
      .eq('from_user_id', dto.withUserId)
      .eq('to_user_id', user.id)
      .lte('created_at', last.created_at);

    await this.supabase.db
      .from('chat_reads')
      .upsert({
        user_id: user.id,
        peer_id: dto.withUserId,
        last_read_at: last.created_at,
        updated_at: new Date().toISOString(),
      });

    return { ok: true, readUpTo: last.created_at };
  }

  @Get('last-seen')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: LastSeenResponseDto })
  async lastSeen(@Query('withUserId') withUserId: string, @Req() req: Request) {
    const user = req.user as { id: string };
    const { data } = await this.supabase.db
      .from('chat_reads')
      .select('last_read_at')
      .eq('user_id', withUserId)
      .eq('peer_id', user.id)
      .maybeSingle();

    return {
      userId: user.id,
      withUserId,
      lastReadAt: data?.last_read_at ?? null,
    };
  }
}
