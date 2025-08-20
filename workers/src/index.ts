import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { xuiPanels } from './routes/xuiPanels';
import { nodes } from './routes/nodes';
import { subscriptions } from './routes/subscriptions';
import { auth } from './routes/auth';
import { NodeRepository } from './repositories/nodeRepository';
import { SubscriptionRepository } from './repositories/subscriptionRepository';
import { XUIPanelRepository } from './repositories/xuiPanelRepository';
import { initializeDatabase, checkDatabaseHealth } from './database/init';

type Bindings = {
  DB: D1Database;
  ADMIN_TOKEN: string;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// 数据库初始化中间件
app.use('*', async (c, next) => {
  try {
    // 检查数据库是否已初始化
    const tables = await c.env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='users'
    `).first();

    if (!tables) {
      console.log('数据库未初始化，开始初始化...');
      const initResult = await initializeDatabase(c.env.DB);
      if (!initResult.success) {
        console.error('数据库初始化失败:', initResult.error);
        return c.json({
          success: false,
          error: '数据库初始化失败',
          details: initResult.error
        }, 500);
      }
      console.log('数据库初始化成功');
    }

    await next();
  } catch (error) {
    console.error('数据库中间件错误:', error);
    return c.json({
      success: false,
      error: '数据库连接失败'
    }, 500);
  }
});

// 中间件
app.use('*', logger());

// CORS 配置
app.use('*', cors({
  origin: [
    'https://sub.senma.io',
    'https://sub-store-frontend.pages.dev',
    'https://senma231.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://localhost:3000'
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// 健康检查
app.get('/health', async (c) => {
  try {
    // 检查数据库健康状态
    const dbHealth = await checkDatabaseHealth(c.env.DB);

    return c.json({
      status: dbHealth.success ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      service: 'Sub-Store API',
      database: dbHealth.success ? dbHealth.data : { healthy: false, error: dbHealth.error }
    });
  } catch (error) {
    console.error('健康检查失败:', error);
    return c.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      service: 'Sub-Store API',
      database: { healthy: false, error: '数据库连接失败' }
    }, 500);
  }
});



// API 路由
app.route('/api/xui-panels', xuiPanels);
app.route('/api/nodes', nodes);
app.route('/api/subscriptions', subscriptions);
app.route('/auth', auth);

// 统计信息
app.get('/api/stats', async (c) => {
  try {
    const nodeRepo = new NodeRepository(c.env.DB);
    const subRepo = new SubscriptionRepository(c.env.DB);
    const xuiRepo = new XUIPanelRepository(c.env.DB);

    const [nodeStats, subStats, xuiPanels] = await Promise.all([
      nodeRepo.getStats(),
      subRepo.getStats(),
      xuiRepo.findAll()
    ]);

    return c.json({
      success: true,
      data: {
        totalNodes: nodeStats.success ? nodeStats.data?.total || 0 : 0,
        totalSubscriptions: subStats.success ? subStats.data?.total || 0 : 0,
        totalXUIPanels: xuiPanels.success ? xuiPanels.data?.length || 0 : 0,
        totalRequests: 0
      }
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 404 处理
app.notFound((c) => {
  return c.json({
    success: false,
    error: '接口不存在',
    path: c.req.path,
    method: c.req.method
  }, 404);
});

// 错误处理
app.onError((err, c) => {
  console.error('服务器错误:', err);
  return c.json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  }, 500);
});

export default app;
