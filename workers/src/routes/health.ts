import { Hono } from 'hono';
import { Env } from '../index';

export const healthRouter = new Hono<{ Bindings: Env }>();

// 基础健康检查
healthRouter.get('/', async (c) => {
  const startTime = Date.now();

  try {
    // 测试数据库连接（如果配置了 D1）
    let dbStatus = 'not_configured';
    if (c.env.DB) {
      try {
        // 简单的数据库连接测试
        const result = await c.env.DB.prepare('SELECT 1 as test').first();
        dbStatus = result ? 'healthy' : 'unhealthy';
      } catch (dbError) {
        console.warn('Database test failed:', dbError);
        dbStatus = 'unhealthy';
      }
    }

    const responseTime = Date.now() - startTime;

    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'production',
      version: '1.0.0',
      services: {
        database: dbStatus,
        api: 'healthy',
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
        database: 'error',
        api: 'unhealthy',
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
    // 数据库检查
    const dbStartTime = Date.now();
    if (c.env.DB) {
      try {
        const result = await c.env.DB.prepare('SELECT 1 as test').first();
        checks.database = {
          status: result ? 'healthy' : 'unhealthy',
          responseTime: `${Date.now() - dbStartTime}ms`,
          type: 'D1',
        };
      } catch (error) {
        checks.database = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
          responseTime: `${Date.now() - dbStartTime}ms`,
          type: 'D1',
        };
      }
    } else {
      checks.database = {
        status: 'not_configured',
        message: 'D1 database not configured',
        type: 'D1',
      };
    }
    
    // 环境变量检查
    checks.environment = {
      status: 'healthy',
      variables: {
        ADMIN_TOKEN: !!c.env.ADMIN_TOKEN,
        JWT_SECRET: !!c.env.JWT_SECRET,
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
      environment: c.env.ENVIRONMENT || 'unknown',
      version: '1.0.0',
      totalResponseTime: `${totalResponseTime}ms`,
      checks,
    }, allHealthy ? 200 : 503);
    
  } catch (error) {
    console.error('Detailed health check failed:', error);
    
    return c.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'unknown',
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
    // 检查必要的环境变量
    const requiredEnvVars = ['ENVIRONMENT', 'APP_NAME'];
    const missingVars = requiredEnvVars.filter(varName => !c.env[varName as keyof Env]);

    if (missingVars.length > 0) {
      return c.json({
        status: 'not_ready',
        message: 'Missing required environment variables',
        missingVariables: missingVars,
      }, 503);
    }

    // 检查数据库连接（如果配置了）
    if (c.env.DB) {
      try {
        await c.env.DB.prepare('SELECT 1').first();
      } catch (dbError) {
        return c.json({
          status: 'not_ready',
          message: 'Database connection failed',
          error: dbError instanceof Error ? dbError.message : 'Unknown database error',
        }, 503);
      }
    }

    return c.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      message: 'Service is ready to accept requests',
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
