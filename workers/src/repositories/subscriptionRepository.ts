import { CustomSubscriptionData, DbSubscription, DbResult } from '../../../shared/types';

export class SubscriptionRepository {
  constructor(private db: D1Database) {}

  /**
   * 更新订阅流量设置
   */
  async updateTrafficSettings(uuid: string, settings: {
    enabled: boolean;
    limit: number;
    resetCycle: string;
  }): Promise<DbResult<boolean>> {
    try {
      const resetDate = this.calculateNextResetDate(settings.resetCycle);

      const result = await this.db.prepare(`
        UPDATE custom_subscriptions
        SET traffic_enabled = ?,
            traffic_limit = ?,
            traffic_reset_cycle = ?,
            traffic_reset_date = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE uuid = ?
      `).bind(
        settings.enabled,
        settings.limit,
        settings.resetCycle,
        resetDate,
        uuid
      ).run();

      if (result.changes === 0) {
        return { success: false, error: '订阅不存在' };
      }

      return { success: true, data: true };
    } catch (error) {
      console.error('更新流量设置失败:', error);
      return { success: false, error: '数据库操作失败' };
    }
  }

  /**
   * 获取订阅流量统计
   */
  async getTrafficStats(uuid: string): Promise<DbResult<{
    limit: number;
    used: number;
    remaining: number;
    percentage: number;
    resetDate: string;
    resetCycle: string;
    enabled: boolean;
  }>> {
    try {
      const result = await this.db.prepare(`
        SELECT traffic_limit, traffic_used, traffic_reset_cycle,
               traffic_reset_date, traffic_enabled
        FROM custom_subscriptions
        WHERE uuid = ?
      `).bind(uuid).first();

      if (!result) {
        return { success: false, error: '订阅不存在' };
      }

      const limit = result.traffic_limit || 0;
      const used = result.traffic_used || 0;
      const remaining = Math.max(0, limit - used);
      const percentage = limit > 0 ? Math.round((used / limit) * 100) : 0;

      return {
        success: true,
        data: {
          limit,
          used,
          remaining,
          percentage,
          resetDate: result.traffic_reset_date || '',
          resetCycle: result.traffic_reset_cycle || 'monthly',
          enabled: result.traffic_enabled || false
        }
      };
    } catch (error) {
      console.error('获取流量统计失败:', error);
      return { success: false, error: '数据库操作失败' };
    }
  }

  /**
   * 重置订阅流量
   */
  async resetTraffic(uuid: string): Promise<DbResult<boolean>> {
    try {
      const result = await this.db.prepare(`
        UPDATE custom_subscriptions
        SET traffic_used = 0,
            traffic_reset_date = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE uuid = ?
      `).bind(
        this.calculateNextResetDate('monthly'), // 默认按月重置
        uuid
      ).run();

      if (result.changes === 0) {
        return { success: false, error: '订阅不存在' };
      }

      return { success: true, data: true };
    } catch (error) {
      console.error('重置流量失败:', error);
      return { success: false, error: '数据库操作失败' };
    }
  }

