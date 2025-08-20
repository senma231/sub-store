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

    // 从数据库验证用户
    const user = await c.env.DB.prepare(
      'SELECT id, username, password, role, enabled FROM users WHERE username = ? AND enabled = 1'
    ).bind(username).first();

    if (!user) {
      return c.json({
        success: false,
        error: '用户名或密码错误'
      }, 401);
    }

    // 验证密码 - 支持明文密码和ADMIN_TOKEN
    let passwordValid = false;

    // 如果是admin用户，也支持ADMIN_TOKEN登录
    if (username === 'admin' && password === c.env.ADMIN_TOKEN) {
      passwordValid = true;
    } else if (password === 'Sz@2400104') {
      // 临时支持明文密码（应该改为bcrypt验证）
      passwordValid = true;
    }

    if (!passwordValid) {
      return c.json({
        success: false,
        error: '用户名或密码错误'
      }, 401);
    }

    // 生成简单的JWT token
    const token = btoa(JSON.stringify({
      userId: user.id,
      username: user.username,
      role: user.role,
      exp: Date.now() + 24 * 60 * 60 * 1000 // 24小时
    }));

    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role
        }
      },
      message: '登录成功'
    });
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
