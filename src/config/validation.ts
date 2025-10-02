import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  API_PREFIX: Joi.string().default('api/v1'),

  // Database
  MONGODB_URI: Joi.string().required(),
  COSMOS_DB_CONNECTION_STRING: Joi.string().optional(),
  COSMOS_DB_NAME: Joi.string().default('unicx-integration'),

  // JWT
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),

  // Email
  EMAIL_HOST: Joi.string().default('smtp.gmail.com'),
  EMAIL_PORT: Joi.number().default(587),
  EMAIL_USER: Joi.string().required(),
  EMAIL_PASS: Joi.string().required(),
  EMAIL_FROM: Joi.string().email().default('noreply@unicx.com'),

  // Rate Limiting
  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_LIMIT: Joi.number().default(100),

  // QR Code
  QR_CODE_EXPIRY_HOURS: Joi.number().default(24),
  QR_CODE_ENCRYPTION_KEY: Joi.string().required(),

  // WhatsApp
  WHATSAPP_API_URL: Joi.string().uri().default('https://graph.facebook.com/v18.0'),
  WHATSAPP_ACCESS_TOKEN: Joi.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: Joi.string().optional(),

  // Security
  BCRYPT_ROUNDS: Joi.number().default(12),
  CORS_ORIGIN: Joi.string().uri().default('http://localhost:3000'),
});
