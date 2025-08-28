// Created automatically by Cursor AI (2024-08-27)

import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { SsoService } from './sso.service';

@ApiTags('sso')
@Controller('auth/sso')
export class SsoController {
  constructor(private ssoService: SsoService) {}

  @Get('login')
  @ApiOperation({ summary: 'Get SSO login URL' })
  @ApiResponse({ status: 200, description: 'SSO login URL' })
  async getLoginUrl() {
    return this.ssoService.getAuthUrl();
  }

  @Get('callback')
  @ApiOperation({ summary: 'Handle SSO callback' })
  @ApiResponse({ status: 200, description: 'SSO callback handled' })
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const result = await this.ssoService.handleOidcCallback(code, state);
    
    // Redirect to frontend with token
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${result.access_token}`;
    res.redirect(redirectUrl);
  }
}
