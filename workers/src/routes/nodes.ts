import { Hono } from 'hono';
import { Env } from '../index';

// 简化的节点类型定义
interface SimpleNode {
  id: string;
  name: string;
  type: 'vless' | 'vmess' | 'trojan' | 'ss' | 'socks5' | 'hy2' | 'hy';
  server: string;
  port: number;
  enabled: boolean;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  // 协议特定字段
  uuid?: string;
  password?: string;
  method?: string;
  [key: string]: any;
}

export const nodesRouter = new Hono<{ Bindings: Env }>();

// 内存存储（演示用）
let memoryNodes: SimpleNode[] = [
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

// 获取所有节点
nodesRouter.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const search = c.req.query('search') || '';
    const type = c.req.query('type') || '';
    const enabled = c.req.query('enabled');

    // 使用内存存储
    let nodes: SimpleNode[] = [...memoryNodes];
    
    // 过滤节点
    if (search) {
      const searchLower = search.toLowerCase();
      nodes = nodes.filter(node => 
        node.name.toLowerCase().includes(searchLower) ||
        node.server.toLowerCase().includes(searchLower) ||
        (node.remark && node.remark.toLowerCase().includes(searchLower))
      );
    }
    
    if (type) {
      nodes = nodes.filter(node => node.type === type);
    }
    
    if (enabled !== undefined) {
      const isEnabled = enabled === 'true';
      nodes = nodes.filter(node => node.enabled === isEnabled);
    }
    
    // 分页
    const total = nodes.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedNodes = nodes.slice(startIndex, endIndex);
    
    return c.json({
      success: true,
      data: {
        items: paginatedNodes,
        total,
        page,
        limit,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Failed to get nodes:', error);
    return c.json({
      success: false,
      error: 'Failed to get nodes',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 获取单个节点
nodesRouter.get('/:id', async (c) => {
  try {
    const nodeId = c.req.param('id');

    const node = memoryNodes.find(n => n.id === nodeId);

    if (!node) {
      return c.json({
        success: false,
        error: 'Node not found',
        message: `Node with id '${nodeId}' does not exist`,
      }, 404);
    }

    return c.json({
      success: true,
      data: node,
    });
  } catch (error) {
    console.error('Failed to get node:', error);
    return c.json({
      success: false,
      error: 'Failed to get node',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 创建新节点
nodesRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();

    // 基础验证
    if (!body.name || !body.type || !body.server || !body.port) {
      return c.json({
        success: false,
        error: 'Validation Error',
        message: 'Name, type, server, and port are required',
      }, 400);
    }

    // 生成节点 ID 和时间戳
    const now = new Date().toISOString();
    const node: SimpleNode = {
      ...body,
      id: body.id || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      enabled: body.enabled !== undefined ? body.enabled : true,
      createdAt: now,
      updatedAt: now,
    };

    // 检查 ID 是否已存在
    if (memoryNodes.some(n => n.id === node.id)) {
      return c.json({
        success: false,
        error: 'Conflict',
        message: `Node with id '${node.id}' already exists`,
      }, 409);
    }

    // 检查名称是否已存在
    if (memoryNodes.some(n => n.name === node.name)) {
      return c.json({
        success: false,
        error: 'Conflict',
        message: `Node with name '${node.name}' already exists`,
      }, 409);
    }

    // 添加新节点
    memoryNodes.push(node);

    return c.json({
      success: true,
      data: node,
      message: 'Node created successfully',
    }, 201);
  } catch (error) {
    console.error('Failed to create node:', error);
    return c.json({
      success: false,
      error: 'Failed to create node',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 更新节点
nodesRouter.put('/:id', async (c) => {
  try {
    const nodeId = c.req.param('id');
    const body = await c.req.json();

    const nodeIndex = memoryNodes.findIndex(n => n.id === nodeId);

    if (nodeIndex === -1) {
      return c.json({
        success: false,
        error: 'Node not found',
        message: `Node with id '${nodeId}' does not exist`,
      }, 404);
    }

    // 更新节点
    const updatedNode = {
      ...memoryNodes[nodeIndex],
      ...body,
      id: nodeId, // 确保ID不被修改
      updatedAt: new Date().toISOString(),
    };

    memoryNodes[nodeIndex] = updatedNode;

    return c.json({
      success: true,
      data: updatedNode,
      message: 'Node updated successfully',
    });

  } catch (error) {
    console.error('Failed to update node:', error);
    return c.json({
      success: false,
      error: 'Failed to update node',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 删除节点
nodesRouter.delete('/:id', async (c) => {
  try {
    const nodeId = c.req.param('id');

    const nodeIndex = memoryNodes.findIndex(n => n.id === nodeId);

    if (nodeIndex === -1) {
      return c.json({
        success: false,
        error: 'Node not found',
        message: `Node with id '${nodeId}' does not exist`,
      }, 404);
    }

    // 删除节点
    const deletedNode = memoryNodes.splice(nodeIndex, 1)[0];

    return c.json({
      success: true,
      data: deletedNode,
      message: 'Node deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete node:', error);
    return c.json({
      success: false,
      error: 'Failed to delete node',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 批量操作
nodesRouter.post('/batch', async (c) => {
  try {
    const body = await c.req.json();
    const { action, nodeIds } = body;

    if (!action || !nodeIds || !Array.isArray(nodeIds)) {
      return c.json({
        success: false,
        error: 'Invalid request',
        message: 'Action and nodeIds array are required',
      }, 400);
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      affectedNodes: [] as any[],
    };

    for (const nodeId of nodeIds) {
      try {
        const nodeIndex = memoryNodes.findIndex(n => n.id === nodeId);

        if (nodeIndex === -1) {
          results.failed++;
          results.errors.push(`Node ${nodeId} not found`);
          continue;
        }

        switch (action) {
          case 'enable':
            memoryNodes[nodeIndex].enabled = true;
            memoryNodes[nodeIndex].updatedAt = new Date().toISOString();
            results.affectedNodes.push(memoryNodes[nodeIndex]);
            results.success++;
            break;
          case 'disable':
            memoryNodes[nodeIndex].enabled = false;
            memoryNodes[nodeIndex].updatedAt = new Date().toISOString();
            results.affectedNodes.push(memoryNodes[nodeIndex]);
            results.success++;
            break;
          case 'delete':
            const deletedNode = memoryNodes.splice(nodeIndex, 1)[0];
            results.affectedNodes.push(deletedNode);
            results.success++;
            break;
          default:
            results.failed++;
            results.errors.push(`Unknown action: ${action}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to process node ${nodeId}: ${error}`);
      }
    }

    return c.json({
      success: true,
      data: {
        action,
        affectedCount: results.success,
        affectedNodes: results.affectedNodes,
        failed: results.failed,
        errors: results.errors,
      },
      message: `Batch operation completed: ${results.success} success, ${results.failed} failed`,
    });

  } catch (error) {
    console.error('Failed to perform batch operation:', error);
    return c.json({
      success: false,
      error: 'Failed to perform batch operation',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 导出节点
nodesRouter.get('/export', async (c) => {
  try {
    const format = c.req.query('format') || 'json';
    const nodeIds = c.req.query('nodeIds')?.split(',');

    // 获取要导出的节点
    let nodesToExport = memoryNodes;
    if (nodeIds && nodeIds.length > 0) {
      nodesToExport = memoryNodes.filter(node => nodeIds.includes(node.id));
    }

    if (format === 'json') {
      // JSON 格式导出
      const exportData = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        totalNodes: nodesToExport.length,
        nodes: nodesToExport,
      };

      return c.json(exportData, 200, {
        'Content-Disposition': 'attachment; filename="nodes.json"',
        'Content-Type': 'application/json',
      });
    } else if (format === 'csv') {
      // CSV 格式导出
      const csvHeaders = ['id', 'name', 'type', 'server', 'port', 'enabled', 'uuid', 'password', 'remark', 'createdAt'];
      const csvRows = [csvHeaders.join(',')];

      nodesToExport.forEach(node => {
        const row = csvHeaders.map(header => {
          const value = (node as any)[header] || '';
          // 处理包含逗号的值
          return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
        });
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');

      return c.text(csvContent, 200, {
        'Content-Disposition': 'attachment; filename="nodes.csv"',
        'Content-Type': 'text/csv',
      });
    } else {
      return c.json({
        success: false,
        error: 'Invalid format',
        message: 'Supported formats: json, csv',
      }, 400);
    }

  } catch (error) {
    console.error('Failed to export nodes:', error);
    return c.json({
      success: false,
      error: 'Failed to export nodes',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 导入节点
nodesRouter.post('/import', async (c) => {
  try {
    const body = await c.req.json();
    const { nodes } = body;

    if (!nodes || !Array.isArray(nodes)) {
      return c.json({
        success: false,
        error: 'Invalid request',
        message: 'Nodes array is required',
      }, 400);
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      importedNodes: [] as any[],
    };

    for (const nodeData of nodes) {
      try {
        // 基础验证
        if (!nodeData.name || !nodeData.type || !nodeData.server || !nodeData.port) {
          results.failed++;
          results.errors.push(`Invalid node data: missing required fields (name, type, server, port)`);
          continue;
        }

        // 生成新的节点 ID 和时间戳
        const now = new Date().toISOString();
        const node = {
          ...nodeData,
          id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          enabled: nodeData.enabled !== undefined ? nodeData.enabled : true,
          createdAt: now,
          updatedAt: now,
        };

        // 检查是否已存在相同的节点（基于 server:port）
        const existingNode = memoryNodes.find(n =>
          n.server === node.server && n.port === node.port && n.type === node.type
        );

        if (existingNode) {
          results.failed++;
          results.errors.push(`Node ${node.server}:${node.port} (${node.type}) already exists`);
          continue;
        }

        memoryNodes.push(node);
        results.importedNodes.push(node);
        results.success++;

      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to import node: ${error}`);
      }
    }

    return c.json({
      success: true,
      data: {
        success: results.success,
        failed: results.failed,
        errors: results.errors,
        importedNodes: results.importedNodes,
      },
      message: `Import completed: ${results.success} success, ${results.failed} failed`,
    });

  } catch (error) {
    console.error('Failed to import nodes:', error);
    return c.json({
      success: false,
      error: 'Failed to import nodes',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 解析节点链接
nodesRouter.post('/parse', async (c) => {
  try {
    const body = await c.req.json();
    const { links } = body;

    if (!links || !Array.isArray(links)) {
      return c.json({
        success: false,
        error: 'Invalid request',
        message: 'Links array is required',
      }, 400);
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      parsedNodes: [] as any[],
    };

    for (const link of links) {
      try {
        const node = parseNodeLink(link);
        results.parsedNodes.push(node);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push(`Failed to parse link: ${error}`);
      }
    }

    return c.json({
      success: true,
      data: {
        success: results.success,
        failed: results.failed,
        errors: results.errors,
        parsedNodes: results.parsedNodes,
      },
      message: `Parse completed: ${results.success} success, ${results.failed} failed`,
    });

  } catch (error) {
    console.error('Failed to parse node links:', error);
    return c.json({
      success: false,
      error: 'Failed to parse node links',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 解析单个节点链接的辅助函数
function parseNodeLink(link: string): any {
  const trimmedLink = link.trim();

  if (trimmedLink.startsWith('vless://')) {
    return parseVlessLink(trimmedLink);
  } else if (trimmedLink.startsWith('vmess://')) {
    return parseVmessLink(trimmedLink);
  } else if (trimmedLink.startsWith('trojan://')) {
    return parseTrojanLink(trimmedLink);
  } else if (trimmedLink.startsWith('ss://')) {
    return parseSsLink(trimmedLink);
  } else {
    throw new Error('Unsupported link format');
  }
}

function parseVlessLink(link: string): any {
  const url = new URL(link);
  const uuid = url.username;
  const server = url.hostname;
  const port = parseInt(url.port) || 443;
  const params = new URLSearchParams(url.search);

  return {
    name: decodeURIComponent(url.hash.slice(1)) || `VLESS-${server}`,
    type: 'vless',
    server,
    port,
    uuid,
    encryption: params.get('encryption') || 'none',
    flow: params.get('flow') || undefined,
    network: params.get('type') || 'tcp',
    tls: params.get('security') === 'tls',
    sni: params.get('sni') || undefined,
    wsPath: params.get('path') || undefined,
    enabled: true,
  };
}

function parseVmessLink(link: string): any {
  const base64Data = link.replace('vmess://', '');
  const jsonStr = atob(base64Data);
  const config = JSON.parse(jsonStr);

  return {
    name: config.ps || `VMess-${config.add}`,
    type: 'vmess',
    server: config.add,
    port: parseInt(config.port),
    uuid: config.id,
    alterId: parseInt(config.aid) || 0,
    security: config.scy || 'auto',
    network: config.net || 'tcp',
    tls: config.tls === 'tls',
    sni: config.sni || undefined,
    wsPath: config.path || undefined,
    enabled: true,
  };
}

function parseTrojanLink(link: string): any {
  const url = new URL(link);
  const password = url.username;
  const server = url.hostname;
  const port = parseInt(url.port) || 443;
  const params = new URLSearchParams(url.search);

  return {
    name: decodeURIComponent(url.hash.slice(1)) || `Trojan-${server}`,
    type: 'trojan',
    server,
    port,
    password,
    sni: params.get('sni') || undefined,
    network: params.get('type') || 'tcp',
    tls: true,
    enabled: true,
  };
}

function parseSsLink(link: string): any {
  const url = new URL(link);
  const userInfo = atob(url.username);
  const [method, password] = userInfo.split(':');
  const server = url.hostname;
  const port = parseInt(url.port);

  return {
    name: decodeURIComponent(url.hash.slice(1)) || `SS-${server}`,
    type: 'ss',
    server,
    port,
    method,
    password,
    enabled: true,
  };
}
