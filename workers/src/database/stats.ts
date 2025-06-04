import { Database } from './index';
import { DbAccessLog, Statistics, DbResult } from '../../../shared/types';

export class StatsRepository {
  constructor(private db: Database) {}

  // 记录访问日志
  async logAccess(log: {
    type: string;
    endpoint: string;
    method: string;
    userAgent?: string;
    ipAddress?: string;
    referer?: string;
    subscriptionFormat?: string;
    nodeCount?: number;
    statusCode?: number;
    responseTime?: number;
  }): Promise<DbResult<void>> {
    try {
      const result = await this.db.execute(
        `INSERT INTO access_logs (
          type, endpoint, method, user_agent, ip_address, referer,
          subscription_format, node_count, status_code, response_time, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          log.type,
          log.endpoint,
          log.method,
          log.userAgent,
          log.ipAddress,
          log.referer,
          log.subscriptionFormat,
          log.nodeCount,
          log.statusCode,
          log.responseTime,
          new Date().toISOString()
        ]
      );

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Failed to log access: ${error}`
      };
    }
  }

  // 获取基础统计信息
  async getBasicStats(): Promise<DbResult<Statistics>> {
    try {
      // 获取节点统计
      const nodeStatsResult = await this.db.query<{ 
        total_nodes: number; 
        active_nodes: number; 
        type: string; 
        count: number; 
      }>(`
        SELECT 
          (SELECT COUNT(*) FROM nodes) as total_nodes,
          (SELECT COUNT(*) FROM nodes WHERE enabled = 1) as active_nodes,
          type,
          COUNT(*) as count
        FROM nodes 
        GROUP BY type
      `);

      // 获取请求统计
      const requestStatsResult = await this.db.query<{
        total_requests: number;
        format: string;
        count: number;
        date: string;
      }>(`
        SELECT 
          (SELECT COUNT(*) FROM access_logs) as total_requests,
          subscription_format as format,
          COUNT(*) as count,
          DATE(created_at) as date
        FROM access_logs 
        WHERE subscription_format IS NOT NULL
        GROUP BY subscription_format, DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `);

      if (!nodeStatsResult.success || !requestStatsResult.success) {
        return { 
          success: false, 
          error: 'Failed to get basic statistics' 
        };
      }

      const nodeData = nodeStatsResult.data || [];
      const requestData = requestStatsResult.data || [];

      const totalNodes = nodeData[0]?.total_nodes || 0;
      const activeNodes = nodeData[0]?.active_nodes || 0;
      const totalRequests = requestData[0]?.total_requests || 0;

      // 构建节点类型统计
      const nodesByType: Record<string, number> = {};
      nodeData.forEach(row => {
        if (row.type) {
          nodesByType[row.type] = row.count;
        }
      });

      // 构建请求格式统计
      const requestsByFormat: Record<string, number> = {};
      requestData.forEach(row => {
        if (row.format) {
          requestsByFormat[row.format] = (requestsByFormat[row.format] || 0) + row.count;
        }
      });

      // 构建日期统计
      const requestsByDate: Record<string, number> = {};
      requestData.forEach(row => {
        if (row.date) {
          requestsByDate[row.date] = (requestsByDate[row.date] || 0) + row.count;
        }
      });

      return {
        success: true,
        data: {
          totalNodes,
          totalSubscriptions: 1, // 当前版本只有一个默认订阅
          totalRequests,
          activeNodes,
          requestsByFormat,
          requestsByDate
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get basic stats: ${error}`
      };
    }
  }

  // 获取详细统计信息
  async getDetailedStats(days: number = 30): Promise<DbResult<{
    summary: {
      totalNodes: number;
      activeNodes: number;
      totalRequests: number;
      avgDailyRequests: number;
    };
    nodes: {
      typeStats: Record<string, number>;
      statusStats: {
        enabled: number;
        disabled: number;
      };
      recent: Array<{
        id: string;
        name: string;
        type: string;
        createdAt: string;
      }>;
    };
    requests: {
      daily: Array<{
        date: string;
        totalRequests: number;
        formatStats: Record<string, number>;
        userAgentStats: Record<string, number>;
        ipStats: Record<string, number>;
      }>;
      byFormat: Record<string, number>;
      topUserAgents: Array<{
        userAgent: string;
        requests: number;
      }>;
      topIPs: Array<{
        ip: string;
        requests: number;
      }>;
    };
    period: {
      days: number;
      startDate: string;
      endDate: string;
    };
  }>> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
      
      // 节点统计
      const nodeStatsResult = await this.db.query<any>(`
        SELECT 
          COUNT(*) as total_nodes,
          SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) as active_nodes,
          type,
          COUNT(*) as type_count
        FROM nodes 
        GROUP BY type
      `);

      // 最近节点
      const recentNodesResult = await this.db.query<{
        id: string;
        name: string;
        type: string;
        created_at: string;
      }>(`
        SELECT id, name, type, created_at 
        FROM nodes 
        ORDER BY created_at DESC 
        LIMIT 5
      `);

      // 请求统计
      const requestStatsResult = await this.db.query<any>(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_requests,
          subscription_format,
          user_agent,
          ip_address
        FROM access_logs 
        WHERE created_at >= ? AND created_at <= ?
        GROUP BY DATE(created_at), subscription_format, user_agent, ip_address
        ORDER BY date DESC
      `, [startDate.toISOString(), endDate.toISOString()]);

      // Top User Agents
      const topUserAgentsResult = await this.db.query<{
        user_agent: string;
        requests: number;
      }>(`
        SELECT user_agent, COUNT(*) as requests
        FROM access_logs 
        WHERE created_at >= ? AND user_agent IS NOT NULL
        GROUP BY user_agent
        ORDER BY requests DESC
        LIMIT 10
      `, [startDate.toISOString()]);

      // Top IPs
      const topIPsResult = await this.db.query<{
        ip_address: string;
        requests: number;
      }>(`
        SELECT ip_address, COUNT(*) as requests
        FROM access_logs 
        WHERE created_at >= ? AND ip_address IS NOT NULL
        GROUP BY ip_address
        ORDER BY requests DESC
        LIMIT 10
      `, [startDate.toISOString()]);

      if (!nodeStatsResult.success || !requestStatsResult.success) {
        return { success: false, error: 'Failed to get detailed statistics' };
      }

      const nodeData = nodeStatsResult.data || [];
      const requestData = requestStatsResult.data || [];
      const recentNodes = recentNodesResult.data || [];
      const topUserAgents = topUserAgentsResult.data || [];
      const topIPs = topIPsResult.data || [];

      // 处理节点统计
      const totalNodes = nodeData.reduce((sum, row) => sum + (row.type_count || 0), 0);
      const activeNodes = nodeData.reduce((sum, row) => sum + (row.active_nodes || 0), 0);
      
      const typeStats: Record<string, number> = {};
      nodeData.forEach(row => {
        if (row.type) {
          typeStats[row.type] = row.type_count || 0;
        }
      });

      // 处理请求统计
      const totalRequests = requestData.length;
      const avgDailyRequests = days > 0 ? totalRequests / days : 0;

      const dailyStats: Record<string, any> = {};
      const formatStats: Record<string, number> = {};

      requestData.forEach(row => {
        const date = row.date;
        if (!dailyStats[date]) {
          dailyStats[date] = {
            date,
            totalRequests: 0,
            formatStats: {},
            userAgentStats: {},
            ipStats: {}
          };
        }

        dailyStats[date].totalRequests += row.total_requests || 0;

        if (row.subscription_format) {
          dailyStats[date].formatStats[row.subscription_format] = 
            (dailyStats[date].formatStats[row.subscription_format] || 0) + 1;
          formatStats[row.subscription_format] = 
            (formatStats[row.subscription_format] || 0) + 1;
        }

        if (row.user_agent) {
          dailyStats[date].userAgentStats[row.user_agent] = 
            (dailyStats[date].userAgentStats[row.user_agent] || 0) + 1;
        }

        if (row.ip_address) {
          dailyStats[date].ipStats[row.ip_address] = 
            (dailyStats[date].ipStats[row.ip_address] || 0) + 1;
        }
      });

      return {
        success: true,
        data: {
          summary: {
            totalNodes,
            activeNodes,
            totalRequests,
            avgDailyRequests
          },
          nodes: {
            typeStats,
            statusStats: {
              enabled: activeNodes,
              disabled: totalNodes - activeNodes
            },
            recent: recentNodes.map(node => ({
              id: node.id,
              name: node.name,
              type: node.type,
              createdAt: node.created_at
            }))
          },
          requests: {
            daily: Object.values(dailyStats),
            byFormat: formatStats,
            topUserAgents: topUserAgents.map(ua => ({
              userAgent: ua.user_agent,
              requests: ua.requests
            })),
            topIPs: topIPs.map(ip => ({
              ip: ip.ip_address,
              requests: ip.requests
            }))
          },
          period: {
            days,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          }
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get detailed stats: ${error}`
      };
    }
  }

  // 清理旧的访问日志
  async cleanupOldLogs(retentionDays: number = 30): Promise<DbResult<{ deletedCount: number }>> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const result = await this.db.execute(
        'DELETE FROM access_logs WHERE created_at < ?',
        [cutoffDate.toISOString()]
      );

      return {
        success: result.success,
        data: { deletedCount: result.meta?.changes || 0 },
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to cleanup old logs: ${error}`
      };
    }
  }

  // 获取访问日志
  async getAccessLogs(params: {
    page?: number;
    limit?: number;
    type?: string;
    startDate?: string;
    endDate?: string;
  } = {}): Promise<DbResult<{
    items: DbAccessLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>> {
    try {
      const { page = 1, limit = 50, type, startDate, endDate } = params;
      const offset = (page - 1) * limit;

      const conditions: string[] = [];
      const queryParams: any[] = [];

      if (type) {
        conditions.push('type = ?');
        queryParams.push(type);
      }

      if (startDate) {
        conditions.push('created_at >= ?');
        queryParams.push(startDate);
      }

      if (endDate) {
        conditions.push('created_at <= ?');
        queryParams.push(endDate);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 获取总数
      const countResult = await this.db.queryFirst<{ count: number }>(
        `SELECT COUNT(*) as count FROM access_logs ${whereClause}`,
        queryParams
      );

      if (!countResult.success) {
        return { success: false, error: countResult.error };
      }

      const total = countResult.data?.count || 0;

      // 获取数据
      const dataResult = await this.db.query<DbAccessLog>(
        `SELECT * FROM access_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...queryParams, limit, offset]
      );

      if (!dataResult.success) {
        return { success: false, error: dataResult.error };
      }

      return {
        success: true,
        data: {
          items: dataResult.data || [],
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get access logs: ${error}`
      };
    }
  }
}
