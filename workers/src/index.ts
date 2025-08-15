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
import { trafficManagementRouter } from './routes/trafficManagement';
import { publicSubscriptionsRouter } from './routes/publicSubscriptions';
import { secureSubscriptionsRouter } from './routes/secureSubscriptions';
import { migrationRouter } from './routes/migration';
import { securityRouter } from './routes/security';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';
import {
  ddosProtectionMiddleware,
  sensitiveInfoProtectionMiddleware,
  apiAccessControlMiddleware,
  antiScanningMiddleware
} from './middleware/security';

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

// 详细请求日志中间件
app.use('*', async (c, next) => {
  const startTime = Date.now();
  const method = c.req.method;
  const url = c.req.url;
  const path = c.req.path;
  const headers = {}; // 简化headers处理避免迭代器错误

  console.log('🔍 [Worker请求] 收到请求:', {
    method,
    url,
    path,
    headers,
    timestamp: new Date().toISOString()
  });

  // 简化请求日志，避免消费请求体
  console.log('📋 [Worker请求] 请求类型:', method, '路径:', path);

  await next();

  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log('✅ [Worker响应] 请求完成:', {
    method,
    path,
    status: c.res.status,
    duration: `${duration}ms`,
    timestamp: new Date().toISOString()
  });
});

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

// 基础安全防护（使用更合理的配置）
app.use('*', ddosProtectionMiddleware);      // DDoS防护（已优化配置）

// CORS 配置 - 只使用自定义域名
app.use('*', cors({
  origin: [
    'https://sub.senma.io',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://localhost:3000',
    'http://localhost:5173', // Vite默认端口
    'http://127.0.0.1:5173'
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
}));

// 速率限制（暂时禁用以简化演示）
// app.use('/api/*', rateLimitMiddleware);

// 错误处理
app.onError(errorHandler);

// 健康检查 (无需认证)
app.route('/health', healthRouter);

// 订阅路由 (无需认证，但有速率限制)
app.route('/sub', subscriptionRouter);

// 自定义订阅公开访问路由 (无需认证)
app.route('/subscriptions', publicSubscriptionsRouter);

// 安全加密订阅路由 (无需认证，但有反爬保护)
app.route('/secure', secureSubscriptionsRouter);

// 订阅解析路由 (无需认证，用于前端解析订阅链接)
app.route('/subscription', subscriptionsRouter);

// 时效性订阅访问路由 (无需认证，但有时效性验证)
app.get('/s/:encoded', async (c) => {
  try {
    const encoded = c.req.param('encoded');
    const signature = c.req.query('sig');
    const timestamp = c.req.query('t');

    if (!encoded || !signature) {
      return c.text('Invalid subscription link', 400);
    }

    // 验证时效性链接
    const secretKey = c.env.ADMIN_TOKEN || 'default-secret-key';
    const validation = await validateTimedSubscription(encoded, signature, secretKey);

    if (!validation) {
      return c.text('Invalid or expired subscription link', 403);
    }

    // 获取订阅内容
    const subscriptionsRepo = c.get('subscriptionsRepo');
    if (!subscriptionsRepo) {
      return c.text('Service unavailable', 503);
    }

    const result = await subscriptionsRepo.getById(validation.uuid);
    if (!result.success || !result.data) {
      return c.text('Subscription not found', 404);
    }

    // 记录访问日志
    console.log(`Timed subscription accessed: ${validation.uuid} by user ${validation.userId}`);

    // 返回订阅内容
    const subscription = result.data;
    return c.text(subscription.content || '', 200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

  } catch (error) {
    console.error('Timed subscription access error:', error);
    return c.text('Internal server error', 500);
  }
});

// 时效性订阅链接验证函数 (需要在这里重新定义，因为无法从routes导入)
const validateTimedSubscription = async (encoded: string, signature: string, secretKey: string) => {
  try {
    const payload = atob(encoded);
    const [uuid, userId, expiry] = payload.split(':');

    // 验证签名
    const encoder = new TextEncoder();
    const data = encoder.encode(payload + secretKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const expectedSig = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (signature !== expectedSig) return null;

    // 验证时效性
    if (Date.now() > parseInt(expiry)) return null;

    return { uuid, userId, expiry: parseInt(expiry) };
  } catch {
    return null;
  }
};

// 认证路由
app.route('/auth', authRouter);

// API 路由 (需要认证)
app.use('/api/*', authMiddleware);
app.route('/api/nodes', nodesRouter);
app.route('/api/stats', statsRouter);
app.route('/api/subscriptions', trafficManagementRouter);  // 流量管理路由要在前面，因为更具体
app.route('/api/subscriptions', customSubscriptionsRouter);
app.route('/api/manage/subscriptions', subscriptionsRouter);
app.route('/api/migration', migrationRouter);
app.route('/api/security', securityRouter);

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
