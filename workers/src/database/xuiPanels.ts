/**
 * X-UI面板数据库仓库
 * 管理X-UI面板配置的CRUD操作
 */

import type { DbResult } from './index';

export interface XUIPanel {
  id: string;
  name: string;
  host: string;
  port: number;
  basePath?: string; // URL根路径，例如 /xui 或 /panel
  username: string;
  password: string;
  protocol: 'http' | 'https';
  enabled: boolean;
  lastSyncAt?: string;
  syncStatus: 'pending' | 'success' | 'failed';
  syncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface XUISyncLog {
  id: string;
  panelId: string;
  syncType: 'manual' | 'auto';
  nodesFound: number;
  nodesImported: number;
  nodesUpdated: number;
  status: 'success' | 'failed' | 'partial';
  errorMessage?: string;
  syncDuration: number; // 毫秒
  createdAt: string;
}

export class XUIPanelsRepository {
  constructor(private db: any) {}

  /**
   * 创建X-UI面板配置
   */
  async create(panel: Omit<XUIPanel, 'id' | 'createdAt' | 'updatedAt'>): Promise<DbResult<XUIPanel>> {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      
      const newPanel: XUIPanel = {
        ...panel,
        id,
        createdAt: now,
        updatedAt: now
      };

      await this.db.prepare(`
        INSERT INTO xui_panels (
          id, name, host, port, base_path, username, password, protocol, enabled,
          last_sync_at, sync_status, sync_error, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        newPanel.id,
        newPanel.name,
        newPanel.host,
        newPanel.port,
        newPanel.basePath || null,
        newPanel.username,
        newPanel.password,
        newPanel.protocol,
        newPanel.enabled,
        newPanel.lastSyncAt || null,
        newPanel.syncStatus,
        newPanel.syncError || null,
        newPanel.createdAt,
        newPanel.updatedAt
      ).run();

      return {
        success: true,
        data: newPanel
      };

    } catch (error) {
      console.error('创建X-UI面板失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 获取所有X-UI面板
   */
  async getAll(): Promise<DbResult<XUIPanel[]>> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM xui_panels ORDER BY created_at DESC
      `).all();

      const panels: XUIPanel[] = result.results.map((row: any) => ({
        id: row.id,
        name: row.name,
        host: row.host,
        port: row.port,
        basePath: row.base_path,
        username: row.username,
        password: row.password,
        protocol: row.protocol,
        enabled: Boolean(row.enabled),
        lastSyncAt: row.last_sync_at,
        syncStatus: row.sync_status,
        syncError: row.sync_error,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      return {
        success: true,
        data: panels
      };

    } catch (error) {
      console.error('获取X-UI面板列表失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 根据ID获取X-UI面板
   */
  async getById(id: string): Promise<DbResult<XUIPanel>> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM xui_panels WHERE id = ?
      `).bind(id).first();

      if (!result) {
        return {
          success: false,
          error: 'Panel not found'
        };
      }

      const panel: XUIPanel = {
        id: result.id,
        name: result.name,
        host: result.host,
        port: result.port,
        basePath: result.base_path,
        username: result.username,
        password: result.password,
        protocol: result.protocol,
        enabled: Boolean(result.enabled),
        lastSyncAt: result.last_sync_at,
        syncStatus: result.sync_status,
        syncError: result.sync_error,
        createdAt: result.created_at,
        updatedAt: result.updated_at
      };

      return {
        success: true,
        data: panel
      };

    } catch (error) {
      console.error('获取X-UI面板失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 更新X-UI面板配置
   */
  async update(id: string, updates: Partial<Omit<XUIPanel, 'id' | 'createdAt'>>): Promise<DbResult<XUIPanel>> {
    try {
      const now = new Date().toISOString();
      
      // 构建更新字段
      const fields = [];
      const values = [];
      
      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.host !== undefined) {
        fields.push('host = ?');
        values.push(updates.host);
      }
      if (updates.port !== undefined) {
        fields.push('port = ?');
        values.push(updates.port);
      }
      if (updates.basePath !== undefined) {
        fields.push('base_path = ?');
        values.push(updates.basePath);
      }
      if (updates.username !== undefined) {
        fields.push('username = ?');
        values.push(updates.username);
      }
      if (updates.password !== undefined) {
        fields.push('password = ?');
        values.push(updates.password);
      }
      if (updates.protocol !== undefined) {
        fields.push('protocol = ?');
        values.push(updates.protocol);
      }
      if (updates.enabled !== undefined) {
        fields.push('enabled = ?');
        values.push(updates.enabled);
      }
      if (updates.lastSyncAt !== undefined) {
        fields.push('last_sync_at = ?');
        values.push(updates.lastSyncAt);
      }
      if (updates.syncStatus !== undefined) {
        fields.push('sync_status = ?');
        values.push(updates.syncStatus);
      }
      if (updates.syncError !== undefined) {
        fields.push('sync_error = ?');
        values.push(updates.syncError);
      }

      fields.push('updated_at = ?');
      values.push(now);
      values.push(id);

      await this.db.prepare(`
        UPDATE xui_panels SET ${fields.join(', ')} WHERE id = ?
      `).bind(...values).run();

      // 返回更新后的数据
      return await this.getById(id);

    } catch (error) {
      console.error('更新X-UI面板失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 删除X-UI面板
   */
  async delete(id: string): Promise<DbResult<boolean>> {
    try {
      await this.db.prepare(`
        DELETE FROM xui_panels WHERE id = ?
      `).bind(id).run();

      // 同时删除相关的同步日志
      await this.db.prepare(`
        DELETE FROM xui_sync_logs WHERE panel_id = ?
      `).bind(id).run();

      return {
        success: true,
        data: true
      };

    } catch (error) {
      console.error('删除X-UI面板失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 获取启用的X-UI面板
   */
  async getEnabled(): Promise<DbResult<XUIPanel[]>> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM xui_panels WHERE enabled = true ORDER BY created_at DESC
      `).all();

      const panels: XUIPanel[] = result.results.map((row: any) => ({
        id: row.id,
        name: row.name,
        host: row.host,
        port: row.port,
        basePath: row.base_path,
        username: row.username,
        password: row.password,
        protocol: row.protocol,
        enabled: Boolean(row.enabled),
        lastSyncAt: row.last_sync_at,
        syncStatus: row.sync_status,
        syncError: row.sync_error,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }));

      return {
        success: true,
        data: panels
      };

    } catch (error) {
      console.error('获取启用的X-UI面板失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 记录同步日志
   */
  async createSyncLog(log: Omit<XUISyncLog, 'id' | 'createdAt'>): Promise<DbResult<XUISyncLog>> {
    try {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      
      const newLog: XUISyncLog = {
        ...log,
        id,
        createdAt: now
      };

      await this.db.prepare(`
        INSERT INTO xui_sync_logs (
          id, panel_id, sync_type, nodes_found, nodes_imported, nodes_updated,
          status, error_message, sync_duration, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        newLog.id,
        newLog.panelId,
        newLog.syncType,
        newLog.nodesFound,
        newLog.nodesImported,
        newLog.nodesUpdated,
        newLog.status,
        newLog.errorMessage || null,
        newLog.syncDuration,
        newLog.createdAt
      ).run();

      return {
        success: true,
        data: newLog
      };

    } catch (error) {
      console.error('创建同步日志失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 获取面板的同步日志
   */
  async getSyncLogs(panelId: string, limit: number = 50): Promise<DbResult<XUISyncLog[]>> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM xui_sync_logs 
        WHERE panel_id = ? 
        ORDER BY created_at DESC 
        LIMIT ?
      `).bind(panelId, limit).all();

      const logs: XUISyncLog[] = result.results.map((row: any) => ({
        id: row.id,
        panelId: row.panel_id,
        syncType: row.sync_type,
        nodesFound: row.nodes_found,
        nodesImported: row.nodes_imported,
        nodesUpdated: row.nodes_updated,
        status: row.status,
        errorMessage: row.error_message,
        syncDuration: row.sync_duration,
        createdAt: row.created_at
      }));

      return {
        success: true,
        data: logs
      };

    } catch (error) {
      console.error('获取同步日志失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
