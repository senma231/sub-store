import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { xuiPanels } from './routes/xuiPanels';
import { nodes } from './routes/nodes';
import { subscriptions } from './routes/subscriptions';
import { auth } from './routes/auth';
import { NodeRepository } from './repositories/nodeRepository';
import { SubscriptionRepository } from './repositories/subscriptionRepository';
import { XUIPanelRepository } from './repositories/xuiPanelRepository';
import { initializeDatabase, checkDatabaseHealth } from './database/init';

type Bindings = {
  DB: D1Database;
  ADMIN_TOKEN: string;
  JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// 数据库初始化中间件
app.use('*', async (c, next) => {
  try {
    // 检查数据库是否已初始化
    const tables = await c.env.DB.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='users'
    `).first();

    if (!tables) {
      console.log('数据库未初始化，开始初始化...');
      const initResult = await initializeDatabase(c.env.DB);
      if (!initResult.success) {
        console.error('数据库初始化失败:', initResult.error);
        return c.json({
          success: false,
          error: '数据库初始化失败',
          details: initResult.error
        }, 500);
      }
      console.log('数据库初始化成功');
    }

    await next();
  } catch (error) {
    console.error('数据库中间件错误:', error);
    return c.json({
      success: false,
      error: '数据库连接失败'
    }, 500);
  }
});

// 中间件
app.use('*', logger());

// CORS 配置
app.use('*', cors({
  origin: [
    'https://sub.senma.io',
    'https://sub-store-frontend.pages.dev',
    'https://senma231.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://localhost:3000'
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// 健康检查
app.get('/health', async (c) => {
  try {
    // 检查数据库健康状态
    const dbHealth = await checkDatabaseHealth(c.env.DB);

    return c.json({
      status: dbHealth.success ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      service: 'Sub-Store API',
      database: dbHealth.success ? dbHealth.data : { healthy: false, error: dbHealth.error }
    });
  } catch (error) {
    console.error('健康检查失败:', error);
    return c.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      service: 'Sub-Store API',
      database: { healthy: false, error: '数据库连接失败' }
    }, 500);
  }
});



// API 路由
app.route('/api/xui-panels', xuiPanels);
app.route('/api/nodes', nodes);
app.route('/api/subscriptions', subscriptions);
app.route('/api/auth', auth);

// 订阅内容路由
app.get('/sub', async (c) => {
  try {
    // 返回支持的订阅格式
    const formats = [
      {
        format: 'v2ray',
        name: 'V2Ray/V2RayN',
        description: 'Base64 encoded subscription for V2Ray clients',
        extension: 'txt',
        contentType: 'text/plain',
        url: `${c.req.url.replace('/sub', '/sub/v2ray')}`
      },
      {
        format: 'clash',
        name: 'Clash',
        description: 'YAML configuration for Clash clients',
        extension: 'yaml',
        contentType: 'text/yaml',
        url: `${c.req.url.replace('/sub', '/sub/clash')}`
      },
      {
        format: 'shadowrocket',
        name: 'Shadowrocket',
        description: 'Base64 encoded subscription for Shadowrocket',
        extension: 'txt',
        contentType: 'text/plain',
        url: `${c.req.url.replace('/sub', '/sub/shadowrocket')}`
      }
    ];

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
          rename: 'Rename rules (JSON encoded)'
        }
      }
    });
  } catch (error) {
    console.error('获取订阅格式失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 订阅内容生成
app.get('/sub/:format', async (c) => {
  try {
    const format = c.req.param('format');

    // 获取所有节点
    const nodeRepo = new NodeRepository(c.env.DB);
    const nodesResult = await nodeRepo.findAll();

    if (!nodesResult.success) {
      return c.text('# 获取节点失败\n# 请检查服务器配置', 500);
    }

    const nodes = nodesResult.data || [];

    if (nodes.length === 0) {
      return c.text('# 暂无可用节点\n# 请先添加节点', 200);
    }

    // 根据格式生成订阅内容
    let content = '';

    switch (format.toLowerCase()) {
      case 'v2ray':
      case 'v2rayn':
        // 生成V2Ray Base64格式
        const v2rayNodes = nodes
          .filter(node => ['vless', 'vmess'].includes(node.type))
          .map(node => {
            if (node.type === 'vless') {
              return `vless://${node.uuid}@${node.server}:${node.port}?type=${node.network || 'tcp'}&security=${node.security || 'none'}#${encodeURIComponent(node.name)}`;
            } else if (node.type === 'vmess') {
              const vmessConfig = {
                v: '2',
                ps: node.name,
                add: node.server,
                port: node.port,
                id: node.uuid,
                aid: node.alterId || 0,
                net: node.network || 'tcp',
                type: 'none',
                host: '',
                path: node.wsPath || '',
                tls: node.tls ? 'tls' : ''
              };
              return 'vmess://' + btoa(JSON.stringify(vmessConfig));
            }
            return '';
          })
          .filter(Boolean);

        content = btoa(v2rayNodes.join('\n'));
        break;

      case 'clash':
        // 生成Clash YAML格式
        const clashNodes = nodes.map(node => {
          if (node.type === 'vless') {
            return {
              name: node.name,
              type: 'vless',
              server: node.server,
              port: node.port,
              uuid: node.uuid,
              network: node.network || 'tcp',
              tls: node.tls || false
            };
          } else if (node.type === 'vmess') {
            return {
              name: node.name,
              type: 'vmess',
              server: node.server,
              port: node.port,
              uuid: node.uuid,
              alterId: node.alterId || 0,
              cipher: 'auto',
              network: node.network || 'tcp',
              tls: node.tls || false
            };
          }
          return null;
        }).filter(Boolean);

        content = `# Clash配置文件
# 生成时间: ${new Date().toISOString()}

proxies:
${clashNodes.map(node => `  - ${JSON.stringify(node)}`).join('\n')}

proxy-groups:
  - name: "🚀 节点选择"
    type: select
    proxies:
${clashNodes.map(node => `      - "${node.name}"`).join('\n')}

rules:
  - MATCH,🚀 节点选择`;
        break;

      default:
        return c.text('不支持的订阅格式', 400);
    }

    // 设置响应头
    const headers: Record<string, string> = {
      'Content-Type': format === 'clash' ? 'text/yaml; charset=utf-8' : 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Content-Disposition': `attachment; filename="subscription.${format === 'clash' ? 'yaml' : 'txt'}"`
    };

    return c.text(content, 200, headers);
  } catch (error) {
    console.error('生成订阅内容失败:', error);
    return c.text('# 生成订阅失败\n# 请联系管理员', 500);
  }
});

