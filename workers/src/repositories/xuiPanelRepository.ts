import { XUIPanel, DbXUIPanel, DbResult } from '../../../shared/types';

export class XUIPanelRepository {
  constructor(private db: D1Database) {}

  /**
   * 获取所有X-UI面板
   */
  async findAll(): Promise<DbResult<XUIPanel[]>> {
    try {
      const { results } = await this.db.prepare(`
        SELECT * FROM xui_panels 
        ORDER BY created_at DESC
      `).all();

      const panels = results.map(this.mapDbToXUIPanel);
      
      return {
        success: true,
        data: panels
      };
    } catch (error) {
      return {
        success: false,
        error: `获取X-UI面板列表失败: ${error.message}`
      };
    }
  }

  /**
   * 根据ID获取X-UI面板
   */
  async findById(id: string): Promise<DbResult<XUIPanel | null>> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM xui_panels WHERE id = ?
      `).bind(id).first();

      if (!result) {
        return {
          success: true,
          data: null
        };
      }

      return {
        success: true,
        data: this.mapDbToXUIPanel(result as DbXUIPanel)
      };
    } catch (error) {
      return {
        success: false,
        error: `获取X-UI面板失败: ${error.message}`
      };
    }
  }

  /**
   * 创建X-UI面板
   */
  async create(panel: Omit<XUIPanel, 'id' | 'createdAt' | 'updatedAt'>): Promise<DbResult<XUIPanel>> {
    try {
      const id = `xui_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      const { success } = await this.db.prepare(`
        INSERT INTO xui_panels (
          id, name, url, username, password, enabled, remark, tags,
          timeout, retry_count, total_nodes, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        panel.name,
        panel.url,
        panel.username,
        panel.password,
        panel.enabled ? 1 : 0,
        panel.remark || null,
        panel.tags ? JSON.stringify(panel.tags) : null,
        panel.timeout || 30,
        panel.retryCount || 3,
        panel.totalNodes || 0,
        panel.status || 'offline',
        now,
        now
      ).run();

      if (!success) {
        return {
          success: false,
          error: '创建X-UI面板失败'
        };
      }

      const newPanel: XUIPanel = {
        id,
        name: panel.name,
        url: panel.url,
        username: panel.username,
        password: panel.password,
        enabled: panel.enabled,
        remark: panel.remark,
        tags: panel.tags,
        timeout: panel.timeout || 30,
        retryCount: panel.retryCount || 3,
        totalNodes: panel.totalNodes || 0,
        status: panel.status || 'offline',
        createdAt: now,
        updatedAt: now
      };

      return {
        success: true,
        data: newPanel
      };
    } catch (error) {
      return {
        success: false,
        error: `创建X-UI面板失败: ${error.message}`
      };
    }
  }

  /**
   * 更新X-UI面板
   */
  async update(id: string, updates: Partial<Omit<XUIPanel, 'id' | 'createdAt' | 'updatedAt'>>): Promise<DbResult<XUIPanel>> {
    try {
      const now = new Date().toISOString();
      
      // 构建更新字段
      const fields: string[] = [];
      const values: any[] = [];
      
      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.url !== undefined) {
        fields.push('url = ?');
        values.push(updates.url);
      }
      if (updates.username !== undefined) {
        fields.push('username = ?');
        values.push(updates.username);
      }
      if (updates.password !== undefined) {
        fields.push('password = ?');
        values.push(updates.password);
      }
      if (updates.enabled !== undefined) {
        fields.push('enabled = ?');
        values.push(updates.enabled ? 1 : 0);
      }
      if (updates.remark !== undefined) {
        fields.push('remark = ?');
        values.push(updates.remark);
      }
      if (updates.tags !== undefined) {
        fields.push('tags = ?');
        values.push(updates.tags ? JSON.stringify(updates.tags) : null);
      }
      if (updates.timeout !== undefined) {
        fields.push('timeout = ?');
        values.push(updates.timeout);
      }
      if (updates.retryCount !== undefined) {
        fields.push('retry_count = ?');
        values.push(updates.retryCount);
      }
      if (updates.totalNodes !== undefined) {
        fields.push('total_nodes = ?');
        values.push(updates.totalNodes);
      }
      if (updates.status !== undefined) {
        fields.push('status = ?');
        values.push(updates.status);
      }
      if (updates.lastSync !== undefined) {
        fields.push('last_sync = ?');
        values.push(updates.lastSync);
      }

      fields.push('updated_at = ?');
      values.push(now);
      values.push(id);

      const { success } = await this.db.prepare(`
        UPDATE xui_panels SET ${fields.join(', ')} WHERE id = ?
      `).bind(...values).run();

      if (!success) {
        return {
          success: false,
          error: '更新X-UI面板失败'
        };
      }

      // 获取更新后的数据
      const result = await this.findById(id);
      return result;
    } catch (error) {
      return {
        success: false,
        error: `更新X-UI面板失败: ${error.message}`
      };
    }
  }

  /**
   * 删除X-UI面板
   */
  async delete(id: string): Promise<DbResult<boolean>> {
    try {
      const { success } = await this.db.prepare(`
        DELETE FROM xui_panels WHERE id = ?
      `).bind(id).run();

      return {
        success: true,
        data: success
      };
    } catch (error) {
      return {
        success: false,
        error: `删除X-UI面板失败: ${error.message}`
      };
    }
  }

  /**
   * 批量操作X-UI面板
   */
  async batchUpdate(ids: string[], updates: Partial<Pick<XUIPanel, 'enabled' | 'status'>>): Promise<DbResult<number>> {
    try {
      const now = new Date().toISOString();
      let affectedRows = 0;

      for (const id of ids) {
        const fields: string[] = [];
        const values: any[] = [];

        if (updates.enabled !== undefined) {
          fields.push('enabled = ?');
          values.push(updates.enabled ? 1 : 0);
        }
        if (updates.status !== undefined) {
          fields.push('status = ?');
          values.push(updates.status);
        }

        fields.push('updated_at = ?');
        values.push(now);
        values.push(id);

        const { success } = await this.db.prepare(`
          UPDATE xui_panels SET ${fields.join(', ')} WHERE id = ?
        `).bind(...values).run();

        if (success) {
          affectedRows++;
        }
      }

      return {
        success: true,
        data: affectedRows
      };
    } catch (error) {
      return {
        success: false,
        error: `批量更新X-UI面板失败: ${error.message}`
      };
    }
  }

  /**
   * 将数据库记录映射为X-UI面板对象
   */
  private mapDbToXUIPanel(dbPanel: DbXUIPanel): XUIPanel {
    return {
      id: dbPanel.id,
      name: dbPanel.name,
      url: dbPanel.url,
      username: dbPanel.username,
      password: dbPanel.password,
      enabled: Boolean(dbPanel.enabled),
      remark: dbPanel.remark || undefined,
      tags: dbPanel.tags ? JSON.parse(dbPanel.tags) : undefined,
      timeout: dbPanel.timeout,
      retryCount: dbPanel.retry_count,
      totalNodes: dbPanel.total_nodes,
      lastSync: dbPanel.last_sync || undefined,
      status: dbPanel.status as 'online' | 'offline' | 'error',
      createdAt: dbPanel.created_at,
      updatedAt: dbPanel.updated_at
    };
  }
}
