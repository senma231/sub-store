import { Hono } from 'hono';
import { Env } from '../index';

export const statsRouter = new Hono<{ Bindings: Env }>();

// 模拟节点数据（与 nodes.ts 保持一致）
const demoNodes = [
  {
    id: 'demo-vless-1',
    name: '演示 VLESS 节点',
    type: 'vless',
    server: 'demo.example.com',
    port: 443,
    enabled: true,
    uuid: '12345678-1234-1234-1234-123456789abc',
    remark: '这是一个演示节点',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-vmess-1',
    name: '演示 VMess 节点',
    type: 'vmess',
    server: 'demo2.example.com',
    port: 443,
    enabled: true,
    uuid: '87654321-4321-4321-4321-cba987654321',
    remark: '这是另一个演示节点',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
];

// 获取统计信息
statsRouter.get('/', async (c) => {
  try {
    // 使用内存数据而不是 KV 存储
    const nodes = demoNodes;

    // 模拟订阅统计
    const totalStats = {
      totalRequests: 1250,
      formatStats: {
        v2ray: 500,
        clash: 450,
        shadowrocket: 300,
      },
    };
    
    // 生成模拟的最近7天统计
    const requestsByDate: Record<string, number> = {};

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      // 生成模拟数据
      requestsByDate[dateStr] = Math.floor(Math.random() * 100) + 50;
    }

    // 统计节点类型
    const nodeTypeStats = nodes.reduce((stats: Record<string, number>, node: any) => {
      stats[node.type] = (stats[node.type] || 0) + 1;
      return stats;
    }, {});

    // 统计活跃节点
    const activeNodes = nodes.filter((node: any) => node.enabled).length;

    const statistics = {
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

    // 使用内存数据而不是 KV 存储
    const nodes = demoNodes;

    // 生成模拟的指定天数统计
    const dailyStats = [];
    const formatStats: Record<string, number> = {
      v2ray: 0,
      clash: 0,
      shadowrocket: 0,
    };
    const userAgentStats: Record<string, number> = {
      'V2RayN/6.23': 0,
      'ClashX/1.118.0': 0,
      'Shadowrocket/1.8.0': 0,
    };
    const ipStats: Record<string, number> = {};

    for (let i = maxDays - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      // 生成模拟的每日统计
      const totalRequests = Math.floor(Math.random() * 100) + 20;
      const dayFormatStats = {
        v2ray: Math.floor(totalRequests * 0.4),
        clash: Math.floor(totalRequests * 0.35),
        shadowrocket: Math.floor(totalRequests * 0.25),
      };

      dailyStats.push({
        date: dateStr,
        totalRequests,
        formatStats: dayFormatStats,
        userAgentStats: {
          'V2RayN/6.23': Math.floor(dayFormatStats.v2ray * 0.8),
          'ClashX/1.118.0': Math.floor(dayFormatStats.clash * 0.9),
          'Shadowrocket/1.8.0': dayFormatStats.shadowrocket,
        },
        ipStats: {
          [`192.168.1.${Math.floor(Math.random() * 100) + 1}`]: Math.floor(totalRequests * 0.3),
          [`10.0.0.${Math.floor(Math.random() * 100) + 1}`]: Math.floor(totalRequests * 0.2),
        },
      });

      // 累计统计
      Object.entries(dayFormatStats).forEach(([format, count]) => {
        formatStats[format] += count;
      });
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

    // 模拟清理操作（因为我们使用内存数据）
    const deletedCount = Math.floor(Math.random() * 10) + 5;

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
