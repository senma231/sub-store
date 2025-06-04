import { Context, Next } from 'hono';
import { jwtVerify } from 'jose';
import { Env } from '../index';

export interface AuthContext {
  user: {
    id: string;
    username: string;
    role: string;
  };
}

export async function authMiddleware(c: Context<Env>, next: Next) {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader) {
      return c.json({
        success: false,
        error: 'Unauthorized',
        message: 'Authorization header is required',
      }, 401);
    }

    // 检查 Bearer token
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const secret = new TextEncoder().encode(c.env.JWT_SECRET);
        const { payload } = await jwtVerify(token, secret);
        
        // 将用户信息添加到上下文
        c.set('user', {
          id: payload.userId as string,
          username: payload.username as string,
          role: payload.role as string,
        });
        
        return next();
      } catch (error) {
        return c.json({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid JWT token',
        }, 401);
      }
    }
    
    // 检查 Admin token (用于管理员操作)
    if (authHeader.startsWith('Admin ')) {
      const token = authHeader.substring(6);
      
      if (token === c.env.ADMIN_TOKEN) {
        c.set('user', {
          id: 'admin',
          username: 'admin',
          role: 'admin',
        });
        
        return next();
      }
    }

    return c.json({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid authorization token',
    }, 401);
    
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Authentication failed',
    }, 500);
  }
}

export function requireRole(role: string) {
  return async (c: Context<Env>, next: Next) => {
    const user = c.get('user') as AuthContext['user'];
    
    if (!user) {
      return c.json({
        success: false,
        error: 'Unauthorized',
        message: 'User not authenticated',
      }, 401);
    }
    
    if (user.role !== role && user.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Forbidden',
        message: `Role '${role}' required`,
      }, 403);
    }
    
    return next();
  };
}
