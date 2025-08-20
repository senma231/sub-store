import { Hono } from 'hono';
import { NodeRepository } from '../repositories/nodeRepository';
import { Node } from '../../../shared/types';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  ADMIN_TOKEN: string;
  JWT_SECRET: string;
};

const nodes = new Hono<{ Bindings: Bindings }>();

// 启用认证中间件
nodes.use('*', authMiddleware);

// 获取所有节点
nodes.get('/', async (c) => {
  try {
    console.log('开始获取节点列表...');
    const repository = new NodeRepository(c.env.DB);
    const result = await repository.findAll();

    console.log('Repository结果:', {
      success: result.success,
      dataLength: result.data?.length,
      error: result.error
    });

    if (!result.success) {
      console.error('Repository返回错误:', result.error);
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }

    console.log('返回节点数据，数量:', result.data?.length);
    return c.json({
      success: true,
      data: result.data,
      total: result.data?.length || 0
    });
  } catch (error) {
    console.error('获取节点列表失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 根据ID获取节点
nodes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const repository = new NodeRepository(c.env.DB);
    const result = await repository.findById(id);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }

    if (!result.data) {
      return c.json({
        success: false,
        error: '节点不存在'
      }, 404);
    }

    return c.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('获取节点失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 创建节点
nodes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    
    // 验证必需字段
    if (!body.name || !body.type || !body.server || !body.port) {
      return c.json({
        success: false,
        error: '缺少必需字段: name, type, server, port'
      }, 400);
    }

    const nodeData: Omit<Node, 'id' | 'createdAt' | 'updatedAt'> = {
      name: body.name,
      type: body.type,
      server: body.server,
      port: body.port,
      enabled: body.enabled !== false, // 默认启用
      uuid: body.uuid,
      password: body.password,
      method: body.method,
      network: body.network || 'tcp',
      tls: body.tls || false,
      sni: body.sni,
      alpn: body.alpn,
      fingerprint: body.fingerprint,
      remark: body.remark,
      tags: body.tags,
      // 其他协议特定字段
      encryption: body.encryption,
      flow: body.flow,
      alterId: body.alterId,
      security: body.security,
      username: body.username,
      allowInsecure: body.allowInsecure,
      wsPath: body.wsPath,
      wsHeaders: body.wsHeaders,
      h2Path: body.h2Path,
      h2Host: body.h2Host,
      grpcServiceName: body.grpcServiceName,
      grpcMode: body.grpcMode,
      plugin: body.plugin,
      pluginOpts: body.pluginOpts,
      obfs: body.obfs,
      obfsPassword: body.obfsPassword,
      upMbps: body.upMbps,
      downMbps: body.downMbps,
      auth: body.auth,
      authStr: body.authStr,
      protocol: body.protocol,
      totalRequests: 0
    };

    const repository = new NodeRepository(c.env.DB);
    const result = await repository.create(nodeData);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }

    return c.json({
      success: true,
      data: result.data,
      message: '节点创建成功'
    });
  } catch (error) {
    console.error('创建节点失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 更新节点
nodes.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    const repository = new NodeRepository(c.env.DB);
    const result = await repository.update(id, body);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }

    if (!result.data) {
      return c.json({
        success: false,
        error: '节点不存在'
      }, 404);
    }

    return c.json({
      success: true,
      data: result.data,
      message: '节点更新成功'
    });
  } catch (error) {
    console.error('更新节点失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 删除节点
nodes.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const repository = new NodeRepository(c.env.DB);
    const result = await repository.delete(id);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }

    return c.json({
      success: true,
      message: '节点删除成功'
    });
  } catch (error) {
    console.error('删除节点失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 批量操作节点
nodes.post('/batch', async (c) => {
  try {
    const body = await c.req.json();
    const { action, ids, data } = body;

    if (!action || !ids || !Array.isArray(ids)) {
      return c.json({
        success: false,
        error: '缺少必需字段: action, ids'
      }, 400);
    }

    const repository = new NodeRepository(c.env.DB);
    let result;

    switch (action) {
      case 'enable':
        result = await repository.batchUpdate(ids, { enabled: true });
        break;
      case 'disable':
        result = await repository.batchUpdate(ids, { enabled: false });
        break;
      case 'delete':
        result = await repository.batchDelete(ids);
        break;
      case 'update':
        if (!data) {
          return c.json({
            success: false,
            error: '批量更新需要提供data字段'
          }, 400);
        }
        result = await repository.batchUpdate(ids, data);
        break;
      default:
        return c.json({
          success: false,
          error: '不支持的操作类型'
        }, 400);
    }

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }

    return c.json({
      success: true,
      data: result.data,
      message: `批量${action}操作成功`
    });
  } catch (error) {
    console.error('批量操作失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 导入节点
nodes.post('/import', async (c) => {
  try {
    const body = await c.req.json();
    const { content, format } = body;

    if (!content) {
      return c.json({
        success: false,
        error: '缺少导入内容'
      }, 400);
    }

    // 这里应该实现节点链接解析逻辑
    // 暂时返回成功响应
    return c.json({
      success: true,
      data: {
        imported: 0,
        failed: 0,
        nodes: []
      },
      message: '节点导入功能正在开发中'
    });
  } catch (error) {
    console.error('导入节点失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 导出节点
nodes.get('/export', async (c) => {
  try {
    const format = c.req.query('format') || 'json';
    const repository = new NodeRepository(c.env.DB);
    const result = await repository.findAll();

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }

    const nodes = result.data || [];

    if (format === 'csv') {
      // 生成CSV格式
      const csvHeader = 'id,name,type,server,port,enabled,remark\n';
      const csvContent = nodes.map(node =>
        `${node.id},${node.name},${node.type},${node.server},${node.port},${node.enabled},${node.remark || ''}`
      ).join('\n');

      return c.text(csvHeader + csvContent, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="nodes.csv"'
      });
    }

    // 默认JSON格式
    return c.json({
      success: true,
      data: nodes,
      total: nodes.length
    });
  } catch (error) {
    console.error('导出节点失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

export { nodes };
