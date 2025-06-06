import { Hono } from 'hono';
import { Env } from '../index';

export const healthRouter = new Hono<{ Bindings: Env }>();

// 基础健康检查
healthRouter.get('/', async (c) => {
  const startTime = Date.now();

  try {
    // 检查数据库健康状态
    let dbHealth = { healthy: true, nodeCount: 0, subscriptionCount: 0 };
    try {
      const db = c.get('db');
      if (db) {
        const { checkDatabaseHealth } = await import('../database/init');
        dbHealth = await checkDatabaseHealth(db);
      }
    } catch (dbError) {
      console.warn('Database health check failed:', dbError);
      dbHealth = { healthy: false, nodeCount: 0, subscriptionCount: 0, error: 'Database check failed' };
    }

    const responseTime = Date.now() - startTime;

    return c.json({
      status: dbHealth.healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'production',
      version: '1.0.0',
      services: {
        api: 'healthy',
        workers: 'healthy',
        database: dbHealth.healthy ? 'healthy' : 'unhealthy',
      },
      database: {
        nodeCount: dbHealth.nodeCount,
        subscriptionCount: dbHealth.subscriptionCount,
        error: dbHealth.error,
      },
      performance: {
        responseTime: `${responseTime}ms`,
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);

    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'production',
      version: '1.0.0',
      services: {
        api: 'unhealthy',
        workers: 'unhealthy',
        database: 'unknown',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 503);
  }
});

// 详细健康检查
healthRouter.get('/detailed', async (c) => {
  const startTime = Date.now();
  const checks: Record<string, any> = {};

  try {
    // 环境变量检查
    checks.environment = {
      status: 'healthy',
      variables: {
        ENVIRONMENT: c.env.ENVIRONMENT || 'not_set',
        APP_NAME: c.env.APP_NAME || 'not_set',
      },
    };

    // 运行时检查
    checks.runtime = {
      status: 'healthy',
      platform: 'Cloudflare Workers',
      timestamp: new Date().toISOString(),
    };

    const totalResponseTime = Date.now() - startTime;
    const allHealthy = Object.values(checks).every(check => check.status === 'healthy');

    return c.json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'production',
      version: '1.0.0',
      totalResponseTime: `${totalResponseTime}ms`,
      checks,
    }, allHealthy ? 200 : 503);

  } catch (error) {
    console.error('Detailed health check failed:', error);

    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'production',
      version: '1.0.0',
      totalResponseTime: `${Date.now() - startTime}ms`,
      error: error instanceof Error ? error.message : 'Unknown error',
      checks,
    }, 503);
  }
});

// 就绪检查
healthRouter.get('/ready', async (c) => {
  try {
    return c.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      message: 'Service is ready to accept requests',
      environment: c.env.ENVIRONMENT || 'production',
    });

  } catch (error) {
    console.error('Readiness check failed:', error);

    return c.json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 503);
  }
});

// 存活检查
healthRouter.get('/live', async (c) => {
  return c.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    platform: 'Cloudflare Workers',
    environment: c.env.ENVIRONMENT || 'production',
  });
});
