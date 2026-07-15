export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  apiPublicUrl: string;
  webPublicUrl: string;
  jwt: { secret: string; accessTtl: string };
  redis: { host: string; port: number; url: string };
  seedAdmin: { email: string; password: string; name: string };
  whatsapp: {
    graphVersion: string;
    accessToken: string;
    phoneNumberId: string;
    wabaId: string;
    appId: string;
    appSecret: string;
    verifyToken: string;
  };
  minio: {
    endpoint: string;
    port: number;
    useSSL: boolean;
    accessKey: string;
    secretKey: string;
    bucket: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.API_PORT ?? '4000', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  apiPublicUrl: process.env.API_PUBLIC_URL ?? 'http://localhost:4000',
  webPublicUrl: process.env.WEB_PUBLIC_URL ?? 'http://localhost:3000',
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-insecure-secret',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '7d',
  },
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  seedAdmin: {
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@neurorecode.com',
    password: process.env.SEED_ADMIN_PASSWORD ?? 'change-me-admin',
    name: process.env.SEED_ADMIN_NAME ?? 'Neuro Recode Admin',
  },
  whatsapp: {
    graphVersion: process.env.GRAPH_API_VERSION ?? 'v21.0',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    wabaId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? '',
    appId: process.env.WHATSAPP_APP_ID ?? '',
    appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
    verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? '',
  },
  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
    useSSL: (process.env.MINIO_USE_SSL ?? 'false') === 'true',
    accessKey: process.env.MINIO_ROOT_USER ?? 'nrw-minio',
    secretKey: process.env.MINIO_ROOT_PASSWORD ?? 'change-me-minio',
    bucket: process.env.MINIO_BUCKET ?? 'nrw-media',
  },
});
