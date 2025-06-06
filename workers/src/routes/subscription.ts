import { Hono } from 'hono';
import { Env } from '../index';
import { generateCustomSubscriptionContent } from './customSubscriptions';
import { getCustomSubscription, updateSubscriptionAccess } from '../data/customSubscriptions';

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

// 获取订阅内容
subscriptionRouter.get('/:format', async (c) => {
  try {
    const format = c.req.param('format');

    // 验证格式
    const supportedFormats = ['v2ray', 'clash', 'shadowrocket'];
    if (!supportedFormats.includes(format)) {
      return c.text(`Unsupported format: ${format}. Supported: ${supportedFormats.join(', ')}`, 400);
    }

    // 获取所有启用的节点
    const memoryNodes = await getMemoryNodes();
    const enabledNodes = memoryNodes.filter(node => node.enabled);

    if (enabledNodes.length === 0) {
      return c.text('No enabled nodes found', 404);
    }

    // 生成订阅内容
    const { content, contentType, filename } = generateSubscriptionContent(enabledNodes, format);

    return c.text(content, 200, {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Subscription-Userinfo': `upload=0; download=0; total=${enabledNodes.length}; expire=0`,
      'Profile-Title': 'Sub-Store Subscription',
      'Profile-Update-Interval': '24',
    });

  } catch (error) {
    console.error('Subscription generation error:', error);
    return c.text('Internal server error', 500);
  }
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

    const memoryNodes = await getMemoryNodes();
    const enabledNodes = memoryNodes.filter(node => node.enabled);

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
          totalNodes: memoryNodes.length,
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

  // 获取实际节点数据用于统计
  const { memoryNodes } = await import('../data/memoryNodes');

  return c.json({
    success: true,
    data: {
      formats,
      statistics: {
        totalNodes: memoryNodes.length,
        enabledNodes: memoryNodes.filter(n => n.enabled).length,
      },
      examples: {
        v2ray: `${c.req.url}/v2ray`,
        clash: `${c.req.url}/clash`,
        shadowrocket: `${c.req.url}/shadowrocket`,
      },
    },
  });
});

