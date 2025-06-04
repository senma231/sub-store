import { Hono } from 'hono';
import { Env } from '../index';
import { ProxyNode, ApiResponse, PaginatedResponse } from '../../../shared/types';
import { validateNode } from '../utils/validation';
import { generateId } from '../utils/helpers';

export const nodesRouter = new Hono<{ Bindings: Env }>();

// 获取所有节点
nodesRouter.get('/', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
    const search = c.req.query('search') || '';
    const type = c.req.query('type') || '';
    const enabled = c.req.query('enabled');
    
    // 从 KV 获取所有节点
    const nodesData = await c.env.SUB_STORE_KV.get('nodes');
    let nodes: ProxyNode[] = nodesData ? JSON.parse(nodesData) : [];
    
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
    
    const response: ApiResponse<PaginatedResponse<ProxyNode>> = {
      success: true,
      data: {
        items: paginatedNodes,
        total,
        page,
        limit,
        totalPages,
      },
    };
    
    return c.json(response);
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
    
    const nodesData = await c.env.SUB_STORE_KV.get('nodes');
    const nodes: ProxyNode[] = nodesData ? JSON.parse(nodesData) : [];
    
    const node = nodes.find(n => n.id === nodeId);
    
    if (!node) {
      return c.json({
        success: false,
        error: 'Node not found',
        message: `Node with id '${nodeId}' does not exist`,
      }, 404);
    }
    
    const response: ApiResponse<ProxyNode> = {
      success: true,
      data: node,
    };
    
    return c.json(response);
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
    
    // 验证节点数据
    const validationResult = validateNode(body);
    if (!validationResult.valid) {
      return c.json({
        success: false,
        error: 'Validation Error',
        message: validationResult.errors.join(', '),
      }, 400);
    }
    
    // 生成节点 ID 和时间戳
    const now = new Date().toISOString();
    const node: ProxyNode = {
      ...body,
      id: body.id || generateId(),
      enabled: body.enabled !== undefined ? body.enabled : true,
      createdAt: now,
      updatedAt: now,
    };
    
    // 获取现有节点
    const nodesData = await c.env.SUB_STORE_KV.get('nodes');
    const nodes: ProxyNode[] = nodesData ? JSON.parse(nodesData) : [];
    
    // 检查 ID 是否已存在
    if (nodes.some(n => n.id === node.id)) {
      return c.json({
        success: false,
        error: 'Conflict',
        message: `Node with id '${node.id}' already exists`,
      }, 409);
    }
    
    // 检查名称是否已存在
    if (nodes.some(n => n.name === node.name)) {
      return c.json({
        success: false,
        error: 'Conflict',
        message: `Node with name '${node.name}' already exists`,
      }, 409);
    }
    
    // 添加新节点
    nodes.push(node);
    
    // 保存到 KV
    await c.env.SUB_STORE_KV.put('nodes', JSON.stringify(nodes));
    
    // 记录操作日志
    const user = c.get('user');
    await logOperation(c.env.SUB_STORE_KV, {
      action: 'create_node',
      nodeId: node.id,
      userId: user?.id || 'unknown',
      timestamp: now,
    });
    
    const response: ApiResponse<ProxyNode> = {
      success: true,
      data: node,
      message: 'Node created successfully',
    };
    
    return c.json(response, 201);
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
    
    // 验证节点数据
    const validationResult = validateNode(body);
    if (!validationResult.valid) {
      return c.json({
        success: false,
        error: 'Validation Error',
        message: validationResult.errors.join(', '),
      }, 400);
    }
    
    // 获取现有节点
    const nodesData = await c.env.SUB_STORE_KV.get('nodes');
    const nodes: ProxyNode[] = nodesData ? JSON.parse(nodesData) : [];
    
    const nodeIndex = nodes.findIndex(n => n.id === nodeId);
    
    if (nodeIndex === -1) {
      return c.json({
        success: false,
        error: 'Node not found',
        message: `Node with id '${nodeId}' does not exist`,
      }, 404);
    }
    
    // 检查名称冲突 (排除当前节点)
    if (body.name && nodes.some(n => n.name === body.name && n.id !== nodeId)) {
      return c.json({
        success: false,
        error: 'Conflict',
        message: `Node with name '${body.name}' already exists`,
      }, 409);
    }
    
    // 更新节点
    const updatedNode: ProxyNode = {
      ...nodes[nodeIndex],
      ...body,
      id: nodeId, // 确保 ID 不被修改
      updatedAt: new Date().toISOString(),
    };
    
    nodes[nodeIndex] = updatedNode;
    
    // 保存到 KV
    await c.env.SUB_STORE_KV.put('nodes', JSON.stringify(nodes));
    
    // 记录操作日志
    const user = c.get('user');
    await logOperation(c.env.SUB_STORE_KV, {
      action: 'update_node',
      nodeId: nodeId,
      userId: user?.id || 'unknown',
      timestamp: new Date().toISOString(),
    });
    
    const response: ApiResponse<ProxyNode> = {
      success: true,
      data: updatedNode,
      message: 'Node updated successfully',
    };
    
    return c.json(response);
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
    
    // 获取现有节点
    const nodesData = await c.env.SUB_STORE_KV.get('nodes');
    const nodes: ProxyNode[] = nodesData ? JSON.parse(nodesData) : [];
    
    const nodeIndex = nodes.findIndex(n => n.id === nodeId);
    
    if (nodeIndex === -1) {
      return c.json({
        success: false,
        error: 'Node not found',
        message: `Node with id '${nodeId}' does not exist`,
      }, 404);
    }
    
    // 删除节点
    const deletedNode = nodes.splice(nodeIndex, 1)[0];
    
    // 保存到 KV
    await c.env.SUB_STORE_KV.put('nodes', JSON.stringify(nodes));
    
    // 记录操作日志
    const user = c.get('user');
    await logOperation(c.env.SUB_STORE_KV, {
      action: 'delete_node',
      nodeId: nodeId,
      userId: user?.id || 'unknown',
      timestamp: new Date().toISOString(),
    });
    
    const response: ApiResponse<ProxyNode> = {
      success: true,
      data: deletedNode,
      message: 'Node deleted successfully',
    };
    
    return c.json(response);
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
    const { action, nodeIds } = await c.req.json();
    
    if (!action || !Array.isArray(nodeIds)) {
      return c.json({
        success: false,
        error: 'Invalid request',
        message: 'Action and nodeIds array are required',
      }, 400);
    }
    
    const nodesData = await c.env.SUB_STORE_KV.get('nodes');
    let nodes: ProxyNode[] = nodesData ? JSON.parse(nodesData) : [];
    
    let affectedNodes: ProxyNode[] = [];
    
    switch (action) {
      case 'enable':
        nodes = nodes.map(node => {
          if (nodeIds.includes(node.id)) {
            affectedNodes.push(node);
            return { ...node, enabled: true, updatedAt: new Date().toISOString() };
          }
          return node;
        });
        break;
        
      case 'disable':
        nodes = nodes.map(node => {
          if (nodeIds.includes(node.id)) {
            affectedNodes.push(node);
            return { ...node, enabled: false, updatedAt: new Date().toISOString() };
          }
          return node;
        });
        break;
        
      case 'delete':
        const originalLength = nodes.length;
        nodes = nodes.filter(node => {
          if (nodeIds.includes(node.id)) {
            affectedNodes.push(node);
            return false;
          }
          return true;
        });
        break;
        
      default:
        return c.json({
          success: false,
          error: 'Invalid action',
          message: 'Supported actions: enable, disable, delete',
        }, 400);
    }
    
    // 保存到 KV
    await c.env.SUB_STORE_KV.put('nodes', JSON.stringify(nodes));
    
    // 记录操作日志
    const user = c.get('user');
    await logOperation(c.env.SUB_STORE_KV, {
      action: `batch_${action}`,
      nodeIds: nodeIds,
      userId: user?.id || 'unknown',
      timestamp: new Date().toISOString(),
    });
    
    return c.json({
      success: true,
      data: {
        action,
        affectedCount: affectedNodes.length,
        affectedNodes,
      },
      message: `Batch ${action} completed successfully`,
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

// 辅助函数：记录操作日志
async function logOperation(kv: KVNamespace, operation: any) {
  try {
    const logKey = `log:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    await kv.put(logKey, JSON.stringify(operation), { expirationTtl: 30 * 24 * 60 * 60 }); // 30天过期
  } catch (error) {
    console.error('Failed to log operation:', error);
  }
}
