import { Hono } from 'hono';
import { SignJWT, jwtVerify } from 'jose';
import { Env } from '../index';

export const authRouter = new Hono<Env>();

// 登录
authRouter.post('/login', async (c) => {
  try {
    const { username, password } = await c.req.json();
    
    if (!username || !password) {
      return c.json({
        success: false,
        error: 'Missing credentials',
        message: 'Username and password are required',
      }, 400);
    }
    
    // 验证管理员凭据
    if (username === 'admin' && password === c.env.ADMIN_TOKEN) {
      const secret = new TextEncoder().encode(c.env.JWT_SECRET);

      const token = await new SignJWT({
        userId: 'admin',
        username: 'admin',
        role: 'admin',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);
      
      return c.json({
        success: true,
        data: {
          token,
          user: {
            id: 'admin',
            username: 'admin',
            role: 'admin',
          },
          expiresIn: 24 * 60 * 60,
        },
        message: 'Login successful',
      });
    }
    
    // 检查其他用户 (从数据库)
    if (c.env.DB) {
      try {
        const authRepo = c.get('authRepo');
        const userResult = await authRepo.getUserByUsername(username);

        if (userResult.success && userResult.data && userResult.data.password === password) {
          const user = userResult.data;
          const secret = new TextEncoder().encode(c.env.JWT_SECRET);

          const token = await new SignJWT({
            userId: user.id,
            username: user.username,
            role: user.role || 'user',
          })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('24h')
            .sign(secret);

          // 更新最后登录时间
          await authRepo.updateLastLogin(user.id);

          return c.json({
            success: true,
            data: {
              token,
              user: {
                id: user.id,
                username: user.username,
                role: user.role || 'user',
              },
              expiresIn: 24 * 60 * 60,
            },
            message: 'Login successful',
          });
        }
      } catch (dbError) {
        console.warn('Database user lookup failed:', dbError);
        // 继续执行，返回无效凭据错误
      }
    }
    
    return c.json({
      success: false,
      error: 'Invalid credentials',
      message: 'Username or password is incorrect',
    }, 401);
    
  } catch (error) {
    console.error('Login error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: 'Login failed',
    }, 500);
  }
});

// 验证 token
authRouter.post('/verify', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: 'Missing token',
        message: 'Authorization header with Bearer token is required',
      }, 401);
    }
    
    const token = authHeader.substring(7);
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    
    try {
      const { payload } = await jwtVerify(token, secret);

      return c.json({
        success: true,
        data: {
          user: {
            id: payload.userId,
            username: payload.username,
            role: payload.role,
          },
          expiresAt: new Date((payload.exp as number) * 1000).toISOString(),
        },
        message: 'Token is valid',
      });

    } catch (verifyError) {
      return c.json({
        success: false,
        error: 'Invalid token',
        message: 'Token is expired or invalid',
      }, 401);
    }
    
  } catch (error) {
    console.error('Token verification error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: 'Token verification failed',
    }, 500);
  }
});

// 刷新 token
authRouter.post('/refresh', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: 'Missing token',
        message: 'Authorization header with Bearer token is required',
      }, 401);
    }
    
    const token = authHeader.substring(7);
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    
    try {
      const { payload } = await jwtVerify(token, secret);

      // 生成新 token
      const newToken = await new SignJWT({
        userId: payload.userId,
        username: payload.username,
        role: payload.role,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);

      return c.json({
        success: true,
        data: {
          token: newToken,
          user: {
            id: payload.userId,
            username: payload.username,
            role: payload.role,
          },
          expiresIn: 24 * 60 * 60,
        },
        message: 'Token refreshed successfully',
      });

    } catch (verifyError) {
      return c.json({
        success: false,
        error: 'Invalid token',
        message: 'Cannot refresh expired or invalid token',
      }, 401);
    }
    
  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: 'Token refresh failed',
    }, 500);
  }
});

// 登出 (客户端处理，服务端无需特殊处理)
authRouter.post('/logout', async (c) => {
  return c.json({
    success: true,
    message: 'Logout successful',
  });
});

// 修改密码
authRouter.post('/change-password', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        success: false,
        error: 'Unauthorized',
        message: 'Authorization required',
      }, 401);
    }
    
    const token = authHeader.substring(7);
    const secret = new TextEncoder().encode(c.env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    const { currentPassword, newPassword } = await c.req.json();

    if (!currentPassword || !newPassword) {
      return c.json({
        success: false,
        error: 'Missing passwords',
        message: 'Current password and new password are required',
      }, 400);
    }

    // 管理员密码修改需要特殊处理
    if (payload.username === 'admin') {
      return c.json({
        success: false,
        error: 'Not allowed',
        message: 'Admin password cannot be changed via API',
      }, 403);
    }

    // 修改普通用户密码 (使用数据库)
    if (c.env.DB) {
      try {
        const authRepo = c.get('authRepo');
        const userResult = await authRepo.getUserById(payload.userId as string);

        if (!userResult.success || !userResult.data) {
          return c.json({
            success: false,
            error: 'User not found',
            message: 'User does not exist',
          }, 404);
        }

        const user = userResult.data;
        if (user.password !== currentPassword) {
          return c.json({
            success: false,
            error: 'Invalid password',
            message: 'Current password is incorrect',
          }, 400);
        }

        await authRepo.updateUserPassword(user.id, newPassword);

        return c.json({
          success: true,
          message: 'Password changed successfully',
        });
      } catch (dbError) {
        console.error('Database error during password change:', dbError);
        return c.json({
          success: false,
          error: 'Database error',
          message: 'Failed to update password',
        }, 500);
      }
    }

    return c.json({
      success: false,
      error: 'Service unavailable',
      message: 'Database not configured',
    }, 503);
    
  } catch (error) {
    console.error('Change password error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: 'Password change failed',
    }, 500);
  }
});
