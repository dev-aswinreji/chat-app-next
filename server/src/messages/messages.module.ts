import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [MessagesController],
  providers: [SupabaseService],
})
export class MessagesModule {}
