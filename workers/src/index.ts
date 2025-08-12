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
import { UsersRepository } from './repositories/UsersRepository';
import { CustomSubscriptionsRepository } from './database/customSubscriptions';
import { SubscriptionsRepository } from './database/subscriptions';

import { nodesRouter } from './routes/nodes';
import { subscriptionRouter } from './routes/subscription';
import { authRouter } from './routes/auth';
import { statsRouter } from './routes/stats';
import { healthRouter } from './routes/health';
import { customSubscriptionsRouter } from './routes/customSubscriptions';
import { subscriptionsRouter } from './routes/subscriptions';
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
    db: Database | null;
    nodesRepo: NodesRepository | null;
    authRepo: AuthRepository | null;
    statsRepo: StatsRepository | null;
    usersRepo: UsersRepository | null;
    user: { id: string; username: string; role: string };
  }
}

const app = new Hono<Env>();

// 数据库初始化中间件
app.use('*', async (c, next) => {
  try {
    // 检查是否配置了 D1 数据库
    if (c.env.DB) {
      const db = new Database(c.env.DB);
      const nodesRepo = new NodesRepository(db);
      const authRepo = new AuthRepository(db);
      const statsRepo = new StatsRepository(db);
      const usersRepo = new UsersRepository(c.env.DB);
      const customSubsRepo = new CustomSubscriptionsRepository(db);
      const subscriptionsRepo = new SubscriptionsRepository(db);

      c.set('db', db);
      c.set('nodesRepo', nodesRepo);
      c.set('authRepo', authRepo);
      c.set('statsRepo', statsRepo);
      c.set('usersRepo', usersRepo);
      c.set('customSubsRepo', customSubsRepo);
      c.set('subscriptionsRepo', subscriptionsRepo);

      // 在第一次请求时初始化数据库
      if (!globalThis.dbInitialized) {
        try {
          const { initializeDatabase } = await import('./database/init');
          await initializeDatabase(db);

          // 初始化默认管理员用户
          if (c.env.ADMIN_TOKEN) {
            await usersRepo.initializeDefaultAdmin(c.env.ADMIN_TOKEN);
          }

          globalThis.dbInitialized = true;
          console.log('Database initialized successfully');
        } catch (error) {
          console.error('Database initialization failed:', error);
          // 继续处理请求，但记录错误
        }
      }
    } else {
      console.warn('D1 database not configured, running in memory-only mode');
      // 设置空的数据库对象以避免错误
      c.set('db', null);
      c.set('nodesRepo', null);
      c.set('authRepo', null);
      c.set('statsRepo', null);
      c.set('usersRepo', null);
    }

    await next();
  } catch (error) {
    console.error('Database middleware error:', error);
    // 继续处理请求，但记录错误
    await next();
  }
});

// 全局中间件
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', prettyJSON());

// CORS 配置
app.use('*', async (c, next) => {
  // 获取配置的 CORS 源
  const corsOrigins = c.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()) || [];

  // 默认允许的源
  const defaultOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://localhost:3000',
  ];

  // 合并所有允许的源
  const allowedOrigins = [...defaultOrigins, ...corsOrigins];

  return cors({
    origin: (origin) => {
      // 如果没有 origin（同源请求），返回 '*'
      if (!origin) return '*';

      // 检查是否在允许列表中
      if (allowedOrigins.includes(origin)) return origin;

      // 如果配置了通配符，允许所有
      if (corsOrigins.includes('*')) return '*';

      // 检查是否是 Cloudflare Pages 域名
      if (origin.includes('.pages.dev')) return origin;

      // 检查是否是 Workers 域名
      if (origin.includes('.workers.dev')) return origin;

      // 默认拒绝
      return false;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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

// 订阅解析路由 (无需认证，用于前端解析订阅链接)
app.route('/api/subscription', subscriptionsRouter);

// 认证路由
app.route('/auth', authRouter);

// API 路由 (需要认证)
app.use('/api/*', authMiddleware);
app.route('/api/nodes', nodesRouter);
app.route('/api/stats', statsRouter);
app.route('/api/subscriptions', customSubscriptionsRouter);
app.route('/api/manage/subscriptions', subscriptionsRouter);

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
