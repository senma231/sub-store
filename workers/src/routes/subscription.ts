import { Hono } from 'hono';
import { Env } from '../index';
import { ProxyNode } from '../../../shared/types';
import { convertNodes, ConversionOptions, isFormatSupported, getFormatInfo } from '../converters';
import { subscriptionRateLimitMiddleware } from '../middleware/rateLimit';

export const subscriptionRouter = new Hono<{ Bindings: Env }>();

// 应用订阅专用的速率限制
subscriptionRouter.use('*', subscriptionRateLimitMiddleware);

// 获取订阅内容
subscriptionRouter.get('/:format', async (c) => {
  try {
    const format = c.req.param('format');
    const token = c.req.query('token');
    const userAgent = c.req.header('User-Agent') || '';
    
    // 验证格式
    if (!isFormatSupported(format)) {
      return c.text(`Unsupported format: ${format}`, 400);
    }
    
    // 验证 token (可选，用于访问控制)
    if (token && !await validateSubscriptionToken(c.env.SUB_STORE_KV, token)) {
      return c.text('Invalid subscription token', 401);
    }
    
    // 获取节点数据
    const nodesData = await c.env.SUB_STORE_KV.get('nodes');
    const allNodes: ProxyNode[] = nodesData ? JSON.parse(nodesData) : [];
    
    // 过滤启用的节点
    let nodes = allNodes.filter(node => node.enabled);
    
    // 解析查询参数
    const options: ConversionOptions = {
      userAgent,
      filename: c.req.query('filename'),
      includeExpired: c.req.query('include_expired') === 'true',
      sort: c.req.query('sort') as any,
      filter: {
        types: c.req.query('types')?.split(','),
        keywords: c.req.query('include')?.split(','),
        excludeKeywords: c.req.query('exclude')?.split(','),
      },
      grouping: {
        enabled: c.req.query('group') === 'true',
        groupBy: c.req.query('group_by') as any || 'type',
      },
    };
    
    // 解析重命名规则
    const renameRules = c.req.query('rename');
    if (renameRules) {
      try {
        options.rename = JSON.parse(decodeURIComponent(renameRules));
      } catch (error) {
        console.warn('Invalid rename rules:', error);
      }
    }
    
    // 如果没有节点，返回空订阅
    if (nodes.length === 0) {
      const emptyResult = await convertNodes([], format, options);
      return c.text(emptyResult.content, 200, {
        'Content-Type': emptyResult.contentType,
        'Content-Disposition': `attachment; filename="${emptyResult.filename}"`,
        'Subscription-Userinfo': 'upload=0; download=0; total=0; expire=0',
        'Profile-Update-Interval': '24',
        'Profile-Title': 'Sub-Store Subscription',
      });
    }
    
    // 转换节点
    const result = await convertNodes(nodes, format, options);
    
    // 记录访问统计
    await recordSubscriptionAccess(c.env.SUB_STORE_KV, {
      format,
      nodeCount: nodes.length,
      userAgent,
      ip: c.req.header('CF-Connecting-IP') || 'unknown',
      timestamp: new Date().toISOString(),
    });
    
    // 设置响应头
    const headers: Record<string, string> = {
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    };
    
    // 添加订阅信息头
    if (format === 'clash' || format === 'v2ray') {
      headers['Subscription-Userinfo'] = `upload=0; download=0; total=${nodes.length}; expire=0`;
      headers['Profile-Update-Interval'] = '24';
      headers['Profile-Title'] = 'Sub-Store Subscription';
    }
    
    return c.text(result.content, 200, headers);
    
  } catch (error) {
    console.error('Subscription error:', error);
    return c.text('Internal server error', 500);
  }
});

