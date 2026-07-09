import { shutdownLangfuseTracing } from "./instrumentation";
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bodyParser from 'body-parser';

function parseCorsOrigins(frontendUrl: string) {
  return frontendUrl
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');
  const port = config.get<number>('PORT', 9090);
  const corsOrigins = parseCorsOrigins(config.getOrThrow<string>('FRONTEND_URL'));

  // Stripe webhook cần raw body để verify chữ ký — phải mount TRƯỚC json parser
  // và dùng path đầy đủ kể cả global prefix.
  app.use(
    '/api/payments/stripe/webhook',
    bodyParser.raw({ type: 'application/json' }),
  );

  app.use(bodyParser.urlencoded({ extended: true, limit: '25mb' }));
  app.use(bodyParser.json({ limit: '25mb' }));
  // Đặt prefix cho tất cả route
  app.setGlobalPrefix('api');
  
  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, 
  });
  
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
  }));
  app.enableShutdownHooks(['SIGINT', 'SIGTERM']);
  const shutdownTracing = async (signal: NodeJS.Signals) => {
    logger.log(`${signal} received, flushing tracing before shutdown`);
    await shutdownLangfuseTracing();
  };
  process.once('SIGTERM', () => {
    void shutdownTracing('SIGTERM');
  });
  process.once('SIGINT', () => {
    void shutdownTracing('SIGINT');
  });

  await app.listen(port);
  logger.log(`Application is running on port ${port}`);
}
bootstrap();
