import { Hono } from 'hono';
import { Env, SimpleNode } from '../types';
import { authMiddleware } from '../middleware/auth';
import { NodesRepository } from '../database/nodes';
import { Database } from '../database';

export const nodesRouter = new Hono<{ Bindings: Env }>();

// 临时禁用认证中间件以解决登录问题
// TODO: 修复登录问题后重新启用认证
// nodesRouter.use('*', authMiddleware);



// 获取所有节点
nodesRouter.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const search = c.req.query('search') || '';
    const type = c.req.query('type') || '';
    const enabled = c.req.query('enabled');

    const nodesRepo = c.get('nodesRepo');

    let nodes: any[] = [];
    let total = 0;

    if (nodesRepo) {
      // 尝试使用数据库存储
      const params: any = {
        page,
        limit,
      };

      if (search) {
        params.search = search;
      }
      if (type) {
        params.type = type;
      }
      if (enabled !== undefined) {
        params.enabled = enabled === 'true';
      }

      const result = await nodesRepo.getNodes(params);

      if (!result.success) {
        console.error('Failed to get nodes from database:', result.error);
        return c.json({
          success: false,
          error: 'Database error',
          message: result.error,
        }, 500);
      }

      const paginatedData = result.data;
      nodes = paginatedData?.items || [];
      total = paginatedData?.total || 0;
    } else {
      return c.json({
        success: false,
        error: 'Database not available',
        message: 'Database connection is required',
      }, 500);
    }

    const totalPages = Math.ceil(total / limit);

    return c.json({
      success: true,
      data: {
        items: nodes,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
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

// 导出节点 (必须在 /:id 路由之前定义)
nodesRouter.get('/export', async (c) => {
  try {
    console.log('Export request received');
    const format = c.req.query('format') || 'json';
    const nodeIds = c.req.query('nodeIds')?.split(',');

    console.log('Export format:', format);
    console.log('Node IDs:', nodeIds);

    // 获取要导出的节点
    const nodesRepo = c.get('nodesRepo') as NodesRepository;

    let nodesToExport: any[] = [];
    if (nodeIds && nodeIds.length > 0) {
      // 获取指定的节点
      for (const nodeId of nodeIds) {
        const result = await nodesRepo.getNodeById(nodeId);
        if (result.success && result.data) {
          nodesToExport.push(result.data);
        }
      }
    } else {
      // 获取所有节点
      const result = await nodesRepo.getNodes({ page: 1, limit: 1000 });
      if (result.success && result.data) {
        nodesToExport = result.data.items || [];
      }
    }

    console.log('Nodes to export:', nodesToExport.length);

    if (format === 'json') {
      // JSON 格式导出
      const exportData = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        totalNodes: nodesToExport.length,
        nodes: nodesToExport,
      };

      return new Response(JSON.stringify(exportData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="nodes.json"',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
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

      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="nodes.csv"',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
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

// 获取单个节点
nodesRouter.get('/:id', async (c) => {
  try {
    const nodeId = c.req.param('id');
    const nodesRepo = c.get('nodesRepo');

    let node: any = null;

    if (nodesRepo) {
      // 使用数据库存储
      const result = await nodesRepo.getNodeById(nodeId);

      if (!result.success) {
        return c.json({
          success: false,
          error: 'Database error',
          message: result.error,
        }, 500);
      }

      node = result.data;
    } else {
      return c.json({
        success: false,
        error: 'Service unavailable',
        message: 'Database not configured',
      }, 503);
    }

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
    const nodesRepo = c.get('nodesRepo');

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
    const node: any = {
      ...body,
      id: body.id || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      enabled: body.enabled !== undefined ? body.enabled : true,
      createdAt: now,
      updatedAt: now,
    };

    let result: any;

    if (nodesRepo) {
      // 使用数据库存储
      result = await nodesRepo.createNode(node);

      if (!result.success) {
        // 检查是否是重复错误
        if (result.error?.includes('UNIQUE constraint failed')) {
          return c.json({
            success: false,
            error: 'Conflict',
            message: 'Node with this ID or name already exists',
          }, 409);
        }

        return c.json({
          success: false,
          error: 'Database error',
          message: result.error,
        }, 500);
      }
    } else {
      return c.json({
        success: false,
        error: 'Service unavailable',
        message: 'Database not configured',
      }, 503);
    }

    return c.json({
      success: true,
      data: result.data,
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
    const nodesRepo = c.get('nodesRepo');

    let existingNode: any = null;
    let result: any;

    if (nodesRepo) {
      // 使用数据库存储
      const existingResult = await nodesRepo.getNodeById(nodeId);
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
          error: 'Node not found',
          message: `Node with id '${nodeId}' does not exist`,
        }, 404);
      }

      existingNode = existingResult.data;

      // 更新节点
      const updatedNode = {
        ...existingNode,
        ...body,
        id: nodeId, // 确保ID不被修改
        updatedAt: new Date().toISOString(),
      };

      result = await nodesRepo.updateNode(nodeId, updatedNode);

      if (!result.success) {
        return c.json({
          success: false,
          error: 'Database error',
          message: result.error,
        }, 500);
      }
    } else {
      return c.json({
        success: false,
        error: 'Service unavailable',
        message: 'Database not configured',
      }, 503);
    }

    return c.json({
      success: true,
      data: result.data,
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
    const nodesRepo = c.get('nodesRepo');

    let existingNode: any = null;
    let result: any;

    if (nodesRepo) {
      // 使用数据库存储
      const existingResult = await nodesRepo.getNodeById(nodeId);
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
          error: 'Node not found',
          message: `Node with id '${nodeId}' does not exist`,
        }, 404);
      }

      existingNode = existingResult.data;

      // 删除节点
      result = await nodesRepo.deleteNode(nodeId);

      if (!result.success) {
        return c.json({
          success: false,
          error: 'Database error',
          message: result.error,
        }, 500);
      }
    } else {
      return c.json({
        success: false,
        error: 'Service unavailable',
        message: 'Database not configured',
      }, 503);
    }

    return c.json({
      success: true,
      data: existingNode,
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

    const validActions = ['enable', 'disable', 'delete'];
    if (!validActions.includes(action)) {
      return c.json({
        success: false,
        error: 'Invalid action',
        message: `Action must be one of: ${validActions.join(', ')}`,
      }, 400);
    }

    const nodesRepo = c.get('nodesRepo');
    if (!nodesRepo) {
      return c.json({
        success: false,
        error: 'Service unavailable',
        message: 'Database not configured',
      }, 503);
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      affectedNodes: [] as any[],
    };

    for (const nodeId of nodeIds) {
      try {
        // 检查节点是否存在
        const nodeResult = await nodesRepo.getNodeById(nodeId);
        if (!nodeResult.success || !nodeResult.data) {
          results.failed++;
          results.errors.push(`Node ${nodeId} not found`);
          continue;
        }

        let updateResult;
        switch (action) {
          case 'enable':
            updateResult = await nodesRepo.updateNode(nodeId, {
              enabled: true,
              updatedAt: new Date().toISOString()
            });
            break;
          case 'disable':
            updateResult = await nodesRepo.updateNode(nodeId, {
              enabled: false,
              updatedAt: new Date().toISOString()
            });
            break;
          case 'delete':
            updateResult = await nodesRepo.deleteNode(nodeId);
            break;
          default:
            results.failed++;
            results.errors.push(`Unknown action: ${action}`);
            continue;
        }

        if (updateResult && updateResult.success) {
          results.affectedNodes.push(updateResult.data);
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`Failed to ${action} node ${nodeId}: ${updateResult?.error || 'Unknown error'}`);
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

        // 使用数据库创建节点
        const nodesRepo = c.get('nodesRepo');
        if (!nodesRepo) {
          results.failed++;
          results.errors.push('Database not configured');
          continue;
        }

        const createResult = await nodesRepo.createNode(node);
        if (createResult.success) {
          results.importedNodes.push(createResult.data);
          results.success++;
        } else {
          results.failed++;
          if (createResult.error?.includes('UNIQUE constraint failed')) {
            results.errors.push(`Node ${node.server}:${node.port} (${node.type}) already exists`);
          } else {
            results.errors.push(`Failed to create node ${node.name}: ${createResult.error}`);
          }
        }

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
