import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
  value === "" ? undefined : value;

const optionalString = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().optional(),
);

const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().url().optional(),
);

const optionalNumber = z.preprocess(
  emptyStringToUndefined,
  z.coerce.number().optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.preprocess(
      emptyStringToUndefined,
      z.coerce.number().int().positive().max(65535).default(9090),
    ),
    MONGO_URI: z.string().trim().min(1, "MONGO_URI is required"),
    REDIS_URL: z.string().trim().min(1, "REDIS_URL is required"),
    FRONTEND_URL: z.string().trim().min(1, "FRONTEND_URL is required"),
    JWT_REFRESH_SECRET: z
      .string()
      .trim()
      .min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),

    CLOUDINARY_CLOUD_NAME: optionalString,
    CLOUDINARY_API_KEY: optionalString,
    CLOUDINARY_API_SECRET: optionalString,
    MAIL_USER: optionalString,
    MAIL_PASS: optionalString,

    GOOGLE_CLIENT_ID: optionalString,
    GOOGLE_CLIENT_SECRET: optionalString,
    GOOGLE_CALLBACK_URL: optionalString,
    GOOGLE_TRANSLATE_KEY: optionalString,
    GOOGLE_APPLICATION_CREDENTIALS: optionalString,
    GOOGLE_APPLICATION_CREDENTIALS_JSON: optionalString,
    GOOGLE_APPLICATION_CREDENTIALS_BASE64: optionalString,
    GOOGLE_CLOUD_PROJECT: optionalString,
    GOOGLE_CLOUD_LOCATION: optionalString.default("us-central1"),
    VOICEVOX_URL: optionalUrl.default("http://127.0.0.1:50021"),
    PUPPETEER_EXECUTABLE_PATH: optionalString,

    ARGOS_TRANSLATE_URL: optionalUrl.default(
      "https://minhnguyenminj-quick-translate.hf.space",
    ),

    ZALOPAY_APP_ID: optionalString,
    ZALOPAY_KEY1: optionalString,
    ZALOPAY_KEY2: optionalString,
    ZALOPAY_CREATE_ENDPOINT: optionalUrl.default(
      "https://sb-openapi.zalopay.vn/v2/create",
    ),
    ZALOPAY_QUERY_ENDPOINT: optionalUrl.default(
      "https://sb-openapi.zalopay.vn/v2/query",
    ),
    ZALOPAY_RETURN_URL: optionalString,
    ZALOPAY_CALLBACK_URL: optionalString,
    ZALOPAY_BANK_CODE: optionalString.default("zalopayapp"),

    STRIPE_SECRET_KEY: optionalString,
    STRIPE_WEBHOOK_SECRET: optionalString,
    STRIPE_RETURN_URL: optionalString,
    STRIPE_CURRENCY: optionalString.default("vnd"),

    LANGFUSE_PUBLIC_KEY: optionalString,
    LANGFUSE_SECRET_KEY: optionalString,
    LANGFUSE_BASE_URL: optionalUrl.default("https://cloud.langfuse.com"),
    LANGFUSE_DASHBOARD_URL: optionalString,
    LANGFUSE_LOG_LEVEL: optionalString,
    LANGFUSE_DEBUG: optionalString,
    AI_COST_USD_TO_VND_RATE: optionalNumber,
    AI_PROMPT_CACHE_ENABLED: optionalString,
    AI_PROMPT_CACHE_TTL_SECONDS: optionalNumber,

    AUTH_COOKIE_SAME_SITE: z.preprocess(
      emptyStringToUndefined,
      z.enum(["lax", "strict", "none"]).optional(),
    ),
    AUTH_COOKIE_SECURE: z.preprocess(
      emptyStringToUndefined,
      z.enum(["true", "false"]).optional(),
    ),

    MODERATION_POST_BATCH_SIZE: optionalNumber,
    MODERATION_COMMENT_BATCH_SIZE: optionalNumber,
    MODERATION_BATCH_TIMEOUT_SECONDS: optionalNumber,
    MODERATION_AUTO_DELETE_CONFIDENCE: optionalNumber,
  })
  .passthrough();

export type EnvironmentVariables = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  return result.data;
}
