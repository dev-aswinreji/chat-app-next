import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  controllers: [MessagesController],
  providers: [SupabaseService],
})
export class MessagesModule {}