// 统计信息
app.get('/api/stats', async (c) => {
  try {
    console.log('开始获取统计信息...');
    const nodeRepo = new NodeRepository(c.env.DB);
    const subRepo = new SubscriptionRepository(c.env.DB);
    const xuiRepo = new XUIPanelRepository(c.env.DB);

    const [nodeStats, subStats, xuiPanels] = await Promise.all([
      nodeRepo.getStats(),
      subRepo.getStats(),
      xuiRepo.findAll()
    ]);

    console.log('节点统计结果:', nodeStats);
    console.log('订阅统计结果:', subStats);

    const statsData = {
      totalNodes: nodeStats.success ? nodeStats.data?.total || 0 : 0,
      activeNodes: nodeStats.success ? nodeStats.data?.enabled || 0 : 0, // 修复：使用enabled作为活跃节点数
      totalSubscriptions: subStats.success ? subStats.data?.total || 0 : 0,
      totalXUIPanels: xuiPanels.success ? xuiPanels.data?.length || 0 : 0,
      totalRequests: 0,
      nodeTypes: nodeStats.success ? nodeStats.data?.byType || {} : {}
    };

    console.log('返回统计数据:', statsData);

    return c.json({
      success: true,
      data: statsData
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 404 处理
app.notFound((c) => {
  return c.json({
    success: false,
    error: '接口不存在',
    path: c.req.path,
    method: c.req.method
  }, 404);
});

// 错误处理
app.onError((err, c) => {
  console.error('服务器错误:', err);
  return c.json({
    success: false,
    error: '服务器内部错误',
    message: err.message
  }, 500);
});

export default app;
