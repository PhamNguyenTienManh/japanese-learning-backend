import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Stripe webhook cần raw body để verify chữ ký — phải mount TRƯỚC json parser
  // và dùng path đầy đủ kể cả global prefix.
  app.use(
    '/api/payments/stripe/webhook',
    bodyParser.raw({ type: 'application/json' }),
  );

  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  // Đặt prefix cho tất cả route
  app.setGlobalPrefix('api');
  
  app.enableCors({
    origin: process.env.FRONTEND_URL,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true, 
  });
  
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
  }));
  console.log("TEST ENV FFMPEG:", process.env.FFMPEG_PATH);
  await app.listen(process.env.PORT ?? 9090);
}
bootstrap();
