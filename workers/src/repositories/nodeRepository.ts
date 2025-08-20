import { Node, DbNode, DbResult, NetworkType } from '../../../shared/types';

export class NodeRepository {
  constructor(private db: D1Database) {}

  /**
   * 获取所有节点
   */
  async findAll(): Promise<DbResult<Node[]>> {
    try {
      console.log('NodeRepository: 开始查询数据库...');
      const { results } = await this.db.prepare(`
        SELECT * FROM nodes
        ORDER BY created_at DESC
      `).all();

      console.log('NodeRepository: 数据库查询结果数量:', results.length);
      console.log('NodeRepository: 第一条数据示例:', results[0]);

      const nodes = results.map((result) => this.mapDbToNode(result as unknown as DbNode));

      console.log('NodeRepository: 映射后节点数量:', nodes.length);
      console.log('NodeRepository: 第一个节点示例:', nodes[0]);

      return {
        success: true,
        data: nodes
      };
    } catch (error) {
      console.error('NodeRepository: 查询失败:', error);
      return {
        success: false,
        error: `获取节点列表失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 根据ID获取节点
   */
  async findById(id: string): Promise<DbResult<Node | null>> {
    try {
      const result = await this.db.prepare(`
        SELECT * FROM nodes WHERE id = ?
      `).bind(id).first();

      if (!result) {
        return {
          success: true,
          data: null
        };
      }

      return {
        success: true,
        data: this.mapDbToNode(result as unknown as DbNode)
      };
    } catch (error) {
      return {
        success: false,
        error: `获取节点失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 创建节点
   */
  async create(node: Omit<Node, 'id' | 'createdAt' | 'updatedAt'>): Promise<DbResult<Node>> {
    try {
      const id = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      const { success } = await this.db.prepare(`
        INSERT INTO nodes (
          id, name, type, server, port, enabled, tags, remark,
          uuid, encryption, flow, alter_id, security, password, method, username,
          network, tls, sni, alpn, fingerprint, allow_insecure,
          ws_path, ws_headers, h2_path, h2_host, grpc_service_name, grpc_mode,
          plugin, plugin_opts, obfs, obfs_password, up_mbps, down_mbps,
          auth, auth_str, protocol, total_requests, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, node.name, node.type, node.server, node.port,
        node.enabled ? 1 : 0,
        node.tags ? JSON.stringify(node.tags) : null,
        node.remark || null,
        node.uuid || null, node.encryption || null, node.flow || null,
        node.alterId || null, node.security || null, node.password || null,
        node.method || null, node.username || null, node.network || null,
        node.tls ? 1 : 0, node.sni || null,
        node.alpn ? JSON.stringify(node.alpn) : null,
        node.fingerprint || null, node.allowInsecure ? 1 : 0,
        node.wsPath || null, node.wsHeaders ? JSON.stringify(node.wsHeaders) : null,
        node.h2Path || null, node.h2Host ? JSON.stringify(node.h2Host) : null,
        node.grpcServiceName || null, node.grpcMode || null,
        node.plugin || null, node.pluginOpts || null,
        node.obfs || null, node.obfsPassword || null,
        node.upMbps || null, node.downMbps || null,
        node.auth || null, node.authStr || null, node.protocol || null,
        0, now, now
      ).run();

      if (!success) {
        return {
          success: false,
          error: '创建节点失败'
        };
      }

      const createdNode: Node = {
        id,
        ...node,
        totalRequests: 0,
        createdAt: now,
        updatedAt: now
      };

      return {
        success: true,
        data: createdNode
      };
    } catch (error) {
      return {
        success: false,
        error: `创建节点失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 更新节点
   */
  async update(id: string, updates: Partial<Omit<Node, 'id' | 'createdAt' | 'updatedAt'>>): Promise<DbResult<Node | null>> {
    try {
      const now = new Date().toISOString();
      
      const { success } = await this.db.prepare(`
        UPDATE nodes SET
          name = COALESCE(?, name),
          type = COALESCE(?, type),
          server = COALESCE(?, server),
          port = COALESCE(?, port),
          enabled = COALESCE(?, enabled),
          tags = COALESCE(?, tags),
          remark = COALESCE(?, remark),
          updated_at = ?
        WHERE id = ?
      `).bind(
        updates.name || null,
        updates.type || null,
        updates.server || null,
        updates.port || null,
        updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : null,
        updates.tags ? JSON.stringify(updates.tags) : null,
        updates.remark || null,
        now,
        id
      ).run();

      if (!success) {
        return {
          success: false,
          error: '更新节点失败'
        };
      }

      return await this.findById(id);
    } catch (error) {
      return {
        success: false,
        error: `更新节点失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 删除节点
   */
  async delete(id: string): Promise<DbResult<boolean>> {
    try {
      const { success } = await this.db.prepare(`
        DELETE FROM nodes WHERE id = ?
      `).bind(id).run();

      return {
        success: true,
        data: success
      };
    } catch (error) {
      return {
        success: false,
        error: `删除节点失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 批量更新节点
   */
  async batchUpdate(ids: string[], updates: Partial<Omit<Node, 'id' | 'createdAt' | 'updatedAt'>>): Promise<DbResult<boolean>> {
    try {
      const now = new Date().toISOString();
      const placeholders = ids.map(() => '?').join(',');

      const { success } = await this.db.prepare(`
        UPDATE nodes SET
          enabled = COALESCE(?, enabled),
          updated_at = ?
        WHERE id IN (${placeholders})
      `).bind(
        updates.enabled !== undefined ? (updates.enabled ? 1 : 0) : null,
        now,
        ...ids
      ).run();

      return {
        success: true,
        data: success
      };
    } catch (error) {
      return {
        success: false,
        error: `批量更新节点失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 批量删除节点
   */
  async batchDelete(ids: string[]): Promise<DbResult<boolean>> {
    try {
      const placeholders = ids.map(() => '?').join(',');

      const { success } = await this.db.prepare(`
        DELETE FROM nodes WHERE id IN (${placeholders})
      `).bind(...ids).run();

      return {
        success: true,
        data: success
      };
    } catch (error) {
      return {
        success: false,
        error: `批量删除节点失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 获取节点统计
   */
  async getStats(): Promise<DbResult<{ total: number; enabled: number; byType: Record<string, number> }>> {
    try {
      const totalResult = await this.db.prepare(`SELECT COUNT(*) as count FROM nodes`).first();
      const enabledResult = await this.db.prepare(`SELECT COUNT(*) as count FROM nodes WHERE enabled = 1`).first();
      const typeResults = await this.db.prepare(`SELECT type, COUNT(*) as count FROM nodes GROUP BY type`).all();

      const byType: Record<string, number> = {};
      typeResults.results.forEach((row: any) => {
        byType[row.type] = row.count;
      });

      return {
        success: true,
        data: {
          total: (totalResult as any)?.count || 0,
          enabled: (enabledResult as any)?.count || 0,
          byType
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `获取节点统计失败: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * 将数据库记录映射为节点对象
   */
  private mapDbToNode(dbNode: DbNode): Node {
    return {
      id: dbNode.id,
      name: dbNode.name,
      type: dbNode.type as any,
      server: dbNode.server,
      port: dbNode.port,
      enabled: Boolean(dbNode.enabled),
      tags: dbNode.tags ? JSON.parse(dbNode.tags) : undefined,
      remark: dbNode.remark || undefined,
      uuid: dbNode.uuid || undefined,
      encryption: dbNode.encryption || undefined,
      flow: dbNode.flow || undefined,
      alterId: dbNode.alter_id || undefined,
      security: dbNode.security || undefined,
      password: dbNode.password || '',
      method: dbNode.method || undefined,
      username: dbNode.username || undefined,
      network: (dbNode.network as NetworkType) || undefined,
      tls: Boolean(dbNode.tls),
      sni: dbNode.sni || undefined,
      alpn: dbNode.alpn ? JSON.parse(dbNode.alpn) : undefined,
      fingerprint: dbNode.fingerprint || undefined,
      allowInsecure: Boolean(dbNode.allow_insecure),
      wsPath: dbNode.ws_path || undefined,
      wsHeaders: dbNode.ws_headers ? JSON.parse(dbNode.ws_headers) : undefined,
      h2Path: dbNode.h2_path || undefined,
      h2Host: dbNode.h2_host ? JSON.parse(dbNode.h2_host) : undefined,
      grpcServiceName: dbNode.grpc_service_name || undefined,
      grpcMode: (dbNode.grpc_mode as 'gun' | 'multi') || undefined,
      plugin: dbNode.plugin || undefined,
      pluginOpts: dbNode.plugin_opts || undefined,
      obfs: dbNode.obfs || undefined,
      obfsPassword: dbNode.obfs_password || undefined,
      upMbps: dbNode.up_mbps || undefined,
      downMbps: dbNode.down_mbps || undefined,
      auth: dbNode.auth || undefined,
      authStr: dbNode.auth_str || undefined,
      protocol: dbNode.protocol || undefined,
      totalRequests: dbNode.total_requests,
      lastUsed: dbNode.last_used || undefined,
      createdAt: dbNode.created_at,
      updatedAt: dbNode.updated_at
    };
  }
}
