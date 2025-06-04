import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';

import { nodesRouter } from './routes/nodes';
import { subscriptionRouter } from './routes/subscription';
import { authRouter } from './routes/auth';
import { statsRouter } from './routes/stats';
import { healthRouter } from './routes/health';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';

export interface Env {
  SUB_STORE_KV: KVNamespace;
  ADMIN_TOKEN: string;
  JWT_SECRET: string;
  CLOUDFLARE_API_TOKEN?: string;
  ENVIRONMENT: string;
  APP_NAME: string;
  CORS_ORIGINS: string;
}

const app = new Hono<{ Bindings: Env }>();

// 全局中间件
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', prettyJSON());

// CORS 配置
app.use('*', async (c, next) => {
  const corsOrigins = c.env.CORS_ORIGINS?.split(',') || ['*'];
  return cors({
    origin: corsOrigins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })(c, next);
});

// 速率限制
app.use('/api/*', rateLimitMiddleware);

// 错误处理
app.onError(errorHandler);

// 健康检查 (无需认证)
app.route('/health', healthRouter);

// 订阅路由 (无需认证，但有速率限制)
app.route('/sub', subscriptionRouter);

// 认证路由
app.route('/auth', authRouter);

// API 路由 (需要认证)
app.use('/api/*', authMiddleware);
app.route('/api/nodes', nodesRouter);
app.route('/api/stats', statsRouter);

// 根路径
app.get('/', (c) => {
  return c.json({
    name: c.env.APP_NAME || 'Sub-Store API',
    version: '1.0.0',
    environment: c.env.ENVIRONMENT || 'development',
    endpoints: {
      health: '/health',
      auth: '/auth',
      nodes: '/api/nodes',
      subscription: '/sub',
      stats: '/api/stats',
    },
    documentation: 'https://github.com/your-username/sub-store',
  });
});

// 404 处理
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Not Found',
    message: 'The requested resource was not found.',
  }, 404);
});

export default app;