// 获取自定义订阅内容
subscriptionRouter.get('/custom/:uuid', async (c) => {
  try {
    const uuid = c.req.param('uuid');
    console.log('Accessing custom subscription with UUID:', uuid);

    // 首先尝试从内存获取
    let subscription = getCustomSubscription(uuid);
    console.log('Found subscription in memory:', subscription ? 'YES' : 'NO');

    // 如果内存中没有，尝试从自定义订阅API获取
    if (!subscription) {
      try {
        console.log('Trying to fetch subscription from API...');
        const apiUrl = new URL(c.req.url);

        // 尝试多种认证方式
        const authHeaders = [
          c.req.header('Authorization'),
          `Admin ${c.env.ADMIN_TOKEN}`,
        ].filter(Boolean);

        for (const authHeader of authHeaders) {
          const apiResponse = await fetch(`${apiUrl.origin}/api/subscriptions/${uuid}`, {
            headers: { 'Authorization': authHeader }
          });

          if (apiResponse.ok) {
            const apiResult = await apiResponse.json();
            if (apiResult.success && apiResult.data.subscription) {
              subscription = apiResult.data.subscription;
              console.log('Found subscription via API with auth:', authHeader.substring(0, 20) + '...');
              break;
            }
          }
        }
      } catch (apiError) {
        console.log('API fetch failed:', apiError);
      }
    }

    if (!subscription) {
      // 添加调试信息
      const { getAllCustomSubscriptions } = await import('../data/customSubscriptions');
      const allSubscriptions = getAllCustomSubscriptions();
      console.log('Available subscriptions:', allSubscriptions.map(s => s.uuid));
      return c.text('Custom subscription not found', 404);
    }

    // 检查是否过期
    if (subscription.expiresAt && new Date(subscription.expiresAt) < new Date()) {
      return c.text('Subscription expired', 410);
    }

    // 获取关联的节点
    const { memoryNodes } = await import('../data/memoryNodes');
    const selectedNodes = memoryNodes.filter(node =>
      subscription.nodeIds.includes(node.id) && node.enabled
    );

    if (selectedNodes.length === 0) {
      return c.text('No valid nodes found', 404);
    }

    // 更新访问统计
    updateSubscriptionAccess(uuid);

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

// 获取编码的自定义订阅内容（无需持久化存储）
subscriptionRouter.get('/encoded/:data', async (c) => {
  try {
    const encodedData = c.req.param('data');
    console.log('Accessing encoded subscription with data length:', encodedData.length);

    // 解码订阅数据
    let subscriptionData;
    try {
      // 安全的Base64解码处理Unicode字符
      const decodedBytes = atob(encodedData);
      const bytes = new Uint8Array(decodedBytes.length);
      for (let i = 0; i < decodedBytes.length; i++) {
        bytes[i] = decodedBytes.charCodeAt(i);
      }
      const decoder = new TextDecoder();
      const decodedString = decoder.decode(bytes);
      subscriptionData = JSON.parse(decodedString);
      console.log('Decoded subscription data:', subscriptionData.name);
    } catch (decodeError) {
      console.error('Failed to decode subscription data:', decodeError);
      return c.text('Invalid subscription data', 400);
    }

    // 验证数据格式
    if (!subscriptionData.name || !subscriptionData.nodeIds || !subscriptionData.format) {
      return c.text('Invalid subscription format', 400);
    }

    // 检查是否过期
    if (subscriptionData.expiresAt && new Date(subscriptionData.expiresAt) < new Date()) {
      return c.text('Subscription expired', 410);
    }

    // 获取关联的节点
    const { memoryNodes } = await import('../data/memoryNodes');
    const selectedNodes = memoryNodes.filter(node =>
      subscriptionData.nodeIds.includes(node.id) && node.enabled
    );

    if (selectedNodes.length === 0) {
      return c.text('No valid nodes found', 404);
    }

    // 生成订阅内容
    const { content, contentType, filename } = generateCustomSubscriptionContent(
      selectedNodes,
      subscriptionData.format
    );

    return c.text(content, 200, {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Subscription-Userinfo': `upload=0; download=0; total=${selectedNodes.length}; expire=${subscriptionData.expiresAt ? Math.floor(new Date(subscriptionData.expiresAt).getTime() / 1000) : 0}`,
      'Profile-Title': subscriptionData.name,
      'Profile-Update-Interval': '24',
    });

  } catch (error) {
    console.error('Encoded subscription error:', error);
    return c.text('Internal server error', 500);
  }
});

// 生成标准订阅内容的函数
function generateSubscriptionContent(
  nodes: SimpleNode[],
  format: string
): { content: string; contentType: string; filename: string } {
  switch (format) {
    case 'v2ray':
      return generateV2raySubscription(nodes);
    case 'clash':
      return generateClashSubscription(nodes);
    case 'shadowrocket':
      return generateShadowrocketSubscription(nodes);
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

// 生成V2Ray订阅内容
function generateV2raySubscription(nodes: SimpleNode[]): { content: string; contentType: string; filename: string } {
  const links = nodes.map(node => convertNodeToV2rayLink(node)).filter(Boolean);
  const content = btoa(links.join('\n'));

  return {
    content,
    contentType: 'text/plain',
    filename: 'sub-store-v2ray.txt'
  };
}

// 生成Clash订阅内容
function generateClashSubscription(nodes: SimpleNode[]): { content: string; contentType: string; filename: string } {
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
        name: '🚀 节点选择',
        type: 'select',
        proxies: ['DIRECT', ...proxyNames]
      },
      {
        name: '🎯 全球直连',
        type: 'select',
        proxies: ['DIRECT', '🚀 节点选择']
      },
      {
        name: '🛑 广告拦截',
        type: 'select',
        proxies: ['REJECT', 'DIRECT']
      }
    ],
    rules: [
      'DOMAIN-SUFFIX,cn,🎯 全球直连',
      'GEOIP,CN,🎯 全球直连',
      'MATCH,🚀 节点选择'
    ]
  };

  // 转换为YAML格式
  const yamlContent = convertToYaml(clashConfig);

  return {
    content: yamlContent,
    contentType: 'application/yaml',
    filename: 'sub-store-clash.yaml'
  };
}

// 生成Shadowrocket订阅内容
function generateShadowrocketSubscription(nodes: SimpleNode[]): { content: string; contentType: string; filename: string } {
  const links = nodes.map(node => convertNodeToShadowrocketLink(node)).filter(Boolean);
  const content = btoa(links.join('\n'));

  return {
    content,
    contentType: 'text/plain',
    filename: 'sub-store-shadowrocket.txt'
  };
}

// 将节点转换为V2Ray链接
function convertNodeToV2rayLink(node: SimpleNode): string {
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
function convertNodeToClashProxy(node: SimpleNode): any {
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
function convertNodeToShadowrocketLink(node: SimpleNode): string {
  // Shadowrocket支持多种格式，这里使用与V2Ray相同的格式
  return convertNodeToV2rayLink(node);
}

// 生成VLESS链接
function generateVlessLink(node: SimpleNode): string {
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
function generateVmessLink(node: SimpleNode): string {
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
function generateTrojanLink(node: SimpleNode): string {
  const params = new URLSearchParams();
  params.set('type', node.network || 'tcp');

  if (node.sni) params.set('sni', node.sni);
  if (node.wsPath) params.set('path', node.wsPath);

  const paramString = params.toString();
  const fragment = encodeURIComponent(node.name);

  return `trojan://${node.password}@${node.server}:${node.port}?${paramString}#${fragment}`;
}

// 生成Shadowsocks链接
function generateShadowsocksLink(node: SimpleNode): string {
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
