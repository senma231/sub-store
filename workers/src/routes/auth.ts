import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  ADMIN_TOKEN: string;
  JWT_SECRET: string;
};

const auth = new Hono<{ Bindings: Bindings }>();

// 登录
auth.post('/login', async (c) => {
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

// 获取用户信息
auth.get('/me', async (c) => {
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

// 登出（客户端处理，服务端无需特殊处理）
auth.post('/logout', async (c) => {
  return c.json({
    success: true,
    message: '登出成功'
  });
});

// 刷新令牌
auth.post('/refresh', async (c) => {
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
      
      // 检查令牌是否即将过期（1小时内）
      const oneHour = 60 * 60 * 1000;
      if (payload.exp - Date.now() > oneHour) {
        return c.json({
          success: false,
          error: '令牌尚未到期，无需刷新'
        }, 400);
      }

      // 生成新令牌
      const newToken = btoa(JSON.stringify({
        username: payload.username,
        role: payload.role,
        exp: Date.now() + 24 * 60 * 60 * 1000 // 24小时
      }));

      return c.json({
        success: true,
        data: {
          token: newToken,
          user: {
            username: payload.username,
            role: payload.role
          }
        },
        message: '令牌刷新成功'
      });
    } catch {
      return c.json({
        success: false,
        error: '无效的令牌'
      }, 401);
    }
  } catch (error) {
    console.error('刷新令牌失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

export { auth };
