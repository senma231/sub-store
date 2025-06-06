import { Hono } from 'hono';
import type { Env } from '../types';
import {
  customSubscriptions,
  setCustomSubscription,
  getCustomSubscription,
  deleteCustomSubscription,
  getAllCustomSubscriptions,
  type CustomSubscriptionData
} from '../data/customSubscriptions';

export const customSubscriptionsRouter = new Hono<{ Bindings: Env }>();

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
    setCustomSubscription(uuid, subscription);

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
    console.log('Getting custom subscriptions list');
    const subscriptions = getAllCustomSubscriptions()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log('Found subscriptions:', subscriptions.length);

    // 确保返回的数据格式与前端期望的一致
    return c.json({
      success: true,
      data: subscriptions, // 直接返回数组，而不是包装在对象中
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
    const subscription = getCustomSubscription(uuid);

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
    const subscription = getCustomSubscription(uuid);

    if (!subscription) {
      return c.json({
        success: false,
        error: 'Not found',
        message: `Custom subscription with UUID '${uuid}' not found`,
      }, 404);
    }

    deleteCustomSubscription(uuid);

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
      const links = nodes.map(node => convertNodeToV2rayLink(node)).filter(Boolean);
      const content = btoa(links.join('\n'));

      return {
        content,
        contentType: 'text/plain',
        filename: 'custom-v2ray.txt'
      };
    }

    case 'clash': {
      // 生成Clash YAML格式
      const proxies = nodes.map(node => convertNodeToClashProxy(node)).filter(Boolean);
      const proxyNames = proxies.map(proxy => proxy.name);

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
            name: '🚀 自定义节点组',
            type: 'select',
            proxies: ['DIRECT', ...proxyNames]
          }
        ],
        rules: [
          'DOMAIN-SUFFIX,cn,DIRECT',
          'GEOIP,CN,DIRECT',
          'MATCH,🚀 自定义节点组'
        ]
      };

      // 转换为YAML格式
      const yamlContent = convertToYaml(clashConfig);

      return {
        content: yamlContent,
        contentType: 'application/yaml',
        filename: 'custom-clash.yaml'
      };
    }

    case 'shadowrocket': {
      // 生成Shadowrocket格式
      const links = nodes.map(node => convertNodeToShadowrocketLink(node)).filter(Boolean);
      const content = btoa(links.join('\n'));

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

// 将节点转换为V2Ray链接
function convertNodeToV2rayLink(node: any): string {
  switch (node.type) {
    case 'vless':
      return generateVlessLink(node);
    case 'vmess':
      return generateVmessLink(node);
    case 'trojan':
      return generateTrojanLink(node);
    case 'ss':
      return generateShadowsocksLink(node);
    default:
      console.warn(`Unsupported node type for V2Ray: ${node.type}`);
      return '';
  }
}

// 将节点转换为Clash代理配置
function convertNodeToClashProxy(node: any): any {
  const base = {
    name: node.name,
    server: node.server,
    port: node.port,
  };

  switch (node.type) {
    case 'vless':
      return {
        ...base,
        type: 'vless',
        uuid: node.uuid,
        tls: node.tls || false,
        network: node.network || 'tcp',
        'skip-cert-verify': true,
        ...(node.sni && { servername: node.sni }),
        ...(node.wsPath && { 'ws-opts': { path: node.wsPath } }),
      };
    case 'vmess':
      return {
        ...base,
        type: 'vmess',
        uuid: node.uuid,
        alterId: node.alterId || 0,
        cipher: node.security || 'auto',
        tls: node.tls || false,
        network: node.network || 'tcp',
        'skip-cert-verify': true,
        ...(node.sni && { servername: node.sni }),
        ...(node.wsPath && { 'ws-opts': { path: node.wsPath } }),
      };
    case 'trojan':
      return {
        ...base,
        type: 'trojan',
        password: node.password,
        'skip-cert-verify': true,
        ...(node.sni && { sni: node.sni }),
      };
    case 'ss':
      return {
        ...base,
        type: 'ss',
        cipher: node.method,
        password: node.password,
      };
    default:
      console.warn(`Unsupported node type for Clash: ${node.type}`);
      return null;
  }
}

// 将节点转换为Shadowrocket链接
function convertNodeToShadowrocketLink(node: any): string {
  return convertNodeToV2rayLink(node);
}

// 生成VLESS链接
function generateVlessLink(node: any): string {
  const params = new URLSearchParams();
  params.set('type', node.network || 'tcp');
  params.set('security', node.tls ? 'tls' : 'none');

  if (node.sni) params.set('sni', node.sni);
  if (node.wsPath) params.set('path', node.wsPath);
  if (node.flow) params.set('flow', node.flow);

  const paramString = params.toString();
  const fragment = encodeURIComponent(node.name);

  return `vless://${node.uuid}@${node.server}:${node.port}?${paramString}#${fragment}`;
}

// 生成VMess链接
function generateVmessLink(node: any): string {
  const vmessConfig = {
    v: '2',
    ps: node.name,
    add: node.server,
    port: node.port.toString(),
    id: node.uuid,
    aid: (node.alterId || 0).toString(),
    scy: node.security || 'auto',
    net: node.network || 'tcp',
    type: 'none',
    host: node.sni || '',
    path: node.wsPath || '',
    tls: node.tls ? 'tls' : '',
    sni: node.sni || '',
  };

  return `vmess://${btoa(JSON.stringify(vmessConfig))}`;
}

// 生成Trojan链接
function generateTrojanLink(node: any): string {
  const params = new URLSearchParams();
  params.set('type', node.network || 'tcp');

  if (node.sni) params.set('sni', node.sni);
  if (node.wsPath) params.set('path', node.wsPath);

  const paramString = params.toString();
  const fragment = encodeURIComponent(node.name);

  return `trojan://${node.password}@${node.server}:${node.port}?${paramString}#${fragment}`;
}

// 生成Shadowsocks链接
function generateShadowsocksLink(node: any): string {
  const userInfo = btoa(`${node.method}:${node.password}`);
  const fragment = encodeURIComponent(node.name);

  return `ss://${userInfo}@${node.server}:${node.port}#${fragment}`;
}

// 简单的YAML转换函数
function convertToYaml(obj: any, indent = 0): string {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      for (const item of value) {
        if (typeof item === 'object') {
          yaml += `${spaces}  - `;
          const itemYaml = convertToYaml(item, indent + 2);
          yaml += itemYaml.substring(spaces.length + 4) + '\n';
        } else {
          yaml += `${spaces}  - ${item}\n`;
        }
      }
    } else if (typeof value === 'object') {
      yaml += `${spaces}${key}:\n`;
      yaml += convertToYaml(value, indent + 1);
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }

  return yaml;
}
