import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { SupabaseService } from '../supabase/supabase.service';
import { SignInDto, SignUpDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(private supabase: SupabaseService, private jwt: JwtService) {}

  async signUp(dto: SignUpDto) {
    const { data: existing } = await this.supabase.db
      .from('users')
      .select('id')
      .eq('username', dto.username)
      .maybeSingle();

    if (existing) {
      return { error: 'Username already taken' };
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const { data, error } = await this.supabase.db
      .from('users')
      .insert({
        username: dto.username,
        full_name: dto.fullName,
        password_hash: passwordHash,
        is_online: false,
      })
      .select('id, username, full_name')
      .single();

    if (error) return { error: error.message };

    const token = this.jwt.sign({ sub: data.id, username: data.username });
    return { user: data, token };
  }

  async signIn(dto: SignInDto) {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('id, username, full_name, password_hash')
      .eq('username', dto.username)
      .single();

    if (error || !data) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, data.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.jwt.sign({ sub: data.id, username: data.username });
    return { user: { id: data.id, username: data.username, full_name: data.full_name }, token };
  }
}
