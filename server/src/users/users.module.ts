import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { SupabaseService } from '../supabase/supabase.service';

@Module({
  controllers: [UsersController],
  providers: [SupabaseService],
})
export class UsersModule {}
