import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { xuiPanels } from './routes/xuiPanels';

type Bindings = {
  DB: D1Database;
  ADMIN_TOKEN: string;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

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
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    service: 'Sub-Store API'
  });
});



// API 路由
app.route('/api/xui-panels', xuiPanels);

// 认证相关路由（简化版本）
app.post('/auth/login', async (c) => {
  try {
    const { username, password } = await c.req.json();
    
    if (!username || !password) {
      return c.json({
        success: false,
        error: '用户名和密码不能为空'
      }, 400);
    }

    // 简化的认证逻辑 - 实际应该从数据库验证
    if (username === 'admin' && password === c.env.ADMIN_TOKEN) {
      // 生成简单的JWT token（实际应该使用JWT库）
      const token = btoa(JSON.stringify({
        username,
        role: 'admin',
        exp: Date.now() + 24 * 60 * 60 * 1000 // 24小时
      }));

      return c.json({
        success: true,
        data: {
          token,
          user: {
            username,
            role: 'admin'
          }
        },
        message: '登录成功'
      });
    }

    return c.json({
      success: false,
      error: '用户名或密码错误'
    }, 401);
  } catch (error) {
    console.error('登录失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 用户信息
app.get('/auth/me', async (c) => {
  try {
    const authorization = c.req.header('Authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: '未提供认证令牌'
      }, 401);
    }

    const token = authorization.substring(7);
    
    try {
      const payload = JSON.parse(atob(token));
      
      if (payload.exp < Date.now()) {
        return c.json({
          success: false,
          error: '令牌已过期'
        }, 401);
      }

      return c.json({
        success: true,
        data: {
          username: payload.username,
          role: payload.role
        }
      });
    } catch {
      return c.json({
        success: false,
        error: '无效的令牌'
      }, 401);
    }
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 节点管理路由（简化版本）
app.get('/api/nodes', async (c) => {
  return c.json({
    success: true,
    data: [],
    total: 0,
    message: '节点功能开发中'
  });
});

// 订阅管理路由（简化版本）
app.get('/api/subscriptions', async (c) => {
  return c.json({
    success: true,
    data: [],
    total: 0,
    message: '订阅功能开发中'
  });
});

// 统计信息
app.get('/api/stats', async (c) => {
  return c.json({
    success: true,
    data: {
      totalNodes: 0,
      totalSubscriptions: 0,
      totalXUIPanels: 0,
      totalRequests: 0
    }
  });
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
