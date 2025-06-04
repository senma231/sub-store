import { Hono } from 'hono';
import { Env } from '../index';
import { Statistics } from '../../../shared/types';

export const statsRouter = new Hono<{ Bindings: Env }>();

// 获取统计信息
statsRouter.get('/', async (c) => {
  try {
    // 获取节点统计
    const nodesData = await c.env.SUB_STORE_KV.get('nodes');
    const nodes = nodesData ? JSON.parse(nodesData) : [];
    
    // 获取订阅统计
    const totalStatsData = await c.env.SUB_STORE_KV.get('stats:subscription:total');
    const totalStats = totalStatsData ? JSON.parse(totalStatsData) : {
      totalRequests: 0,
      formatStats: {},
    };
    
    // 获取最近7天的统计
    const last7Days = [];
    const requestsByDate: Record<string, number> = {};
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      last7Days.push(dateStr);
      
      const dayStatsData = await c.env.SUB_STORE_KV.get(`stats:subscription:${dateStr}`);
      const dayStats = dayStatsData ? JSON.parse(dayStatsData) : { totalRequests: 0 };
      requestsByDate[dateStr] = dayStats.totalRequests;
    }
    
    // 统计节点类型
    const nodeTypeStats = nodes.reduce((stats: Record<string, number>, node: any) => {
      stats[node.type] = (stats[node.type] || 0) + 1;
      return stats;
    }, {});
    
    // 统计活跃节点
    const activeNodes = nodes.filter((node: any) => node.enabled).length;
    
    const statistics: Statistics = {
      totalNodes: nodes.length,
      totalSubscriptions: 1, // 简化实现
      totalRequests: totalStats.totalRequests,
      activeNodes,
      requestsByFormat: totalStats.formatStats,
      requestsByDate,
      topNodes: [], // 简化实现
    };
    
    return c.json({
      success: true,
      data: statistics,
    });
    
  } catch (error) {
    console.error('Failed to get statistics:', error);
    return c.json({
      success: false,
      error: 'Failed to get statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 获取详细统计信息
statsRouter.get('/detailed', async (c) => {
  try {
    const days = parseInt(c.req.query('days') || '30');
    const maxDays = Math.min(days, 90); // 最多90天
    
    // 获取节点数据
    const nodesData = await c.env.SUB_STORE_KV.get('nodes');
    const nodes = nodesData ? JSON.parse(nodesData) : [];
    
    // 获取指定天数的统计
    const dailyStats = [];
    const formatStats: Record<string, number> = {};
    const userAgentStats: Record<string, number> = {};
    const ipStats: Record<string, number> = {};
    
    for (let i = maxDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayStatsData = await c.env.SUB_STORE_KV.get(`stats:subscription:${dateStr}`);
      if (dayStatsData) {
        const dayStats = JSON.parse(dayStatsData);
        dailyStats.push(dayStats);
        
        // 合并格式统计
        Object.entries(dayStats.formatStats || {}).forEach(([format, count]) => {
          formatStats[format] = (formatStats[format] || 0) + (count as number);
        });
        
        // 合并用户代理统计
        Object.entries(dayStats.userAgentStats || {}).forEach(([ua, count]) => {
          userAgentStats[ua] = (userAgentStats[ua] || 0) + (count as number);
        });
        
        // 合并IP统计
        Object.entries(dayStats.ipStats || {}).forEach(([ip, count]) => {
          ipStats[ip] = (ipStats[ip] || 0) + (count as number);
        });
      } else {
        dailyStats.push({
          date: dateStr,
          totalRequests: 0,
          formatStats: {},
          userAgentStats: {},
          ipStats: {},
        });
      }
    }
    
    // 节点类型统计
    const nodeTypeStats = nodes.reduce((stats: Record<string, number>, node: any) => {
      stats[node.type] = (stats[node.type] || 0) + 1;
      return stats;
    }, {});
    
    // 节点状态统计
    const nodeStatusStats = {
      enabled: nodes.filter((node: any) => node.enabled).length,
      disabled: nodes.filter((node: any) => !node.enabled).length,
    };
    
    // 最近创建的节点
    const recentNodes = nodes
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
    
    // 热门用户代理 (前10)
    const topUserAgents = Object.entries(userAgentStats)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([ua, count]) => ({ userAgent: ua, requests: count }));
    
    // 热门IP (前10)
    const topIPs = Object.entries(ipStats)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, requests: count }));
    
    return c.json({
      success: true,
      data: {
        summary: {
          totalNodes: nodes.length,
          activeNodes: nodeStatusStats.enabled,
          totalRequests: dailyStats.reduce((sum, day) => sum + day.totalRequests, 0),
          avgDailyRequests: dailyStats.reduce((sum, day) => sum + day.totalRequests, 0) / maxDays,
        },
        nodes: {
          typeStats: nodeTypeStats,
          statusStats: nodeStatusStats,
          recent: recentNodes.map((node: any) => ({
            id: node.id,
            name: node.name,
            type: node.type,
            createdAt: node.createdAt,
          })),
        },
        requests: {
          daily: dailyStats,
          byFormat: formatStats,
          topUserAgents,
          topIPs,
        },
        period: {
          days: maxDays,
          startDate: dailyStats[0]?.date,
          endDate: dailyStats[dailyStats.length - 1]?.date,
        },
      },
    });
    
  } catch (error) {
    console.error('Failed to get detailed statistics:', error);
    return c.json({
      success: false,
      error: 'Failed to get detailed statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 清理旧统计数据
statsRouter.delete('/cleanup', async (c) => {
  try {
    const user = c.get('user');
    
    // 只有管理员可以清理数据
    if (user?.role !== 'admin') {
      return c.json({
        success: false,
        error: 'Forbidden',
        message: 'Only admin can cleanup statistics',
      }, 403);
    }
    
    const retentionDays = parseInt(c.req.query('retention_days') || '30');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    let deletedCount = 0;
    
    // 删除超过保留期的统计数据
    for (let i = 365; i > retentionDays; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const key = `stats:subscription:${dateStr}`;
      
      const exists = await c.env.SUB_STORE_KV.get(key);
      if (exists) {
        await c.env.SUB_STORE_KV.delete(key);
        deletedCount++;
      }
    }
    
    return c.json({
      success: true,
      data: {
        deletedCount,
        retentionDays,
        cutoffDate: cutoffDate.toISOString(),
      },
      message: `Cleaned up ${deletedCount} old statistics records`,
    });
    
  } catch (error) {
    console.error('Failed to cleanup statistics:', error);
    return c.json({
      success: false,
      error: 'Failed to cleanup statistics',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});
