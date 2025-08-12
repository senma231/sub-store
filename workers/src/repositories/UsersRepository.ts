import { D1Database } from '@cloudflare/workers-types';
import { v4 as uuidv4 } from 'uuid';
// import bcrypt from 'bcryptjs';

// 使用Web Crypto API替代bcrypt，因为bcryptjs在Cloudflare Workers中可能不兼容
class WebCryptoBcrypt {
  static async hash(password: string, saltRounds: number = 10): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `$2a$${saltRounds}$${hashHex}`;
  }

  static async compare(password: string, hash: string): Promise<boolean> {
    // 简单实现：重新哈希密码并比较
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 提取原始哈希的十六进制部分
    const hashParts = hash.split('$');
    if (hashParts.length >= 4) {
      return hashHex === hashParts[3];
    }

    // 如果是旧的明文密码，直接比较
    return password === hash;
  }
}

const bcrypt = WebCryptoBcrypt;

export interface User {
  id: string;
  username: string;
  password: string;
  role: string;
  email?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  enabled: boolean;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role?: string;
  email?: string;
}

export interface UpdateUserRequest {
  username?: string;
  password?: string;
  role?: string;
  email?: string;
  enabled?: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export class UsersRepository {
  constructor(private db: D1Database) {}

  async createUser(data: CreateUserRequest): Promise<{ success: boolean; data?: User; error?: string }> {
    try {
      const id = uuidv4();
      const hashedPassword = await bcrypt.hash(data.password, 10);
      
      const stmt = this.db.prepare(`
        INSERT INTO users (id, username, password, role, email, created_at, updated_at, enabled)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'), 1)
      `);
      
      await stmt.bind(
        id,
        data.username,
        hashedPassword,
        data.role || 'user',
        data.email || null
      ).run();

      const user = await this.getUserById(id);
      return { success: true, data: user.data };
    } catch (error: any) {
      console.error('创建用户失败:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserById(id: string): Promise<{ success: boolean; data?: User; error?: string }> {
    try {
      const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
      const result = await stmt.bind(id).first();
      
      if (!result) {
        return { success: false, error: '用户不存在' };
      }

      return { success: true, data: result as User };
    } catch (error: any) {
      console.error('获取用户失败:', error);
      return { success: false, error: error.message };
    }
  }

  async getUserByUsername(username: string): Promise<{ success: boolean; data?: User; error?: string }> {
    try {
      const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
      const result = await stmt.bind(username).first();
      
      if (!result) {
        return { success: false, error: '用户不存在' };
      }

      return { success: true, data: result as User };
    } catch (error: any) {
      console.error('获取用户失败:', error);
      return { success: false, error: error.message };
    }
  }

  async updateUser(id: string, data: UpdateUserRequest): Promise<{ success: boolean; data?: User; error?: string }> {
    try {
      const updates: string[] = [];
      const values: any[] = [];

      if (data.username !== undefined) {
        updates.push('username = ?');
        values.push(data.username);
      }
      
      if (data.password !== undefined) {
        const hashedPassword = await bcrypt.hash(data.password, 10);
        updates.push('password = ?');
        values.push(hashedPassword);
      }
      
      if (data.role !== undefined) {
        updates.push('role = ?');
        values.push(data.role);
      }
      
      if (data.email !== undefined) {
        updates.push('email = ?');
        values.push(data.email);
      }
      
      if (data.enabled !== undefined) {
        updates.push('enabled = ?');
        values.push(data.enabled ? 1 : 0);
      }

      if (updates.length === 0) {
        return { success: false, error: '没有要更新的字段' };
      }

      updates.push('updated_at = datetime(\'now\')');
      values.push(id);

      const stmt = this.db.prepare(`
        UPDATE users SET ${updates.join(', ')} WHERE id = ?
      `);
      
      await stmt.bind(...values).run();

      const user = await this.getUserById(id);
      return { success: true, data: user.data };
    } catch (error: any) {
      console.error('更新用户失败:', error);
      return { success: false, error: error.message };
    }
  }

  async deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
      await stmt.bind(id).run();
      
      return { success: true };
    } catch (error: any) {
      console.error('删除用户失败:', error);
      return { success: false, error: error.message };
    }
  }

  async validatePassword(username: string, password: string): Promise<{ success: boolean; data?: User; error?: string }> {
    try {
      const userResult = await this.getUserByUsername(username);
      if (!userResult.success || !userResult.data) {
        return { success: false, error: '用户名或密码错误' };
      }

      const user = userResult.data;
      if (!user.enabled) {
        return { success: false, error: '用户已被禁用' };
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return { success: false, error: '用户名或密码错误' };
      }

      // 更新最后登录时间
      await this.updateLastLogin(user.id);

      return { success: true, data: user };
    } catch (error: any) {
      console.error('验证密码失败:', error);
      return { success: false, error: error.message };
    }
  }

  async updateLastLogin(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const stmt = this.db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?');
      await stmt.bind(id).run();
      
      return { success: true };
    } catch (error: any) {
      console.error('更新最后登录时间失败:', error);
      return { success: false, error: error.message };
    }
  }

  async changePassword(id: string, data: ChangePasswordRequest): Promise<{ success: boolean; error?: string }> {
    try {
      const userResult = await this.getUserById(id);
      if (!userResult.success || !userResult.data) {
        return { success: false, error: '用户不存在' };
      }

      const user = userResult.data;
      const isCurrentPasswordValid = await bcrypt.compare(data.currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return { success: false, error: '当前密码错误' };
      }

      const hashedNewPassword = await bcrypt.hash(data.newPassword, 10);
      const stmt = this.db.prepare('UPDATE users SET password = ?, updated_at = datetime(\'now\') WHERE id = ?');
      await stmt.bind(hashedNewPassword, id).run();

      return { success: true };
    } catch (error: any) {
      console.error('修改密码失败:', error);
      return { success: false, error: error.message };
    }
  }

  async getUsers(page: number = 1, limit: number = 10): Promise<{ success: boolean; data?: { items: User[]; total: number; page: number; limit: number }; error?: string }> {
    try {
      const offset = (page - 1) * limit;

      // 获取总数
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM users');
      const countResult = await countStmt.first();
      const total = (countResult as any)?.count || 0;

      // 获取用户列表
      const stmt = this.db.prepare(`
        SELECT * FROM users
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `);
      const results = await stmt.bind(limit, offset).all();

      return {
        success: true,
        data: {
          items: results.results as User[],
          total,
          page,
          limit
        }
      };
    } catch (error: any) {
      console.error('获取用户列表失败:', error);
      return { success: false, error: error.message };
    }
  }

  // 初始化默认管理员用户（如果不存在）
  async initializeDefaultAdmin(adminToken: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 检查是否已有管理员用户
      const adminResult = await this.getUserByUsername('admin');

      if (!adminResult.success) {
        // 创建默认管理员
        const createResult = await this.createUser({
          username: 'admin',
          password: adminToken,
          role: 'admin'
        });

        if (!createResult.success) {
          return { success: false, error: createResult.error };
        }

        console.log('默认管理员用户已创建');
      } else {
        // 如果管理员存在但密码是默认值，则更新为环境变量中的密码
        const admin = adminResult.data!;
        const isDefaultPassword = await bcrypt.compare('change_me_on_first_deploy', admin.password);

        if (isDefaultPassword) {
          const updateResult = await this.updateUser(admin.id, { password: adminToken });
          if (!updateResult.success) {
            return { success: false, error: updateResult.error };
          }
          console.log('管理员密码已更新为环境变量值');
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error('初始化默认管理员失败:', error);
      return { success: false, error: error.message };
    }
  }
}
