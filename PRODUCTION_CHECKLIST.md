# Production Checklist

This checklist prepares the NestJS backend for a future Docker deployment on Railway.

## Runtime

- [x] Build command is `npm run build`.
- [x] Production command is `npm run start:prod`.
- [x] `start` runs Nest without watch mode.
- [x] App reads `PORT` from environment variables with a `9090` local default.
- [x] Global API prefix remains `/api`.
- [x] HTTP health endpoint is available at `/api/health`.
- [x] Stripe webhook raw body is mounted before JSON parsing.

## Configuration

- [x] `ConfigModule` is global.
- [x] Environment variables are validated at startup with Zod.
- [x] `MONGO_URI`, `REDIS_URL`, `FRONTEND_URL`, and `JWT_REFRESH_SECRET` are required.
- [x] MongoDB, Redis, CORS, and Cloudinary runtime config use `ConfigService`.
- [x] `.env.example` documents all environment variables referenced by source code.

## Required Environment Variables

- `NODE_ENV`
- `PORT`
- `MONGO_URI`
- `REDIS_URL`
- `FRONTEND_URL`
- `JWT_REFRESH_SECRET`

## Feature Environment Variables

- Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- Mail: `MAIL_USER`, `MAIL_PASS`
- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
- Translation: `GOOGLE_TRANSLATE_KEY`, `ARGOS_TRANSLATE_URL`
- Vertex AI on Railway: `GOOGLE_APPLICATION_CREDENTIALS_BASE64`, `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`
- VoiceVox: `VOICEVOX_URL`
- AI cache: `AI_PROMPT_CACHE_ENABLED`, `AI_PROMPT_CACHE_TTL_SECONDS`
- ZaloPay: `ZALOPAY_APP_ID`, `ZALOPAY_KEY1`, `ZALOPAY_KEY2`, `ZALOPAY_CREATE_ENDPOINT`, `ZALOPAY_QUERY_ENDPOINT`, `ZALOPAY_RETURN_URL`, `ZALOPAY_CALLBACK_URL`, `ZALOPAY_BANK_CODE`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_RETURN_URL`, `STRIPE_CURRENCY`
- Langfuse: `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`, `LANGFUSE_DASHBOARD_URL`, `LANGFUSE_LOG_LEVEL`, `LANGFUSE_DEBUG`
- Statistics: `AI_COST_USD_TO_VND_RATE`
- Auth cookies: `AUTH_COOKIE_SAME_SITE`, `AUTH_COOKIE_SECURE`
- Moderation: `MODERATION_POST_BATCH_SIZE`, `MODERATION_COMMENT_BATCH_SIZE`, `MODERATION_BATCH_TIMEOUT_SECONDS`, `MODERATION_AUTO_DELETE_CONFIDENCE`

## HTTP Hardening

- [x] Global `ValidationPipe` is enabled with `whitelist: true`.
- [x] CORS is restricted to `FRONTEND_URL`.
- [x] Multiple CORS origins can be configured by separating `FRONTEND_URL` with commas.
- [ ] Review whether `forbidNonWhitelisted: true` can be enabled after confirming frontend payloads.
- [ ] Review request body limit `25mb` before production based on upload/API usage.

## Shutdown And Logging

- [x] Nest shutdown hooks are enabled for `SIGINT` and `SIGTERM`.
- [x] Langfuse/OpenTelemetry tracing is flushed on shutdown signals.
- [x] Bootstrap debug `console.log` was removed.
- [x] Bootstrap startup/shutdown messages use Nest `Logger`.
- [ ] Replace remaining service-level debug `console.log` calls with Nest `Logger` before public production traffic.

## Railway Notes

- [x] Railway can inject `PORT`; the app now listens on it.
- [x] Railway healthcheck path can be set to `/api/health`.
- [x] Dockerfile is multi-stage and keeps only production dependencies in the final image.
- [x] Final image runs as the non-root `node` user.
- [x] Docker healthcheck uses the injected `PORT`.
- [ ] Add Railway variables from `.env.example` before first deployment.
- [ ] Configure MongoDB and Redis services or external URLs before deployment.
- [x] Docker build uses `npm ci`, `npm run build`, then starts `node dist/main.js`.

## Change Reasons

- Added env validation so missing or malformed production configuration fails fast during boot.
- Standardized scripts so development, build, and production start commands have distinct behavior.
- Added direct Nest runtime dependencies so production installs do not rely on transitive packages.
- Replaced core `process.env` reads with `ConfigService` in infrastructure modules for consistency.
- Kept business logic in controllers and services unchanged.
