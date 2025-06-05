import { Hono } from 'hono';
import { Env } from '../index';
import { generateCustomSubscriptionContent } from './customSubscriptions';

// 简化的节点类型
interface SimpleNode {
  id: string;
  name: string;
  type: 'vless' | 'vmess' | 'trojan' | 'ss' | 'socks5' | 'hy2' | 'hy';
  server: string;
  port: number;
  enabled: boolean;
  remark?: string;
  uuid?: string;
  password?: string;
  method?: string;
  [key: string]: any;
}

export const subscriptionRouter = new Hono<{ Bindings: Env }>();

// 演示节点数据
const demoNodes: SimpleNode[] = [
  {
    id: 'demo-vless-1',
    name: '演示 VLESS 节点',
    type: 'vless',
    server: 'demo.example.com',
    port: 443,
    enabled: true,
    uuid: '12345678-1234-1234-1234-123456789abc',
    remark: '这是一个演示节点',
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
  }
];

// 获取订阅内容
subscriptionRouter.get('/:format', async (c) => {
  const format = c.req.param('format');

  // 验证格式
  const supportedFormats = ['v2ray', 'clash', 'shadowrocket'];
  if (!supportedFormats.includes(format)) {
    return c.text(`Unsupported format: ${format}. Supported: ${supportedFormats.join(', ')}`, 400);
  }

  // 简单的 V2Ray 测试
  if (format === 'v2ray') {
    return c.text('dmxlc3M6Ly8xMjM0NTY3OC0xMjM0LTEyMzQtMTIzNC0xMjM0NTY3ODlhYmNAZGVtby5leGFtcGxlLmNvbTo0NDM/dHlwZT10Y3Amc2VjdXJpdHk9dGxzIyVFNiVCQyU5NCVFNyVBNCVCQSUyMFZMRVNTJTIwJUU4JThBJTgyJUU3JTgyJUI5', 200, {
      'Content-Type': 'text/plain',
      'Content-Disposition': 'attachment; filename="sub-store-v2ray.txt"',
      'Subscription-Userinfo': 'upload=0; download=0; total=2; expire=0',
    });
  }

  // 简化的响应
  if (format === 'clash') {
    const clashConfig = {
      port: 7890,
      'socks-port': 7891,
      'allow-lan': false,
      mode: 'rule',
      'log-level': 'info',
      proxies: [
        {
          name: '演示 VLESS 节点',
          type: 'vless',
          server: 'demo.example.com',
          port: 443,
          uuid: '12345678-1234-1234-1234-123456789abc',
          tls: true,
          network: 'tcp'
        }
      ],
      'proxy-groups': [
        {
          name: 'Proxy',
          type: 'select',
          proxies: ['DIRECT', '演示 VLESS 节点']
        }
      ],
      rules: ['MATCH,Proxy']
    };

    return c.text(JSON.stringify(clashConfig, null, 2), 200, {
      'Content-Type': 'application/yaml',
      'Content-Disposition': 'attachment; filename="sub-store-clash.yaml"',
      'Subscription-Userinfo': 'upload=0; download=0; total=2; expire=0',
    });
  }

  // 其他格式返回简单文本
  return c.text(`Sub-Store ${format} subscription\nNodes: 2\nGenerated: ${new Date().toISOString()}`, 200, {
    'Content-Type': 'text/plain',
    'Content-Disposition': `attachment; filename="sub-store-${format}.txt"`,
    'Subscription-Userinfo': 'upload=0; download=0; total=2; expire=0',
  });
    
});

// 获取订阅信息
subscriptionRouter.get('/:format/info', async (c) => {
  try {
    const format = c.req.param('format');

    const supportedFormats = ['v2ray', 'clash', 'shadowrocket'];
    if (!supportedFormats.includes(format)) {
      return c.json({
        success: false,
        error: 'Unsupported format',
        message: `Format '${format}' is not supported`,
      }, 400);
    }

    const enabledNodes = demoNodes.filter(node => node.enabled);

    // 统计节点类型
    const nodeStats = enabledNodes.reduce((stats, node) => {
      stats[node.type] = (stats[node.type] || 0) + 1;
      return stats;
    }, {} as Record<string, number>);

    return c.json({
      success: true,
      data: {
        format: {
          name: format,
          description: `${format} subscription format`,
          contentType: format === 'clash' ? 'application/yaml' : 'text/plain',
        },
        statistics: {
          totalNodes: demoNodes.length,
          enabledNodes: enabledNodes.length,
          nodeTypes: nodeStats,
        },
        lastUpdated: Date.now(),
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
    {
      format: 'v2ray',
      name: 'V2Ray',
      description: 'V2Ray subscription format (Base64 encoded)',
      contentType: 'text/plain',
      url: `${c.req.url}/v2ray`,
    },
    {
      format: 'clash',
      name: 'Clash',
      description: 'Clash configuration format',
      contentType: 'application/yaml',
      url: `${c.req.url}/clash`,
    },
    {
      format: 'shadowrocket',
      name: 'Shadowrocket',
      description: 'Shadowrocket subscription format',
      contentType: 'text/plain',
      url: `${c.req.url}/shadowrocket`,
    }
  ];

  return c.json({
    success: true,
    data: {
      formats,
      statistics: {
        totalNodes: demoNodes.length,
        enabledNodes: demoNodes.filter(n => n.enabled).length,
      },
      examples: {
        v2ray: `${c.req.url}/v2ray`,
        clash: `${c.req.url}/clash`,
        shadowrocket: `${c.req.url}/shadowrocket`,
      },
    },
  });
});

// 自定义订阅内容获取（需要与customSubscriptions.ts中的存储保持一致）
const customSubscriptions = new Map<string, {
  id: string;
  uuid: string;
  name: string;
  nodeIds: string[];
  format: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  accessCount: number;
  lastAccessAt?: string;
}>();

// 获取自定义订阅内容
subscriptionRouter.get('/custom/:uuid', async (c) => {
  try {
    const uuid = c.req.param('uuid');
    const subscription = customSubscriptions.get(uuid);

    if (!subscription) {
      return c.text('Custom subscription not found', 404);
    }

    // 检查是否过期
    if (subscription.expiresAt && new Date(subscription.expiresAt) < new Date()) {
      return c.text('Subscription expired', 410);
    }

    // 获取关联的节点
    const selectedNodes = demoNodes.filter(node =>
      subscription.nodeIds.includes(node.id) && node.enabled
    );

    if (selectedNodes.length === 0) {
      return c.text('No valid nodes found', 404);
    }

    // 更新访问统计
    subscription.accessCount++;
    subscription.lastAccessAt = new Date().toISOString();
    customSubscriptions.set(uuid, subscription);

    // 生成订阅内容
    const { content, contentType, filename } = generateCustomSubscriptionContent(
      selectedNodes,
      subscription.format
    );

    return c.text(content, 200, {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Subscription-Userinfo': `upload=0; download=0; total=${selectedNodes.length}; expire=${subscription.expiresAt ? Math.floor(new Date(subscription.expiresAt).getTime() / 1000) : 0}`,
      'Profile-Title': subscription.name,
      'Profile-Update-Interval': '24',
    });

  } catch (error) {
    console.error('Custom subscription error:', error);
    return c.text('Internal server error', 500);
  }
});
