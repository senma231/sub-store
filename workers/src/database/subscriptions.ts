import { Database, DbResult } from './index';

export interface Subscription {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  lastUpdate?: string;
  nodeCount: number;
  updateInterval: number; // 更新间隔（小时）
  autoUpdate: boolean;
  tags?: string[];
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbSubscription {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  last_update?: string;
  node_count: number;
  update_interval: number;
  auto_update: boolean;
  tags?: string; // JSON string
  remark?: string;
  created_at: string;
  updated_at: string;
}

export class SubscriptionsRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // 创建订阅表
  async createTable(): Promise<DbResult<void>> {
    const sql = `
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        enabled BOOLEAN DEFAULT 1,
        last_update TEXT,
        node_count INTEGER DEFAULT 0,
        update_interval INTEGER DEFAULT 24,
        auto_update BOOLEAN DEFAULT 1,
        tags TEXT,
        remark TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `;
    
    return this.db.execute(sql);
  }

  // 创建索引
  async createIndexes(): Promise<DbResult<void>> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_enabled ON subscriptions(enabled)',
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_auto_update ON subscriptions(auto_update)',
      'CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(created_at)',
    ];

    for (const sql of indexes) {
      const result = await this.db.execute(sql);
      if (!result.success) {
        return result;
      }
    }

    return { success: true };
  }

  // 创建订阅
  async create(subscription: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<DbResult<Subscription>> {
    const now = new Date().toISOString();
    const id = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const dbSubscription: DbSubscription = {
      id,
      name: subscription.name,
      url: subscription.url,
      enabled: subscription.enabled,
      last_update: subscription.lastUpdate || null,
      node_count: subscription.nodeCount || 0,
      update_interval: subscription.updateInterval || 24,
      auto_update: subscription.autoUpdate,
      tags: subscription.tags ? JSON.stringify(subscription.tags) : null,
      remark: subscription.remark || null,
      created_at: now,
      updated_at: now,
    };

    const sql = `
      INSERT INTO subscriptions (
        id, name, url, enabled, last_update, node_count, 
        update_interval, auto_update, tags, remark, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await this.db.execute(sql, [
      dbSubscription.id,
      dbSubscription.name,
      dbSubscription.url,
      dbSubscription.enabled,
      dbSubscription.last_update,
      dbSubscription.node_count,
      dbSubscription.update_interval,
      dbSubscription.auto_update,
      dbSubscription.tags,
      dbSubscription.remark,
      dbSubscription.created_at,
      dbSubscription.updated_at,
    ]);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const createdSubscription: Subscription = {
      id: dbSubscription.id,
      name: dbSubscription.name,
      url: dbSubscription.url,
      enabled: dbSubscription.enabled,
      lastUpdate: dbSubscription.last_update,
      nodeCount: dbSubscription.node_count,
      updateInterval: dbSubscription.update_interval,
      autoUpdate: dbSubscription.auto_update,
      tags: dbSubscription.tags ? JSON.parse(dbSubscription.tags) : undefined,
      remark: dbSubscription.remark,
      createdAt: dbSubscription.created_at,
      updatedAt: dbSubscription.updated_at,
    };

    return { success: true, data: createdSubscription };
  }

  // 获取所有订阅
  async getAll(): Promise<DbResult<Subscription[]>> {
    const sql = 'SELECT * FROM subscriptions ORDER BY created_at DESC';
    const result = await this.db.query<DbSubscription>(sql);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    const subscriptions = (result.data || []).map(this.dbToSubscription);
    return { success: true, data: subscriptions };
  }

  // 根据ID获取订阅
  async getById(id: string): Promise<DbResult<Subscription | null>> {
    const sql = 'SELECT * FROM subscriptions WHERE id = ?';
    const result = await this.db.queryFirst<DbSubscription>(sql, [id]);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (!result.data) {
      return { success: true, data: null };
    }

    const subscription = this.dbToSubscription(result.data);
    return { success: true, data: subscription };
  }

  // 更新订阅
  async update(id: string, updates: Partial<Subscription>): Promise<DbResult<Subscription>> {
    const now = new Date().toISOString();
    
    const updateFields = [];
    const updateValues = [];
    
    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updates.name);
    }
    
    if (updates.url !== undefined) {
      updateFields.push('url = ?');
      updateValues.push(updates.url);
    }
    
    if (updates.enabled !== undefined) {
      updateFields.push('enabled = ?');
      updateValues.push(updates.enabled);
    }
    
    if (updates.lastUpdate !== undefined) {
      updateFields.push('last_update = ?');
      updateValues.push(updates.lastUpdate);
    }
    
    if (updates.nodeCount !== undefined) {
      updateFields.push('node_count = ?');
      updateValues.push(updates.nodeCount);
    }
    
    if (updates.updateInterval !== undefined) {
      updateFields.push('update_interval = ?');
      updateValues.push(updates.updateInterval);
    }
    
    if (updates.autoUpdate !== undefined) {
      updateFields.push('auto_update = ?');
      updateValues.push(updates.autoUpdate);
    }
    
    if (updates.tags !== undefined) {
      updateFields.push('tags = ?');
      updateValues.push(updates.tags ? JSON.stringify(updates.tags) : null);
    }
    
    if (updates.remark !== undefined) {
      updateFields.push('remark = ?');
      updateValues.push(updates.remark);
    }
    
    if (updateFields.length === 0) {
      return { success: false, error: 'No fields to update' };
    }
    
    updateFields.push('updated_at = ?');
    updateValues.push(now);
    updateValues.push(id);
    
    const sql = `
      UPDATE subscriptions 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;
    
    const result = await this.db.execute(sql, updateValues);
    
    if (!result.success) {
      return { success: false, error: result.error };
    }
    
    return this.getById(id);
  }

  // 删除订阅
  async delete(id: string): Promise<DbResult<void>> {
    const sql = 'DELETE FROM subscriptions WHERE id = ?';
    return this.db.execute(sql, [id]);
  }

  // 数据库记录转换为订阅对象
  private dbToSubscription(dbSub: DbSubscription): Subscription {
    return {
      id: dbSub.id,
      name: dbSub.name,
      url: dbSub.url,
      enabled: dbSub.enabled,
      lastUpdate: dbSub.last_update,
      nodeCount: dbSub.node_count,
      updateInterval: dbSub.update_interval,
      autoUpdate: dbSub.auto_update,
      tags: dbSub.tags ? JSON.parse(dbSub.tags) : undefined,
      remark: dbSub.remark,
      createdAt: dbSub.created_at,
      updatedAt: dbSub.updated_at,
    };
  }
}