// 获取订阅信息
subscriptionRouter.get('/:format/info', async (c) => {
  try {
    const format = c.req.param('format');
    
    if (!isFormatSupported(format)) {
      return c.json({
        success: false,
        error: 'Unsupported format',
        message: `Format '${format}' is not supported`,
      }, 400);
    }
    
    const formatInfo = getFormatInfo(format);
    const nodesData = await c.env.SUB_STORE_KV.get('nodes');
    const allNodes: ProxyNode[] = nodesData ? JSON.parse(nodesData) : [];
    const enabledNodes = allNodes.filter(node => node.enabled);
    
    // 统计节点类型
    const nodeStats = enabledNodes.reduce((stats, node) => {
      stats[node.type] = (stats[node.type] || 0) + 1;
      return stats;
    }, {} as Record<string, number>);
    
    return c.json({
      success: true,
      data: {
        format: formatInfo,
        statistics: {
          totalNodes: allNodes.length,
          enabledNodes: enabledNodes.length,
          nodeTypes: nodeStats,
        },
        lastUpdated: allNodes.length > 0 ? 
          Math.max(...allNodes.map(n => new Date(n.updatedAt).getTime())) : 
          Date.now(),
      },
    });
    
  } catch (error) {
    console.error('Subscription info error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 获取支持的格式列表
subscriptionRouter.get('/', async (c) => {
  const formats = [
    'v2ray',
    'v2ray-json', 
    'clash',
    'shadowrocket',
    'quantumult-x',
    'surge'
  ].map(format => ({
    format,
    ...getFormatInfo(format),
    url: `${c.req.url}/${format}`,
  }));
  
  return c.json({
    success: true,
    data: {
      formats,
      parameters: {
        token: 'Subscription token (optional)',
        filename: 'Custom filename',
        types: 'Filter by node types (comma-separated)',
        include: 'Include keywords (comma-separated)',
        exclude: 'Exclude keywords (comma-separated)',
        sort: 'Sort by: name, type, latency',
        group: 'Enable grouping (true/false)',
        group_by: 'Group by: type, region, provider',
        rename: 'Rename rules (JSON encoded)',
      },
      examples: {
        v2ray: `${c.req.url}/v2ray?token=your_token`,
        clash: `${c.req.url}/clash?group=true&sort=name`,
        filtered: `${c.req.url}/v2ray?types=vless,vmess&exclude=expired`,
      },
    },
  });
});

// 验证订阅 token
async function validateSubscriptionToken(kv: KVNamespace, token: string): Promise<boolean> {
  try {
    // 检查 token 是否在允许列表中
    const allowedTokens = await kv.get('subscription_tokens');
    if (allowedTokens) {
      const tokens = JSON.parse(allowedTokens);
      return tokens.includes(token);
    }
    
    // 如果没有设置 token 列表，则允许所有访问
    return true;
  } catch (error) {
    console.error('Token validation error:', error);
    return false;
  }
}

// 记录订阅访问统计
async function recordSubscriptionAccess(kv: KVNamespace, access: any): Promise<void> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const statsKey = `stats:subscription:${today}`;
    
    // 获取今日统计
    const todayStatsData = await kv.get(statsKey);
    const todayStats = todayStatsData ? JSON.parse(todayStatsData) : {
      date: today,
      totalRequests: 0,
      formatStats: {},
      userAgentStats: {},
      ipStats: {},
    };
    
    // 更新统计
    todayStats.totalRequests++;
    todayStats.formatStats[access.format] = (todayStats.formatStats[access.format] || 0) + 1;
    todayStats.userAgentStats[access.userAgent] = (todayStats.userAgentStats[access.userAgent] || 0) + 1;
    todayStats.ipStats[access.ip] = (todayStats.ipStats[access.ip] || 0) + 1;
    
    // 保存统计 (保留30天)
    await kv.put(statsKey, JSON.stringify(todayStats), { 
      expirationTtl: 30 * 24 * 60 * 60 
    });
    
    // 更新总体统计
    const totalStatsKey = 'stats:subscription:total';
    const totalStatsData = await kv.get(totalStatsKey);
    const totalStats = totalStatsData ? JSON.parse(totalStatsData) : {
      totalRequests: 0,
      formatStats: {},
      lastUpdated: new Date().toISOString(),
    };
    
    totalStats.totalRequests++;
    totalStats.formatStats[access.format] = (totalStats.formatStats[access.format] || 0) + 1;
    totalStats.lastUpdated = new Date().toISOString();
    
    await kv.put(totalStatsKey, JSON.stringify(totalStats));
    
  } catch (error) {
    console.error('Failed to record subscription access:', error);
  }
}
