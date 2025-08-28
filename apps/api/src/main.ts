// Created automatically by Cursor AI (2024-12-19)

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { UsageTrackingInterceptor } from './common/interceptors/usage-tracking.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Global rate limiting middleware
  const rateLimitMiddleware = app.get(RateLimitMiddleware);
  app.use(rateLimitMiddleware);

  // Global usage tracking interceptor
  const usageTrackingInterceptor = app.get(UsageTrackingInterceptor);
  app.useGlobalInterceptors(usageTrackingInterceptor);

  // CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Finance Tracker API')
    .setDescription('AI-powered personal finance tracking API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('organizations', 'Organization management')
    .addTag('households', 'Household management')
    .addTag('accounts', 'Account management')
    .addTag('transactions', 'Transaction management')
    .addTag('categories', 'Category management')
    .addTag('budgets', 'Budget management')
    .addTag('goals', 'Goal management')
    .addTag('rules', 'Rule management')
    .addTag('forecasts', 'Forecast management')
    .addTag('anomalies', 'Anomaly detection')
    .addTag('reports', 'Report generation')
    .addTag('exports', 'Data export')
    .addTag('connections', 'Bank connections')
    .addTag('usage', 'Usage tracking and billing')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Swagger documentation: http://localhost:${port}/api`);
}

bootstrap();
