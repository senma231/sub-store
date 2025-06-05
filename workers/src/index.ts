import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { secureHeaders } from 'hono/secure-headers';

// 导入数据库
import { Database } from './database';
import { NodesRepository } from './database/nodes';
import { AuthRepository } from './database/auth';
import { StatsRepository } from './database/stats';

import { nodesRouter } from './routes/nodes';
import { subscriptionRouter } from './routes/subscription';
import { authRouter } from './routes/auth';
import { statsRouter } from './routes/stats';
import { healthRouter } from './routes/health';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';

export interface Env extends Record<string, unknown> {
  DB: D1Database;
  ADMIN_TOKEN: string;
  JWT_SECRET: string;
  CLOUDFLARE_API_TOKEN?: string;
  ENVIRONMENT: string;
  APP_NAME: string;
  CORS_ORIGINS: string;
}

// 扩展 Hono 上下文类型
declare module 'hono' {
  interface ContextVariableMap {
    db: Database;
    nodesRepo: NodesRepository;
    authRepo: AuthRepository;
    statsRepo: StatsRepository;
    user: { id: string; username: string; role: string };
  }
}

const app = new Hono<Env>();

// 数据库初始化中间件
app.use('*', async (c, next) => {
  const db = new Database(c.env.DB);
  const nodesRepo = new NodesRepository(db);
  const authRepo = new AuthRepository(db);
  const statsRepo = new StatsRepository(db);

  c.set('db', db);
  c.set('nodesRepo', nodesRepo);
  c.set('authRepo', authRepo);
  c.set('statsRepo', statsRepo);

  await next();
});

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

// 速率限制（暂时禁用以简化演示）
// app.use('/api/*', rateLimitMiddleware);

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
