import { Hono } from 'hono';
import type { Env } from '../types';

export const customSubscriptionsRouter = new Hono<{ Bindings: Env }>();

// 内存存储自定义订阅（生产环境应使用数据库）
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

// 获取实际的内存节点数据
const getMemoryNodes = async () => {
  try {
    const { memoryNodes } = await import('../data/memoryNodes');
    return memoryNodes;
  } catch (error) {
    console.error('Failed to load memory nodes:', error);
    return [];
  }
};

// 创建自定义订阅
customSubscriptionsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    
    // 验证请求数据
    if (!body.name || !body.nodeIds || !Array.isArray(body.nodeIds) || !body.format) {
      return c.json({
        success: false,
        error: 'Validation Error',
        message: 'Name, nodeIds (array), and format are required',
      }, 400);
    }

    // 验证节点ID
    const memoryNodes = await getMemoryNodes();
    const validNodeIds = body.nodeIds.filter((id: string) =>
      memoryNodes.some(node => node.id === id)
    );

    if (validNodeIds.length === 0) {
      return c.json({
        success: false,
        error: 'Validation Error',
        message: 'No valid node IDs provided',
      }, 400);
    }

    // 验证格式
    const supportedFormats = ['v2ray', 'clash', 'shadowrocket'];
    if (!supportedFormats.includes(body.format)) {
      return c.json({
        success: false,
        error: 'Validation Error',
        message: `Unsupported format: ${body.format}. Supported: ${supportedFormats.join(', ')}`,
      }, 400);
    }

    // 生成UUID和时间戳
    const uuid = crypto.randomUUID();
    const now = new Date().toISOString();
    
    const subscription = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      uuid,
      name: body.name,
      nodeIds: validNodeIds,
      format: body.format,
      expiresAt: body.expiresAt,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
    };

    // 存储订阅
    customSubscriptions.set(uuid, subscription);

    // 生成订阅URL
    const baseUrl = new URL(c.req.url).origin;
    const subscriptionUrl = `${baseUrl}/sub/custom/${uuid}`;

    return c.json({
      success: true,
      data: {
        subscription,
        url: subscriptionUrl,
      },
      message: 'Custom subscription created successfully',
    }, 201);

  } catch (error) {
    console.error('Failed to create custom subscription:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 获取自定义订阅列表
customSubscriptionsRouter.get('/', async (c) => {
  try {
    const subscriptions = Array.from(customSubscriptions.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({
      success: true,
      data: {
        subscriptions,
        total: subscriptions.length,
      },
    });

  } catch (error) {
    console.error('Failed to get custom subscriptions:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 获取单个自定义订阅信息
customSubscriptionsRouter.get('/:uuid', async (c) => {
  try {
    const uuid = c.req.param('uuid');
    const subscription = customSubscriptions.get(uuid);

    if (!subscription) {
      return c.json({
        success: false,
        error: 'Not found',
        message: `Custom subscription with UUID '${uuid}' not found`,
      }, 404);
    }

    // 获取关联的节点信息
    const memoryNodes = await getMemoryNodes();
    const nodes = memoryNodes.filter(node => subscription.nodeIds.includes(node.id));

    return c.json({
      success: true,
      data: {
        subscription,
        nodes,
        statistics: {
          totalNodes: nodes.length,
          enabledNodes: nodes.filter(n => n.enabled).length,
        },
      },
    });

  } catch (error) {
    console.error('Failed to get custom subscription:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 删除自定义订阅
customSubscriptionsRouter.delete('/:uuid', async (c) => {
  try {
    const uuid = c.req.param('uuid');
    const subscription = customSubscriptions.get(uuid);

    if (!subscription) {
      return c.json({
        success: false,
        error: 'Not found',
        message: `Custom subscription with UUID '${uuid}' not found`,
      }, 404);
    }

    customSubscriptions.delete(uuid);

    return c.json({
      success: true,
      data: { uuid },
      message: 'Custom subscription deleted successfully',
    });

  } catch (error) {
    console.error('Failed to delete custom subscription:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 生成自定义订阅内容的辅助函数
export const generateCustomSubscriptionContent = (
  nodes: any[],
  format: string
): { content: string; contentType: string; filename: string } => {
  switch (format) {
    case 'v2ray': {
      // 生成V2Ray Base64格式
      const configs = nodes.map(node => {
        if (node.type === 'vless') {
          return `vless://${node.uuid}@${node.server}:${node.port}?type=tcp&security=tls#${encodeURIComponent(node.name)}`;
        } else if (node.type === 'vmess') {
          return `vmess://${node.uuid}@${node.server}:${node.port}?type=tcp&security=tls#${encodeURIComponent(node.name)}`;
        }
        return '';
      }).filter(Boolean);
      
      const content = btoa(configs.join('\n'));
      return {
        content,
        contentType: 'text/plain',
        filename: 'custom-v2ray.txt'
      };
    }

    case 'clash': {
      // 生成Clash YAML格式
      const proxies = nodes.map(node => {
        if (node.type === 'vless') {
          return {
            name: node.name,
            type: 'vless',
            server: node.server,
            port: node.port,
            uuid: node.uuid,
            tls: true,
            network: 'tcp'
          };
        } else if (node.type === 'vmess') {
          return {
            name: node.name,
            type: 'vmess',
            server: node.server,
            port: node.port,
            uuid: node.uuid,
            alterId: 0,
            cipher: 'auto',
            tls: true,
            network: 'tcp'
          };
        }
        return null;
      }).filter(Boolean);

      const clashConfig = {
        port: 7890,
        'socks-port': 7891,
        'allow-lan': false,
        mode: 'rule',
        'log-level': 'info',
        'external-controller': '127.0.0.1:9090',
        proxies,
        'proxy-groups': [
          {
            name: '自定义节点组',
            type: 'select',
            proxies: proxies.map(p => p.name)
          }
        ],
        rules: [
          'MATCH,自定义节点组'
        ]
      };

      return {
        content: JSON.stringify(clashConfig, null, 2), // 简化为JSON，实际应该是YAML
        contentType: 'application/yaml',
        filename: 'custom-clash.yaml'
      };
    }

    case 'shadowrocket': {
      // 生成Shadowrocket格式
      const configs = nodes.map(node => {
        if (node.type === 'vless') {
          return `vless://${node.uuid}@${node.server}:${node.port}?remarks=${encodeURIComponent(node.name)}&obfsParam=${node.server}&path=/&obfs=none&tls=1&peer=${node.server}&allowInsecure=0`;
        } else if (node.type === 'vmess') {
          return `vmess://${node.uuid}@${node.server}:${node.port}?remarks=${encodeURIComponent(node.name)}&obfsParam=${node.server}&path=/&obfs=none&tls=1&peer=${node.server}&allowInsecure=0`;
        }
        return '';
      }).filter(Boolean);

      const content = btoa(configs.join('\n'));
      return {
        content,
        contentType: 'text/plain',
        filename: 'custom-shadowrocket.txt'
      };
    }

    default:
      return {
        content: `Unsupported format: ${format}`,
        contentType: 'text/plain',
        filename: 'error.txt'
      };
  }
};
