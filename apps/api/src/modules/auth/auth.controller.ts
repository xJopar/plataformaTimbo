import { Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CsrfProtectionGuard } from './csrf-protection.guard';
import { AuthSessionResponseDto } from './dto/auth-session-response.dto';
import {
  type AuthenticatedRequest,
  SessionAuthenticationGuard,
} from './session-authentication.guard';
import { readSessionToken, SESSION_COOKIE_NAME, toSessionCookieOptions } from './session-cookie';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  @Get('google')
  @ApiOperation({ operationId: 'startGoogleLogin', summary: 'Inicia el acceso con Google.' })
  @ApiResponse({ status: 302, description: 'Redirección al proveedor Google.' })
  public async startGoogleLogin(@Res() response: Response): Promise<void> {
    response.redirect(302, await this.authService.beginGoogleLogin());
  }

  @Get('google/callback')
  @ApiOperation({ operationId: 'completeGoogleLogin', summary: 'Completa el acceso con Google.' })
  @ApiResponse({
    status: 303,
    description: 'Sesión creada y redirección al origen web configurado.',
  })
  public async completeGoogleLogin(
    @Query('state') state: string | undefined,
    @Query('code') code: string | undefined,
    @Query('error') providerError: string | undefined,
    @Res() response: Response,
  ): Promise<void> {
    const session = await this.authService.completeGoogleLogin({ state, code, providerError });
    response.cookie(
      SESSION_COOKIE_NAME,
      session.token,
      toSessionCookieOptions(this.authService.getSessionCookieConfig()),
    );
    response.redirect(303, this.authService.getWebHomeUrl());
  }

  @Get('session')
  @UseGuards(SessionAuthenticationGuard)
  @ApiOperation({
    operationId: 'getAuthSession',
    summary: 'Obtiene la sesión autenticada vigente.',
  })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  public getSession(@Req() request: AuthenticatedRequest): AuthSessionResponseDto {
    if (request.authenticatedUser === undefined) {
      throw new Error('El guard de sesión no adjuntó un usuario autenticado.');
    }
    return this.authService.toAuthenticatedIdentity(request.authenticatedUser);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(CsrfProtectionGuard)
  @ApiOperation({ operationId: 'logout', summary: 'Revoca la sesión actual.' })
  @ApiNoContentResponse({ description: 'Sesión revocada o cookie ya ausente.' })
  public async logout(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.authService.logout(readSessionToken(request.header('cookie')));
    response.clearCookie(
      SESSION_COOKIE_NAME,
      toSessionCookieOptions(this.authService.getSessionCookieConfig()),
    );
    response.status(204).send();
  }
}
