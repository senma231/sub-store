import { Context, Next } from 'hono';

type Bindings = {
  DB: D1Database;
  ADMIN_TOKEN: string;
  JWT_SECRET: string;
};

type Variables = {
  user?: {
    username: string;
    role: string;
  };
};

type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

/**
 * 统一的认证中间件
 * 支持两种认证方式：
 * 1. ADMIN_TOKEN 直接认证
 * 2. JWT Token 认证
 */
export const authMiddleware = async (c: AppContext, next: Next) => {
  try {
    const authorization = c.req.header('Authorization');
    
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: 'Unauthorized',
        message: 'Authorization header is required'
      }, 401);
    }

    const token = authorization.substring(7);

    // 方式1: 直接使用ADMIN_TOKEN认证
    if (token === c.env.ADMIN_TOKEN) {
      await next();
      return;
    }

    // 方式2: JWT Token认证
    if (token.includes('.')) {
      try {
        // 简化的JWT验证（实际应该使用JWT库）
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          
          // 检查过期时间
          if (payload.exp && payload.exp > Date.now()) {
            // 将用户信息添加到上下文中
            c.set('user', {
              username: payload.username,
              role: payload.role
            });
            await next();
            return;
          }
        }
      } catch (error) {
        console.error('JWT解析失败:', error);
        // 继续到错误处理
      }
    }

    return c.json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    }, 401);
  } catch (error) {
    console.error('认证中间件错误:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Authentication failed'
    }, 500);
  }
};

/**
 * 可选的认证中间件
 * 如果提供了有效的认证信息，会设置用户上下文
 * 如果没有提供或无效，不会阻止请求继续
 */
export const optionalAuthMiddleware = async (c: AppContext, next: Next) => {
  try {
    const authorization = c.req.header('Authorization');
    
    if (authorization && authorization.startsWith('Bearer ')) {
      const token = authorization.substring(7);

      // 尝试认证但不阻止请求
      if (token === c.env.ADMIN_TOKEN) {
        c.set('user', {
          username: 'admin',
          role: 'admin'
        });
      } else if (token.includes('.')) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            
            if (payload.exp && payload.exp > Date.now()) {
              c.set('user', {
                username: payload.username,
                role: payload.role
              });
            }
          }
        } catch (error) {
          // 忽略JWT解析错误，继续处理请求
          console.warn('可选认证JWT解析失败:', error);
        }
      }
    }

    await next();
  } catch (error) {
    console.error('可选认证中间件错误:', error);
    // 即使出错也继续处理请求
    await next();
  }
};

/**
 * 管理员权限检查中间件
 * 需要在authMiddleware之后使用
 */
export const adminOnlyMiddleware = async (c: AppContext, next: Next) => {
  try {
    const user = c.get('user');
    
    if (!user || user.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Forbidden',
        message: 'Admin privileges required'
      }, 403);
    }

    await next();
  } catch (error) {
    console.error('管理员权限检查错误:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Permission check failed'
    }, 500);
  }
};

/**
 * 获取当前用户信息的辅助函数
 */
export const getCurrentUser = (c: AppContext) => {
  return c.get('user') || null;
};

/**
 * 检查用户是否有特定权限的辅助函数
 */
export const hasPermission = (c: AppContext, permission: string): boolean => {
  const user = c.get('user');
  
  if (!user) {
    return false;
  }

  // 管理员拥有所有权限
  if (user.role === 'admin') {
    return true;
  }

  // 这里可以扩展更复杂的权限检查逻辑
  return false;
};
