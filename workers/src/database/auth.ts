import { Database } from './index';
import { DbUser, DbSession, AuthUser, DbResult } from '../../../shared/types';

export class AuthRepository {
  constructor(private db: Database) {}

  // 根据用户名获取用户
  async getUserByUsername(username: string): Promise<DbResult<DbUser | null>> {
    try {
      const result = await this.db.queryFirst<DbUser>(
        'SELECT * FROM users WHERE username = ? AND enabled = 1',
        [username]
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to get user: ${error}`
      };
    }
  }

  // 根据 ID 获取用户
  async getUserById(id: string): Promise<DbResult<DbUser | null>> {
    try {
      const result = await this.db.queryFirst<DbUser>(
        'SELECT * FROM users WHERE id = ? AND enabled = 1',
        [id]
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to get user: ${error}`
      };
    }
  }

  // 创建用户
  async createUser(user: {
    id: string;
    username: string;
    password: string;
    role?: string;
    email?: string;
  }): Promise<DbResult<DbUser>> {
    try {
      const now = new Date().toISOString();
      
      const result = await this.db.execute(
        `INSERT INTO users (id, username, password, role, email, created_at, updated_at, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          user.id,
          user.username,
          user.password,
          user.role || 'user',
          user.email,
          now,
          now
        ]
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const newUser: DbUser = {
        id: user.id,
        username: user.username,
        password: user.password,
        role: user.role || 'user',
        email: user.email,
        created_at: now,
        updated_at: now,
        enabled: true
      };

      return { success: true, data: newUser };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create user: ${error}`
      };
    }
  }

  // 更新用户密码
  async updateUserPassword(userId: string, newPassword: string): Promise<DbResult<void>> {
    try {
      const result = await this.db.execute(
        'UPDATE users SET password = ?, updated_at = ? WHERE id = ?',
        [newPassword, new Date().toISOString(), userId]
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to update password: ${error}`
      };
    }
  }

  // 更新最后登录时间
  async updateLastLogin(userId: string): Promise<DbResult<void>> {
    try {
      const result = await this.db.execute(
        'UPDATE users SET last_login = ? WHERE id = ?',
        [new Date().toISOString(), userId]
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to update last login: ${error}`
      };
    }
  }

  // 创建会话
  async createSession(session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: string;
  }): Promise<DbResult<DbSession>> {
    try {
      const now = new Date().toISOString();
      
      const result = await this.db.execute(
        `INSERT INTO sessions (id, user_id, token, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [session.id, session.userId, session.token, session.expiresAt, now]
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const newSession: DbSession = {
        id: session.id,
        user_id: session.userId,
        token: session.token,
        expires_at: session.expiresAt,
        created_at: now
      };

      return { success: true, data: newSession };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create session: ${error}`
      };
    }
  }

  // 根据 token 获取会话
  async getSessionByToken(token: string): Promise<DbResult<DbSession | null>> {
    try {
      const result = await this.db.queryFirst<DbSession>(
        'SELECT * FROM sessions WHERE token = ? AND expires_at > ?',
        [token, new Date().toISOString()]
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to get session: ${error}`
      };
    }
  }

  // 删除会话
  async deleteSession(token: string): Promise<DbResult<void>> {
    try {
      const result = await this.db.execute(
        'DELETE FROM sessions WHERE token = ?',
        [token]
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete session: ${error}`
      };
    }
  }

  // 删除用户的所有会话
  async deleteUserSessions(userId: string): Promise<DbResult<void>> {
    try {
      const result = await this.db.execute(
        'DELETE FROM sessions WHERE user_id = ?',
        [userId]
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete user sessions: ${error}`
      };
    }
  }

  // 清理过期会话
  async cleanupExpiredSessions(): Promise<DbResult<{ deletedCount: number }>> {
    try {
      const result = await this.db.execute(
        'DELETE FROM sessions WHERE expires_at <= ?',
        [new Date().toISOString()]
      );

      return {
        success: result.success,
        data: { deletedCount: result.meta?.changes || 0 },
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to cleanup expired sessions: ${error}`
      };
    }
  }

  // 数据库用户转换为 API 用户
  static dbUserToAuthUser(dbUser: DbUser): AuthUser {
    return {
      id: dbUser.id,
      username: dbUser.username,
      role: dbUser.role as 'admin' | 'user',
      permissions: dbUser.role === 'admin' ? ['*'] : ['read'],
      createdAt: dbUser.created_at,
      lastLogin: dbUser.last_login
    };
  }

  // 验证用户权限
  async hasPermission(userId: string, permission: string): Promise<DbResult<boolean>> {
    try {
      const userResult = await this.getUserById(userId);
      
      if (!userResult.success || !userResult.data) {
        return { success: false, error: 'User not found' };
      }

      const user = userResult.data;
      const hasPermission = user.role === 'admin' || permission === 'read';

      return { success: true, data: hasPermission };
    } catch (error) {
      return {
        success: false,
        error: `Failed to check permission: ${error}`
      };
    }
  }

  // 获取用户列表（仅管理员）
  async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
  } = {}): Promise<DbResult<{
    items: AuthUser[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>> {
    try {
      const { page = 1, limit = 20, search } = params;
      const offset = (page - 1) * limit;

      let whereClause = 'WHERE enabled = 1';
      const queryParams: any[] = [];

      if (search) {
        whereClause += ' AND (username LIKE ? OR email LIKE ?)';
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern);
      }

      // 获取总数
      const countResult = await this.db.queryFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM users ${whereClause}`,
        queryParams
      );

      if (!countResult.success) {
        return { success: false, error: countResult.error };
      }

      const total = countResult.data?.count || 0;

      // 获取数据
      const dataResult = await this.db.query<DbUser>(
        `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      );

      if (!dataResult.success) {
        return { success: false, error: dataResult.error };
      }

      const users = (dataResult.data || []).map(AuthRepository.dbUserToAuthUser);

      return {
        success: true,
        data: {
          items: users,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get users: ${error}`
      };
    }
  }
}
