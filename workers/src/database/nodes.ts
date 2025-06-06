import { Database } from './index';
import { DbNode, ProxyNode, PaginationParams, PaginatedResponse, DbResult } from '../../../shared/types';

export class NodesRepository {
  constructor(private db: Database) {}

  // 获取节点列表
  async getNodes(params: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    enabled?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<DbResult<PaginatedResponse<ProxyNode>>> {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        type,
        enabled,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = params;

      const offset = (page - 1) * limit;
      
      // 构建查询条件
      const conditions: string[] = [];
      const queryParams: any[] = [];

      if (search) {
        conditions.push('(name LIKE ? OR server LIKE ? OR remark LIKE ?)');
        const searchPattern = `%${search}%`;
        queryParams.push(searchPattern, searchPattern, searchPattern);
      }

      if (type) {
        conditions.push('type = ?');
        queryParams.push(type);
      }

      if (enabled !== undefined) {
        conditions.push('enabled = ?');
        queryParams.push(enabled ? 1 : 0);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // 验证排序字段
      const allowedSortFields = ['name', 'type', 'server', 'port', 'enabled', 'created_at', 'updated_at'];
      const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const validSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

      // 获取总数
      const countResult = await this.db.queryFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM nodes ${whereClause}`,
        queryParams
      );

      if (!countResult.success) {
        return { success: false, error: countResult.error };
      }

      const total = countResult.data?.count || 0;

      // 获取数据
      const dataResult = await this.db.query<DbNode>(
        `SELECT * FROM nodes ${whereClause} ORDER BY ${validSortBy} ${validSortOrder} LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      );

      if (!dataResult.success) {
        return { success: false, error: dataResult.error };
      }

      const nodes = (dataResult.data || []).map(Database.dbNodeToProxyNode);
      
      return {
        success: true,
        data: {
          items: nodes,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get nodes: ${error}`
      };
    }
  }

  // 根据 ID 获取节点
  async getNodeById(id: string): Promise<DbResult<ProxyNode | null>> {
    try {
      const result = await this.db.queryFirst<DbNode>(
        'SELECT * FROM nodes WHERE id = ?',
        [id]
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      const node = result.data ? Database.dbNodeToProxyNode(result.data) : null;
      return { success: true, data: node };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get node: ${error}`
      };
    }
  }

  // 创建节点
  async createNode(node: ProxyNode): Promise<DbResult<ProxyNode>> {
    try {
      const dbNode = Database.proxyNodeToDbNode(node);
      const now = new Date().toISOString();
      
      const result = await this.db.execute(
        `INSERT INTO nodes (
          id, name, type, server, port, enabled, tags, remark,
          uuid, encryption, flow, alter_id, security, password, method, username,
          network, tls, sni, alpn, fingerprint, allow_insecure,
          ws_path, ws_headers, h2_path, h2_host,
          grpc_service_name, grpc_mode, plugin, plugin_opts,
          obfs, obfs_password, up_mbps, down_mbps, auth, auth_str, protocol,
          total_requests, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          0, ?, ?
        )`,
        [
          dbNode.id, dbNode.name, dbNode.type, dbNode.server, dbNode.port,
          dbNode.enabled ? 1 : 0, dbNode.tags || null, dbNode.remark || null,
          dbNode.uuid || null, dbNode.encryption || null, dbNode.flow || null, dbNode.alter_id || null,
          dbNode.security || null, dbNode.password || null, dbNode.method || null, dbNode.username || null,
          dbNode.network || null, dbNode.tls ? 1 : 0, dbNode.sni || null, dbNode.alpn || null,
          dbNode.fingerprint || null, dbNode.allow_insecure ? 1 : 0,
          dbNode.ws_path || null, dbNode.ws_headers || null, dbNode.h2_path || null, dbNode.h2_host || null,
          dbNode.grpc_service_name || null, dbNode.grpc_mode || null, dbNode.plugin || null, dbNode.plugin_opts || null,
          dbNode.obfs || null, dbNode.obfs_password || null, dbNode.up_mbps || null, dbNode.down_mbps || null,
          dbNode.auth || null, dbNode.auth_str || null, dbNode.protocol || null,
          now, now
        ]
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, data: node };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create node: ${error}`
      };
    }
  }

  // 更新节点
  async updateNode(id: string, updates: Partial<ProxyNode>): Promise<DbResult<ProxyNode>> {
    try {
      // 先获取现有节点
      const existingResult = await this.getNodeById(id);
      if (!existingResult.success || !existingResult.data) {
        return { success: false, error: 'Node not found' };
      }

      // 合并更新
      const updatedNode = { ...existingResult.data, ...updates } as ProxyNode;
      const dbNode = Database.proxyNodeToDbNode(updatedNode);
      
      const result = await this.db.execute(
        `UPDATE nodes SET 
          name = ?, type = ?, server = ?, port = ?, enabled = ?, tags = ?, remark = ?,
          uuid = ?, encryption = ?, flow = ?, alter_id = ?, security = ?, password = ?, method = ?, username = ?,
          network = ?, tls = ?, sni = ?, alpn = ?, fingerprint = ?, allow_insecure = ?,
          ws_path = ?, ws_headers = ?, h2_path = ?, h2_host = ?,
          grpc_service_name = ?, grpc_mode = ?, plugin = ?, plugin_opts = ?,
          obfs = ?, obfs_password = ?, up_mbps = ?, down_mbps = ?, auth = ?, auth_str = ?, protocol = ?,
          updated_at = ?
        WHERE id = ?`,
        [
          dbNode.name, dbNode.type, dbNode.server, dbNode.port,
          dbNode.enabled ? 1 : 0, dbNode.tags || null, dbNode.remark || null,
          dbNode.uuid || null, dbNode.encryption || null, dbNode.flow || null, dbNode.alter_id || null,
          dbNode.security || null, dbNode.password || null, dbNode.method || null, dbNode.username || null,
          dbNode.network || null, dbNode.tls ? 1 : 0, dbNode.sni || null, dbNode.alpn || null,
          dbNode.fingerprint || null, dbNode.allow_insecure ? 1 : 0,
          dbNode.ws_path || null, dbNode.ws_headers || null, dbNode.h2_path || null, dbNode.h2_host || null,
          dbNode.grpc_service_name || null, dbNode.grpc_mode || null, dbNode.plugin || null, dbNode.plugin_opts || null,
          dbNode.obfs || null, dbNode.obfs_password || null, dbNode.up_mbps || null, dbNode.down_mbps || null,
          dbNode.auth || null, dbNode.auth_str || null, dbNode.protocol || null,
          new Date().toISOString(),
          id
        ]
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true, data: updatedNode as ProxyNode };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update node: ${error}`
      };
    }
  }