  /**
   * 计算下次重置日期
   */
  private calculateNextResetDate(cycle: string): string {
    const now = new Date();
    let nextReset: Date;

    switch (cycle) {
      case 'daily':
        nextReset = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        nextReset = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        nextReset = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        break;
      default:
        nextReset = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    return nextReset.toISOString();
  }

  /**
   * 获取所有订阅
   */
  async findAll(): Promise<DbResult<CustomSubscriptionData[]>> {
    try {
      const { results } = await this.db.prepare(`
        SELECT * FROM custom_subscriptions 
        ORDER BY created_at DESC
      `).all();

      const subscriptions = results.map((result) => this.mapDbToSubscription(result as unknown as DbSubscription));

      return {
        success: true,
        data: subscriptions
      };
    } catch (error) {
      return {
        success: false,
        error: `获取订阅列表失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 根据UUID获取订阅
   */
  async findByUuid(uuid: string): Promise<DbResult<CustomSubscriptionData | null>> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM custom_subscriptions WHERE uuid = ?
      `).bind(uuid).first();

      if (!result) {
        return {
          success: true,
          data: null
        };
      }

      return {
        success: true,
        data: this.mapDbToSubscription(result as unknown as DbSubscription)
      };
    } catch (error) {
      return {
        success: false,
        error: `获取订阅失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 创建订阅
   */
  async create(subscription: Omit<CustomSubscriptionData, 'uuid' | 'createdAt' | 'updatedAt'>): Promise<DbResult<CustomSubscriptionData>> {
    try {
      const uuid = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      const { success } = await this.db.prepare(`
        INSERT INTO custom_subscriptions (
          uuid, name, description, node_ids, enabled, format,
          include_types, exclude_types, include_keywords, exclude_keywords,
          sort_by, sort_order, group_enabled, group_by, rename_rules,
          total_requests, created_at, updated_at, expires_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        uuid,
        subscription.name,
        subscription.description || null,
        JSON.stringify(subscription.nodeIds),
        subscription.enabled ? 1 : 0,
        subscription.format || 'v2ray', // 添加format字段
        subscription.includeTypes ? JSON.stringify(subscription.includeTypes) : null,
        subscription.excludeTypes ? JSON.stringify(subscription.excludeTypes) : null,
        subscription.includeKeywords ? JSON.stringify(subscription.includeKeywords) : null,
        subscription.excludeKeywords ? JSON.stringify(subscription.excludeKeywords) : null,
        subscription.sortBy || 'name',
        subscription.sortOrder || 'asc',
        subscription.groupEnabled ? 1 : 0,
        subscription.groupBy || 'type',
        subscription.renameRules ? JSON.stringify(subscription.renameRules) : null,
        0,
        now,
        now,
        subscription.expiresAt || null
      ).run();

      if (!success) {
        return {
          success: false,
          error: '创建订阅失败'
        };
      }

      const createdSubscription: CustomSubscriptionData = {
        uuid,
        ...subscription,
        totalRequests: 0,
        createdAt: now,
        updatedAt: now
      };

      return {
        success: true,
        data: createdSubscription
      };
    } catch (error) {
      return {
        success: false,
        error: `创建订阅失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 更新订阅
   */
  async update(uuid: string, updates: Partial<Omit<CustomSubscriptionData, 'uuid' | 'createdAt' | 'updatedAt'>>): Promise<DbResult<CustomSubscriptionData | null>> {
    try {
      const now = new Date().toISOString();
      
      const { success } = await this.db.prepare(`
        UPDATE custom_subscriptions SET
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          node_ids = COALESCE(?, node_ids),
          enabled = COALESCE(?, enabled),
          updated_at = ?
        WHERE uuid = ?
      `).bind(
        updates.name || null,
        updates.description || null,
        updates.nodeIds ? JSON.stringify(updates.nodeIds) : null,
        updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : null,
        now,
        uuid
      ).run();

      if (!success) {
        return {
          success: false,
          error: '更新订阅失败'
        };
      }

      return await this.findByUuid(uuid);
    } catch (error) {
      return {
        success: false,
        error: `更新订阅失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 删除订阅
   */
  async delete(uuid: string): Promise<DbResult<boolean>> {
    try {
      const { success } = await this.db.prepare(`
        DELETE FROM custom_subscriptions WHERE uuid = ?
      `).bind(uuid).run();

      return {
        success: true,
        data: success
      };
    } catch (error) {
      return {
        success: false,
        error: `删除订阅失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 批量删除订阅
   */
  async batchDelete(uuids: string[]): Promise<DbResult<boolean>> {
    try {
      const placeholders = uuids.map(() => '?').join(',');

      const { success } = await this.db.prepare(`
        DELETE FROM custom_subscriptions WHERE uuid IN (${placeholders})
      `).bind(...uuids).run();

      return {
        success: true,
        data: success
      };
    } catch (error) {
      return {
        success: false,
        error: `批量删除订阅失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 获取订阅统计
   */
  async getStats(): Promise<DbResult<{ total: number; enabled: number }>> {
    try {
      const totalResult = await this.db.prepare(`SELECT COUNT(*) as count FROM custom_subscriptions`).first();
      const enabledResult = await this.db.prepare(`SELECT COUNT(*) as count FROM custom_subscriptions WHERE enabled = 1`).first();

      return {
        success: true,
        data: {
          total: (totalResult as any)?.count || 0,
          enabled: (enabledResult as any)?.count || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `获取订阅统计失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 将数据库记录映射为订阅对象
   */
  private mapDbToSubscription(dbSub: DbSubscription): any {
    const subscription = {
      // 后端字段
      uuid: dbSub.id,
      name: dbSub.name,
      description: dbSub.description || undefined,
      nodeIds: JSON.parse((dbSub as any).node_ids || '[]'),
      enabled: Boolean(dbSub.enabled),
      includeTypes: dbSub.include_types ? JSON.parse(dbSub.include_types) : undefined,
      excludeTypes: dbSub.exclude_types ? JSON.parse(dbSub.exclude_types) : undefined,
      includeKeywords: dbSub.include_keywords ? JSON.parse(dbSub.include_keywords) : undefined,
      excludeKeywords: dbSub.exclude_keywords ? JSON.parse(dbSub.exclude_keywords) : undefined,
      sortBy: dbSub.sort_by,
      sortOrder: dbSub.sort_order as 'asc' | 'desc',
      groupEnabled: Boolean(dbSub.group_enabled),
      groupBy: dbSub.group_by,
      renameRules: dbSub.rename_rules ? JSON.parse(dbSub.rename_rules) : undefined,
      totalRequests: dbSub.total_requests,
      lastAccessed: dbSub.last_accessed || undefined,
      createdAt: dbSub.created_at,
      updatedAt: dbSub.updated_at,
      expiresAt: (dbSub as any).expires_at || undefined,

      // 前端兼容字段
      id: dbSub.id, // 前端期望的id字段
      accessCount: dbSub.total_requests, // 前端期望的accessCount字段
      lastAccessAt: dbSub.last_accessed || undefined, // 前端期望的lastAccessAt字段
      format: (dbSub as any).format || 'v2ray' // 从数据库获取format字段
    };

    return subscription;
  }
}
