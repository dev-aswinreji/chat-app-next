import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthResponseDto, MeResponseDto, SessionDto, SignInDto, SignUpDto } from './auth.dto';
import { AuthService } from './auth.service';
import { REFRESH_COOKIE_NAME } from './auth.constants';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('signup')
  @ApiBody({ type: SignUpDto })
  @ApiOkResponse({ type: AuthResponseDto })
  signUp(@Body() dto: SignUpDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.signUp(dto, this.getMeta(req)).then((result) => {
      if ('refreshToken' in result) {
        this.setRefreshCookie(res, result.refreshToken);
      }
      return { user: result.user, accessToken: result.accessToken };
    });
  }

  @Post('login')
  @ApiBody({ type: SignInDto })
  @ApiOkResponse({ type: AuthResponseDto })
  signIn(@Body() dto: SignInDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.signIn(dto, this.getMeta(req)).then((result) => {
      this.setRefreshCookie(res, result.refreshToken);
      return { user: result.user, accessToken: result.accessToken };
    });
  }

  @Post('refresh')
  @ApiCookieAuth('refresh_token')
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse()
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    const result = await this.auth.refresh(token, this.getMeta(req));
    this.setRefreshCookie(res, result.refreshToken);
    return { user: result.user, accessToken: result.accessToken };
  }

  @Post('logout')
  @ApiCookieAuth('refresh_token')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE_NAME, this.getCookieOptions());
    return { ok: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: MeResponseDto })
  async me(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.auth.getUserById(user.id);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOkResponse({ type: [SessionDto] })
  async sessions(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.auth.listSessions(user.id);
  }

  @Post('sessions/revoke-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async revokeAll(@Req() req: Request) {
    const user = req.user as { id: string };
    await this.auth.revokeAllSessions(user.id);
    return { ok: true };
  }

  @Post('sessions/revoke')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ schema: { properties: { sessionId: { type: 'string' } }, required: ['sessionId'] } })
  async revoke(@Req() req: Request, @Body() body: { sessionId: string }) {
    const user = req.user as { id: string };
    await this.auth.revokeSession(user.id, body.sessionId);
    return { ok: true };
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      ...this.getCookieOptions(),
      maxAge: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 7) * 86400000,
    });
  }

  private getCookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') || 'strict',
      path: '/auth',
    };
  }

  private getMeta(req: Request) {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
