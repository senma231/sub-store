import { Database, DbResult } from './index';

export interface CustomSubscription {
  id: string;
  uuid: string;
  name: string;
  nodeIds: string[];
  format: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  accessCount: number;
  lastAccessAt?: string;
}

export interface DbCustomSubscription {
  id: string;
  uuid: string;
  name: string;
  node_ids: string; // JSON string
  format: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
  access_count: number;
  last_access_at?: string;
}

export class CustomSubscriptionsRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // 创建自定义订阅表
  async createTable(): Promise<DbResult<void>> {
    const sql = `
      CREATE TABLE IF NOT EXISTS custom_subscriptions (
        id TEXT PRIMARY KEY,
        uuid TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        node_ids TEXT NOT NULL,
        format TEXT NOT NULL,
        expires_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        access_count INTEGER DEFAULT 0,
        last_access_at TEXT
      )
    `;
    
    return this.db.execute(sql);
  }

  // 创建索引
  async createIndexes(): Promise<DbResult<void>> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_custom_subscriptions_uuid ON custom_subscriptions(uuid)',
      'CREATE INDEX IF NOT EXISTS idx_custom_subscriptions_created_at ON custom_subscriptions(created_at)',
    ];

    for (const sql of indexes) {
      const result = await this.db.execute(sql);
      if (!result.success) {
        return result;
      }
    }

    return { success: true };
  }

  // 创建自定义订阅
  async create(subscription: Omit<CustomSubscription, 'id' | 'createdAt' | 'updatedAt' | 'accessCount'>): Promise<DbResult<CustomSubscription>> {
    const now = new Date().toISOString();
    const id = `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const dbSubscription: DbCustomSubscription = {
      id,
      uuid: subscription.uuid,
      name: subscription.name,
      node_ids: JSON.stringify(subscription.nodeIds),
      format: subscription.format,
      expires_at: subscription.expiresAt,
      created_at: now,
      updated_at: now,
      access_count: 0,
      last_access_at: undefined,
    };

    const sql = `
      INSERT INTO custom_subscriptions (
        id, uuid, name, node_ids, format, expires_at, 
        created_at, updated_at, access_count, last_access_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.execute(sql, [
      dbSubscription.id,
      dbSubscription.uuid,
      dbSubscription.name,
      dbSubscription.node_ids,
      dbSubscription.format,
      dbSubscription.expires_at,
      dbSubscription.created_at,
      dbSubscription.updated_at,
      dbSubscription.access_count,
      dbSubscription.last_access_at,
    ]);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const createdSubscription: CustomSubscription = {
      id: dbSubscription.id,
      uuid: dbSubscription.uuid,
      name: dbSubscription.name,
      nodeIds: JSON.parse(dbSubscription.node_ids),
      format: dbSubscription.format,
      expiresAt: dbSubscription.expires_at,
      createdAt: dbSubscription.created_at,
      updatedAt: dbSubscription.updated_at,
      accessCount: dbSubscription.access_count,
      lastAccessAt: dbSubscription.last_access_at,
    };

    return { success: true, data: createdSubscription };
  }

  // 根据UUID获取自定义订阅
  async getByUuid(uuid: string): Promise<DbResult<CustomSubscription | null>> {
    const sql = 'SELECT * FROM custom_subscriptions WHERE uuid = ?';
    const result = await this.db.queryFirst<DbCustomSubscription>(sql, [uuid]);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (!result.data) {
      return { success: true, data: null };
    }

    const subscription: CustomSubscription = {
      id: result.data.id,
      uuid: result.data.uuid,
      name: result.data.name,
      nodeIds: JSON.parse(result.data.node_ids),
      format: result.data.format,
      expiresAt: result.data.expires_at,
      createdAt: result.data.created_at,
      updatedAt: result.data.updated_at,
      accessCount: result.data.access_count,
      lastAccessAt: result.data.last_access_at,
    };

    return { success: true, data: subscription };
  }

  // 获取所有自定义订阅
  async getAll(): Promise<DbResult<CustomSubscription[]>> {
    const sql = 'SELECT * FROM custom_subscriptions ORDER BY created_at DESC';
    const result = await this.db.query<DbCustomSubscription>(sql);

    if (!result.success) {
      return { success: false, error: result.error, data: [] };
    }

    const subscriptions: CustomSubscription[] = (result.data || []).map(dbSub => ({
      id: dbSub.id,
      uuid: dbSub.uuid,
      name: dbSub.name,
      nodeIds: JSON.parse(dbSub.node_ids),
      format: dbSub.format,
      expiresAt: dbSub.expires_at,
      createdAt: dbSub.created_at,
      updatedAt: dbSub.updated_at,
      accessCount: dbSub.access_count,
      lastAccessAt: dbSub.last_access_at,
    }));

    return { success: true, data: subscriptions };
  }

  // 更新访问统计
  async updateAccess(uuid: string): Promise<DbResult<void>> {
    const now = new Date().toISOString();
    const sql = `
      UPDATE custom_subscriptions 
      SET access_count = access_count + 1, last_access_at = ?, updated_at = ?
      WHERE uuid = ?
    `;

    return this.db.execute(sql, [now, now, uuid]);
  }

  // 删除自定义订阅
  async delete(uuid: string): Promise<DbResult<void>> {
    const sql = 'DELETE FROM custom_subscriptions WHERE uuid = ?';
    return this.db.execute(sql, [uuid]);
  }

  // 清理过期订阅
  async cleanupExpired(): Promise<DbResult<number>> {
    const now = new Date().toISOString();
    const sql = 'DELETE FROM custom_subscriptions WHERE expires_at IS NOT NULL AND expires_at < ?';
    const result = await this.db.execute(sql, [now]);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { 
      success: true, 
      data: result.meta?.changes || 0 
    };
  }

  // 获取统计信息
  async getStats(): Promise<DbResult<{
    total: number;
    active: number;
    expired: number;
    totalAccess: number;
  }>> {
    const now = new Date().toISOString();
    
    const sql = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN expires_at IS NULL OR expires_at > ? THEN 1 END) as active,
        COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at <= ? THEN 1 END) as expired,
        SUM(access_count) as total_access
      FROM custom_subscriptions
    `;

    const result = await this.db.queryFirst<{
      total: number;
      active: number;
      expired: number;
      total_access: number;
    }>(sql, [now, now]);

    if (!result.success || !result.data) {
      return { 
        success: false, 
        error: result.error || 'No data returned',
        data: { total: 0, active: 0, expired: 0, totalAccess: 0 }
      };
    }

    return {
      success: true,
      data: {
        total: result.data.total,
        active: result.data.active,
        expired: result.data.expired,
        totalAccess: result.data.total_access || 0,
      }
    };
  }
}
