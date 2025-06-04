import { Hono } from 'hono';
import { Env } from '../index';

export const healthRouter = new Hono<{ Bindings: Env }>();

// 基础健康检查
healthRouter.get('/', async (c) => {
  const startTime = Date.now();
  
  try {
    // 测试 KV 存储连接
    const kvTest = await c.env.SUB_STORE_KV.get('health_check');
    await c.env.SUB_STORE_KV.put('health_check', Date.now().toString(), { expirationTtl: 60 });
    
    const responseTime = Date.now() - startTime;
    
    return c.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: c.env.ENVIRONMENT || 'unknown',
      version: '1.0.0',
      services: {
        kv: 'healthy',
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
      environment: c.env.ENVIRONMENT || 'unknown',
      version: '1.0.0',
      services: {
        kv: 'unhealthy',
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
    // KV 存储检查
    const kvStartTime = Date.now();
    try {
      await c.env.SUB_STORE_KV.get('health_check');
      await c.env.SUB_STORE_KV.put('health_check_detailed', Date.now().toString(), { expirationTtl: 60 });
      checks.kv = {
        status: 'healthy',
        responseTime: `${Date.now() - kvStartTime}ms`,
      };
    } catch (error) {
      checks.kv = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: `${Date.now() - kvStartTime}ms`,
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
    
    // 内存使用检查 (如果可用)
    if (typeof performance !== 'undefined' && performance.memory) {
      checks.memory = {
        status: 'healthy',
        used: `${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB`,
        total: `${Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)}MB`,
        limit: `${Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)}MB`,
      };
    }
    
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
    const requiredEnvVars = ['ADMIN_TOKEN', 'JWT_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !c.env[varName as keyof Env]);
    
    if (missingVars.length > 0) {
      return c.json({
        status: 'not_ready',
        message: 'Missing required environment variables',
        missingVariables: missingVars,
      }, 503);
    }
    
    // 检查 KV 存储
    await c.env.SUB_STORE_KV.get('readiness_check');
    
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
    uptime: process.uptime ? `${Math.floor(process.uptime())}s` : 'unknown',
  });
});
