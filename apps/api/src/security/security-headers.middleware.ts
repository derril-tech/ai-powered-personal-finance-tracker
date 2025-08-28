// Created automatically by Cursor AI (2024-12-19)

import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  constructor(private configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Content Security Policy (CSP)
    const cspDirectives = this.buildCspDirectives()
    res.setHeader('Content-Security-Policy', cspDirectives)

    // HTTP Strict Transport Security (HSTS)
    const hstsMaxAge = this.configService.get<number>('HSTS_MAX_AGE', 31536000) // 1 year
    const hstsIncludeSubdomains = this.configService.get<boolean>('HSTS_INCLUDE_SUBDOMAINS', true)
    const hstsPreload = this.configService.get<boolean>('HSTS_PRELOAD', false)
    
    let hstsHeader = `max-age=${hstsMaxAge}`
    if (hstsIncludeSubdomains) {
      hstsHeader += '; includeSubDomains'
    }
    if (hstsPreload) {
      hstsHeader += '; preload'
    }
    res.setHeader('Strict-Transport-Security', hstsHeader)

    // X-Frame-Options (prevent clickjacking)
    res.setHeader('X-Frame-Options', 'DENY')

    // X-Content-Type-Options (prevent MIME type sniffing)
    res.setHeader('X-Content-Type-Options', 'nosniff')

    // X-XSS-Protection (enable XSS filtering)
    res.setHeader('X-XSS-Protection', '1; mode=block')

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

    // Permissions Policy (formerly Feature Policy)
    const permissionsPolicy = this.buildPermissionsPolicy()
    res.setHeader('Permissions-Policy', permissionsPolicy)

    // Cross-Origin Resource Policy
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')

    // Cross-Origin Opener Policy
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')

    // Cross-Origin Embedder Policy
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')

    // Cache Control for sensitive endpoints
    if (this.isSensitiveEndpoint(req.path)) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      res.setHeader('Pragma', 'no-cache')
      res.setHeader('Expires', '0')
    }

    // Remove server information
    res.removeHeader('X-Powered-By')
    res.removeHeader('Server')

    next()
  }

  private buildCspDirectives(): string {
    const environment = this.configService.get<string>('NODE_ENV', 'development')
    const baseUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000')
    const apiUrl = this.configService.get<string>('API_URL', 'http://localhost:3001')

    const directives = {
      'default-src': ["'self'"],
      'script-src': [
        "'self'",
        "'unsafe-inline'", // Required for PrimeReact
        "'unsafe-eval'", // Required for PrimeReact
        'https://cdn.jsdelivr.net', // PrimeReact CDN
        'https://unpkg.com', // Alternative CDN
      ],
      'style-src': [
        "'self'",
        "'unsafe-inline'", // Required for PrimeReact
        'https://cdn.jsdelivr.net',
        'https://unpkg.com',
        'https://fonts.googleapis.com',
      ],
      'font-src': [
        "'self'",
        'https://fonts.gstatic.com',
        'https://cdn.jsdelivr.net',
        'https://unpkg.com',
      ],
      'img-src': [
        "'self'",
        'data:',
        'https:',
        'blob:',
      ],
      'connect-src': [
        "'self'",
        baseUrl,
        apiUrl,
        'wss:', // WebSocket connections
        'https://api.plaid.com', // Plaid API
        'https://api.tink.com', // Tink API
        'https://api.truelayer.com', // TrueLayer API
        'https://api.exchangerate-api.com', // FX API
        'https://api.openexchangerates.org', // Alternative FX API
      ],
      'frame-src': [
        "'none'", // Block all frames
      ],
      'object-src': [
        "'none'", // Block all objects
      ],
      'base-uri': [
        "'self'",
      ],
      'form-action': [
        "'self'",
      ],
      'frame-ancestors': [
        "'none'", // Block all frame ancestors
      ],
      'upgrade-insecure-requests': [],
    }

    // Add nonce-based CSP in production
    if (environment === 'production') {
      // In production, you might want to generate nonces for inline scripts
      // directives['script-src'].push("'nonce-${nonce}'")
    }

    // Convert directives to CSP string
    return Object.entries(directives)
      .map(([directive, sources]) => {
        if (sources.length === 0) {
          return directive
        }
        return `${directive} ${sources.join(' ')}`
      })
      .join('; ')
  }

  private buildPermissionsPolicy(): string {
    const policies = {
      'accelerometer': '()',
      'ambient-light-sensor': '()',
      'autoplay': '()',
      'battery': '()',
      'camera': '()',
      'cross-origin-isolated': '()',
      'display-capture': '()',
      'document-domain': '()',
      'encrypted-media': '()',
      'execution-while-not-rendered': '()',
      'execution-while-out-of-viewport': '()',
      'fullscreen': '()',
      'geolocation': '()',
      'gyroscope': '()',
      'keyboard-map': '()',
      'magnetometer': '()',
      'microphone': '()',
      'midi': '()',
      'navigation-override': '()',
      'payment': '()',
      'picture-in-picture': '()',
      'publickey-credentials-get': '()',
      'screen-wake-lock': '()',
      'sync-xhr': '()',
      'usb': '()',
      'web-share': '()',
      'xr-spatial-tracking': '()',
    }

    return Object.entries(policies)
      .map(([feature, value]) => `${feature}=${value}`)
      .join(', ')
  }

  private isSensitiveEndpoint(path: string): boolean {
    const sensitivePaths = [
      '/auth',
      '/api/auth',
      '/api/users',
      '/api/households',
      '/api/accounts',
      '/api/transactions',
      '/api/budgets',
      '/api/goals',
      '/api/reports',
      '/api/exports',
      '/api/settings',
    ]

    return sensitivePaths.some(sensitivePath => path.startsWith(sensitivePath))
  }
}
