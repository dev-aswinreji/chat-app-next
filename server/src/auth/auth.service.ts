import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { SignInDto, SignUpDto } from './auth.dto';
import { ACCESS_TOKEN_TTL, REFRESH_TOKEN_TTL_DAYS } from './auth.constants';

type TokenMeta = {
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class AuthService {
  constructor(private supabase: SupabaseService, private jwt: JwtService) {}

  async signUp(dto: SignUpDto, meta?: TokenMeta) {
    const { data: existing } = await this.supabase.db
      .from('users')
      .select('id')
      .eq('username', dto.username)
      .maybeSingle();

    if (existing) {
      throw new ConflictException('Username already taken');
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

    if (error) throw new ConflictException(error.message);

    const { accessToken, refreshToken } = await this.issueTokens(data, meta);
    return { user: data, accessToken, refreshToken };
  }

  async signIn(dto: SignInDto, meta?: TokenMeta) {
    const { data, error } = await this.supabase.db
      .from('users')
      .select('id, username, full_name, password_hash')
      .eq('username', dto.username)
      .single();

    if (error || !data) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, data.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const { accessToken, refreshToken } = await this.issueTokens(
      { id: data.id, username: data.username, full_name: data.full_name },
      meta,
    );
    return {
      user: { id: data.id, username: data.username, full_name: data.full_name },
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string, meta?: TokenMeta) {
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

    const tokenHash = this.hashToken(refreshToken);
    const { data: tokenRow } = await this.supabase.db
      .from('refresh_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!tokenRow) throw new UnauthorizedException('Invalid refresh token');

    if (tokenRow.revoked_at) {
      await this.revokeFamily(tokenRow.family_id);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      await this.revokeToken(tokenRow.id);
      throw new UnauthorizedException('Refresh token expired');
    }

    const { data: user } = await this.supabase.db
      .from('users')
      .select('id, username, full_name')
      .eq('id', tokenRow.user_id)
      .single();

    if (!user) throw new UnauthorizedException('User not found');

    const { accessToken, refreshToken: newRefreshToken, newTokenId } =
      await this.rotateRefreshToken(user, tokenRow, meta);

    return { user, accessToken, refreshToken: newRefreshToken, newTokenId };
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return;
    const tokenHash = this.hashToken(refreshToken);
    const { data: tokenRow } = await this.supabase.db
      .from('refresh_tokens')
      .select('id')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (!tokenRow) return;
    await this.revokeToken(tokenRow.id);
  }

  async listSessions(userId: string) {
    const { data } = await this.supabase.db
      .from('refresh_tokens')
      .select('id, created_at, expires_at, ip, user_agent')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });
    return data || [];
  }

  async revokeSession(userId: string, sessionId: string) {
    await this.supabase.db
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', sessionId)
      .eq('user_id', userId);
  }

  async revokeAllSessions(userId: string) {
    await this.supabase.db
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId);
  }

  async getUserById(id: string) {
    const { data } = await this.supabase.db
      .from('users')
      .select('id, username, full_name')
      .eq('id', id)
      .single();
    return data;
  }

  private async issueTokens(
    user: { id: string; username: string; full_name: string },
    meta?: TokenMeta,
  ) {
    const accessToken = this.jwt.sign(
      { sub: user.id, username: user.username },
      { expiresIn: ACCESS_TOKEN_TTL as SignOptions['expiresIn'] },
    );

    const refreshToken = this.generateRefreshToken();
    const tokenHash = this.hashToken(refreshToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_DAYS * 86400000);
    const familyId = randomUUID();

    await this.supabase.db.from('refresh_tokens').insert({
      id: randomUUID(),
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
      revoked_at: null,
      replaced_by: null,
      family_id: familyId,
      ip: meta?.ip || null,
      user_agent: meta?.userAgent || null,
    });

    return { accessToken, refreshToken };
  }

  private async rotateRefreshToken(
    user: { id: string; username: string; full_name: string },
    oldTokenRow: any,
    meta?: TokenMeta,
  ) {
    const accessToken = this.jwt.sign(
      { sub: user.id, username: user.username },
      { expiresIn: ACCESS_TOKEN_TTL as SignOptions['expiresIn'] },
    );

    const newRefreshToken = this.generateRefreshToken();
    const newTokenId = randomUUID();
    const tokenHash = this.hashToken(newRefreshToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_DAYS * 86400000);

    await this.supabase.db.from('refresh_tokens').insert({
      id: newTokenId,
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      created_at: now.toISOString(),
      revoked_at: null,
      replaced_by: null,
      family_id: oldTokenRow.family_id,
      ip: meta?.ip || null,
      user_agent: meta?.userAgent || null,
    });

    await this.supabase.db
      .from('refresh_tokens')
      .update({ revoked_at: now.toISOString(), replaced_by: newTokenId })
      .eq('id', oldTokenRow.id);

    return {
      accessToken,
      refreshToken: newRefreshToken,
      newTokenId,
    };
  }

  private async revokeToken(id: string) {
    await this.supabase.db
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id);
  }

  private async revokeFamily(familyId: string) {
    await this.supabase.db
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('family_id', familyId);
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateRefreshToken() {
    return randomBytes(64).toString('hex');
  }
}
