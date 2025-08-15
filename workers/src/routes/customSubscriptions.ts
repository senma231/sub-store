import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { CustomSubscriptionsRepository } from '../database/customSubscriptions';
import { NodesRepository } from '../database/nodes';
import { safeBase64Encode } from '../utils/helpers';
import {
  encryptNodeContent,
  obfuscateNodeConfig,
  generateDecoyNodes
} from '../utils/subscriptionSecurity';

export const customSubscriptionsRouter = new Hono<{ Bindings: Env }>();

// 临时禁用认证中间件以解决登录问题
// TODO: 修复登录问题后重新启用认证
// customSubscriptionsRouter.use('*', authMiddleware);

// 获取数据库中的节点数据
const getNodesFromDatabase = async (nodesRepo: NodesRepository, nodeIds?: string[]) => {
  try {
    if (nodeIds && nodeIds.length > 0) {
      // 获取指定的节点
      const nodes = [];
      for (const nodeId of nodeIds) {
        const result = await nodesRepo.getNodeById(nodeId);
        if (result.success && result.data) {
          nodes.push(result.data);
        }
      }
      return nodes;
    } else {
      // 获取所有启用的节点
      const result = await nodesRepo.getNodes(1, 1000, { enabled: true });
      return result.data || [];
    }
  } catch (error) {
    console.error('Failed to load nodes from database:', error);
    return [];
  }
};

