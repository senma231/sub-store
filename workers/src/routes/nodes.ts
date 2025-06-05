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