  // 删除节点
  async deleteNode(id: string): Promise<DbResult<void>> {
    try {
      const result = await this.db.execute(
        'DELETE FROM nodes WHERE id = ?',
        [id]
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete node: ${error}`
      };
    }
  }

  // 批量操作
  async batchOperation(action: 'enable' | 'disable' | 'delete', nodeIds: string[]): Promise<DbResult<{ affectedCount: number }>> {
    try {
      if (nodeIds.length === 0) {
        return { success: true, data: { affectedCount: 0 } };
      }

      const placeholders = nodeIds.map(() => '?').join(',');
      let sql: string;
      let params: any[];

      switch (action) {
        case 'enable':
          sql = `UPDATE nodes SET enabled = 1, updated_at = ? WHERE id IN (${placeholders})`;
          params = [new Date().toISOString(), ...nodeIds];
          break;
        case 'disable':
          sql = `UPDATE nodes SET enabled = 0, updated_at = ? WHERE id IN (${placeholders})`;
          params = [new Date().toISOString(), ...nodeIds];
          break;
        case 'delete':
          sql = `DELETE FROM nodes WHERE id IN (${placeholders})`;
          params = nodeIds;
          break;
        default:
          return { success: false, error: 'Invalid action' };
      }

      const result = await this.db.execute(sql, params);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return { 
        success: true, 
        data: { affectedCount: result.meta?.changes || 0 } 
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to perform batch operation: ${error}`
      };
    }
  }

  // 获取节点统计
  async getNodeStats(): Promise<DbResult<{
    total: number;
    enabled: number;
    disabled: number;
    byType: Record<string, number>;
  }>> {
    try {
      const totalResult = await this.db.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM nodes'
      );

      const enabledResult = await this.db.queryFirst<{ count: number }>(
        'SELECT COUNT(*) as count FROM nodes WHERE enabled = 1'
      );

      const typeStatsResult = await this.db.query<{ type: string; count: number }>(
        'SELECT type, COUNT(*) as count FROM nodes GROUP BY type'
      );

      if (!totalResult.success || !enabledResult.success || !typeStatsResult.success) {
        return { success: false, error: 'Failed to get node statistics' };
      }

      const total = totalResult.data?.count || 0;
      const enabled = enabledResult.data?.count || 0;
      const byType: Record<string, number> = {};

      (typeStatsResult.data || []).forEach(row => {
        byType[row.type] = row.count;
      });

      return {
        success: true,
        data: {
          total,
          enabled,
          disabled: total - enabled,
          byType
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get node statistics: ${error}`
      };
    }
  }

  // 更新节点使用统计
  async updateNodeUsage(nodeId: string): Promise<DbResult<void>> {
    try {
      const result = await this.db.execute(
        'UPDATE nodes SET total_requests = total_requests + 1, last_used = ? WHERE id = ?',
        [new Date().toISOString(), nodeId]
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to update node usage: ${error}`
      };
    }
  }
}