// 创建自定义订阅
customSubscriptionsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const nodesRepo = c.get('nodesRepo') as NodesRepository;
    const customSubsRepo = c.get('customSubsRepo') as CustomSubscriptionsRepository;

    // 验证请求数据
    if (!body.name || !body.nodeIds || !Array.isArray(body.nodeIds) || !body.format) {
      return c.json({
        success: false,
        error: 'Validation Error',
        message: 'Name, nodeIds (array), and format are required',
      }, 400);
    }

    // 验证节点ID
    const validNodeIds = [];
    for (const nodeId of body.nodeIds) {
      const result = await nodesRepo.getNodeById(nodeId);
      if (result.success && result.data && result.data.enabled) {
        validNodeIds.push(nodeId);
      }
    }

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

    // 生成UUID
    const uuid = crypto.randomUUID();

    const subscriptionData = {
      uuid,
      name: body.name,
      nodeIds: validNodeIds,
      format: body.format,
      expiresAt: body.expiresAt || null,
    };

    // 存储到数据库
    const result = await customSubsRepo.create(subscriptionData);

    if (!result.success) {
      return c.json({
        success: false,
        error: 'Database error',
        message: result.error,
      }, 500);
    }

    const subscription = result.data;

    // 生成订阅URL（包含备用的编码URL）
    const baseUrl = new URL(c.req.url).origin;
    const subscriptionUrl = `${baseUrl}/sub/custom/${uuid}`;

    // 创建备用的编码URL，包含订阅数据
    // 使用安全的Base64编码处理Unicode字符
    const subscriptionDataString = JSON.stringify({
      name: subscription.name,
      nodeIds: subscription.nodeIds,
      format: subscription.format,
      expiresAt: subscription.expiresAt,
    });

    // 将字符串转换为UTF-8字节，然后进行Base64编码
    const encoder = new TextEncoder();
    const bytes = encoder.encode(subscriptionDataString);
    const encodedData = safeBase64Encode(subscriptionDataString);
    const encodedUrl = `${baseUrl}/sub/encoded/${encodedData}`;

    return c.json({
      success: true,
      data: {
        subscription,
        url: subscriptionUrl,
        encodedUrl, // 备用URL，包含完整数据
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
    const db = c.get('db');
    const customSubsRepo = new CustomSubscriptionsRepository(db);

    const result = await customSubsRepo.getAll();

    if (!result.success) {
      return c.json({
        success: false,
        error: 'Database error',
        message: result.error,
      }, 500);
    }

    const subscriptions = result.data || [];
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
    const db = c.get('db');
    const customSubsRepo = new CustomSubscriptionsRepository(db);
    const nodesRepo = c.get('nodesRepo') as NodesRepository;

    const result = await customSubsRepo.getByUuid(uuid);

    if (!result.success) {
      return c.json({
        success: false,
        error: 'Database error',
        message: result.error,
      }, 500);
    }

    if (!result.data) {
      return c.json({
        success: false,
        error: 'Not found',
        message: `Custom subscription with UUID '${uuid}' not found`,
      }, 404);
    }

    const subscription = result.data;

    // 获取关联的节点信息
    const nodes = await getNodesFromDatabase(nodesRepo, subscription.nodeIds);

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
    const db = c.get('db');
    const customSubsRepo = new CustomSubscriptionsRepository(db);

    // 首先检查订阅是否存在
    const existingResult = await customSubsRepo.getByUuid(uuid);
    if (!existingResult.success) {
      return c.json({
        success: false,
        error: 'Database error',
        message: existingResult.error,
      }, 500);
    }

    if (!existingResult.data) {
      return c.json({
        success: false,
        error: 'Not found',
        message: `Custom subscription with UUID '${uuid}' not found`,
      }, 404);
    }

    // 删除订阅
    const result = await customSubsRepo.delete(uuid);

    if (!result.success) {
      return c.json({
        success: false,
        error: 'Database error',
        message: result.error,
      }, 500);
    }

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
  format: string,
  options: { encrypt?: boolean; secret?: string; addDecoys?: boolean } = {}
): { content: string; contentType: string; filename: string } => {
  switch (format) {
    case 'v2ray': {
      // 生成V2Ray Base64格式
      let links = nodes.map(node => convertNodeToV2rayLink(node)).filter(Boolean);

      // 添加诱饵节点（迷惑爬虫）
      if (options.addDecoys) {
        const decoyNodes = generateDecoyNodes(2);
        links = [...decoyNodes, ...links, ...generateDecoyNodes(1)];
      }

      let rawContent = links.join('\n');

      // 混淆处理
      rawContent = obfuscateNodeConfig(rawContent);

      // 加密处理
      if (options.encrypt && options.secret) {
        rawContent = encryptNodeContent(rawContent, options.secret);
      }

      const content = safeBase64Encode(rawContent);

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
      const content = safeBase64Encode(links.join('\n'));

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

  return `vmess://${safeBase64Encode(JSON.stringify(vmessConfig))}`;
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
  const userInfo = safeBase64Encode(`${node.method}:${node.password}`);
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

// 更新自定义订阅
customSubscriptionsRouter.put('/:uuid', async (c) => {
  try {
    const uuid = c.req.param('uuid');
    const body = await c.req.json();
    const nodesRepo = c.get('nodesRepo') as NodesRepository;
    const customSubsRepo = c.get('customSubsRepo') as CustomSubscriptionsRepository;

    // 验证订阅是否存在
    const existingResult = await customSubsRepo.getByUuid(uuid);
    if (!existingResult.success || !existingResult.data) {
      return c.json({
        success: false,
        error: 'Not Found',
        message: 'Custom subscription not found',
      }, 404);
    }

    // 验证请求数据
    const updates: any = {};

    if (body.name !== undefined) {
      if (!body.name || typeof body.name !== 'string') {
        return c.json({
          success: false,
          error: 'Validation Error',
          message: 'Name must be a non-empty string',
        }, 400);
      }
      updates.name = body.name;
    }

    if (body.nodeIds !== undefined) {
      if (!Array.isArray(body.nodeIds)) {
        return c.json({
          success: false,
          error: 'Validation Error',
          message: 'NodeIds must be an array',
        }, 400);
      }

      // 验证节点ID
      const validNodeIds = [];
      for (const nodeId of body.nodeIds) {
        const result = await nodesRepo.getNodeById(nodeId);
        if (result.success && result.data && result.data.enabled) {
          validNodeIds.push(nodeId);
        }
      }

      if (validNodeIds.length === 0) {
        return c.json({
          success: false,
          error: 'Validation Error',
          message: 'No valid node IDs provided',
        }, 400);
      }

      updates.nodeIds = validNodeIds;
    }

    if (body.format !== undefined) {
      const supportedFormats = ['v2ray', 'clash', 'shadowrocket'];
      if (!supportedFormats.includes(body.format)) {
        return c.json({
          success: false,
          error: 'Validation Error',
          message: `Unsupported format: ${body.format}. Supported: ${supportedFormats.join(', ')}`,
        }, 400);
      }
      updates.format = body.format;
    }

    if (body.expiresAt !== undefined) {
      updates.expiresAt = body.expiresAt || null;
    }

    // 更新订阅
    const result = await customSubsRepo.update(uuid, updates);

    if (!result.success) {
      return c.json({
        success: false,
        error: 'Database error',
        message: result.error,
      }, 500);
    }

    const subscription = result.data;

    return c.json({
      success: true,
      data: {
        subscription,
        message: 'Custom subscription updated successfully',
      },
    });

  } catch (error) {
    console.error('Update custom subscription error:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update custom subscription',
    }, 500);
  }
});
