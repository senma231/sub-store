/**
 * X-UI面板管理API路由
 * 提供X-UI面板的CRUD操作和节点同步功能
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { XUIPanelsRepository } from '../database/xuiPanels';
import { NodesRepository } from '../database/nodes';
import { XUIConnector } from '../utils/xuiConnector';
import { XUIParser } from '../utils/xuiParser';

export const xuiPanelsRouter = new Hono<{ Bindings: Env }>();

// 获取所有X-UI面板
xuiPanelsRouter.get('/', async (c) => {
  try {
    const db = c.env.DB;
    const xuiPanelsRepo = new XUIPanelsRepository(db);
    
    const result = await xuiPanelsRepo.getAll();
    
    if (result.success) {
      // 隐藏敏感信息（密码）
      const safePanels = result.data?.map(panel => ({
        ...panel,
        password: '***'
      }));
      
      return c.json({
        success: true,
        data: safePanels
      });
    } else {
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }
    
  } catch (error) {
    console.error('获取X-UI面板列表失败:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error'
    }, 500);
  }
});

// 创建X-UI面板
xuiPanelsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const db = c.env.DB;
    const xuiPanelsRepo = new XUIPanelsRepository(db);
    
    // 验证必填字段
    if (!body.name || !body.host || !body.port || !body.username || !body.password) {
      return c.json({
        success: false,
        error: 'Missing required fields: name, host, port, username, password'
      }, 400);
    }
    
    // 验证端口范围
    if (body.port < 1 || body.port > 65535) {
      return c.json({
        success: false,
        error: 'Port must be between 1 and 65535'
      }, 400);
    }
    
    const panelData = {
      name: body.name,
      host: body.host,
      port: parseInt(body.port),
      basePath: body.basePath || undefined,
      username: body.username,
      password: body.password,
      protocol: body.protocol || 'https',
      enabled: body.enabled !== undefined ? body.enabled : true,
      syncStatus: 'pending' as const
    };
    
    const result = await xuiPanelsRepo.create(panelData);
    
    if (result.success) {
      // 隐藏密码
      const safePanel = {
        ...result.data,
        password: '***'
      };
      
      return c.json({
        success: true,
        data: safePanel
      });
    } else {
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }
    
  } catch (error) {
    console.error('创建X-UI面板失败:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error'
    }, 500);
  }
});

// 获取单个X-UI面板
xuiPanelsRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const db = c.env.DB;
    const xuiPanelsRepo = new XUIPanelsRepository(db);
    
    const result = await xuiPanelsRepo.getById(id);
    
    if (result.success) {
      // 隐藏密码
      const safePanel = {
        ...result.data,
        password: '***'
      };
      
      return c.json({
        success: true,
        data: safePanel
      });
    } else {
      return c.json({
        success: false,
        error: result.error
      }, result.error === 'Panel not found' ? 404 : 500);
    }
    
  } catch (error) {
    console.error('获取X-UI面板失败:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error'
    }, 500);
  }
});

// 更新X-UI面板
xuiPanelsRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const db = c.env.DB;
    const xuiPanelsRepo = new XUIPanelsRepository(db);
    
    // 验证端口范围（如果提供）
    if (body.port && (body.port < 1 || body.port > 65535)) {
      return c.json({
        success: false,
        error: 'Port must be between 1 and 65535'
      }, 400);
    }
    
    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.host !== undefined) updates.host = body.host;
    if (body.port !== undefined) updates.port = parseInt(body.port);
    if (body.basePath !== undefined) updates.basePath = body.basePath || undefined;
    if (body.username !== undefined) updates.username = body.username;
    if (body.password !== undefined && body.password !== '***') {
      updates.password = body.password;
    }
    if (body.protocol !== undefined) updates.protocol = body.protocol;
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    
    const result = await xuiPanelsRepo.update(id, updates);
    
    if (result.success) {
      // 隐藏密码
      const safePanel = {
        ...result.data,
        password: '***'
      };
      
      return c.json({
        success: true,
        data: safePanel
      });
    } else {
      return c.json({
        success: false,
        error: result.error
      }, result.error === 'Panel not found' ? 404 : 500);
    }
    
  } catch (error) {
    console.error('更新X-UI面板失败:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error'
    }, 500);
  }
});

// 删除X-UI面板
xuiPanelsRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const db = c.env.DB;
    const xuiPanelsRepo = new XUIPanelsRepository(db);
    
    const result = await xuiPanelsRepo.delete(id);
    
    if (result.success) {
      return c.json({
        success: true,
        message: 'Panel deleted successfully'
      });
    } else {
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }
    
  } catch (error) {
    console.error('删除X-UI面板失败:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error'
    }, 500);
  }
});

// 测试X-UI面板连接
xuiPanelsRouter.post('/:id/test', async (c) => {
  try {
    const id = c.req.param('id');
    const db = c.env.DB;
    const xuiPanelsRepo = new XUIPanelsRepository(db);
    
    // 获取面板配置
    const panelResult = await xuiPanelsRepo.getById(id);
    if (!panelResult.success) {
      return c.json({
        success: false,
        error: panelResult.error
      }, 404);
    }
    
    const panel = panelResult.data!;
    const connector = new XUIConnector(panel);
    
    // 测试连接
    const testResult = await connector.testConnection();
    
    return c.json({
      success: true,
      data: {
        connected: testResult.success,
        latency: testResult.latency,
        error: testResult.error
      }
    });
    
  } catch (error) {
    console.error('测试X-UI面板连接失败:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error'
    }, 500);
  }
});

// 从X-UI面板同步节点
xuiPanelsRouter.post('/:id/sync', async (c) => {
  try {
    const id = c.req.param('id');
    const db = c.env.DB;
    const xuiPanelsRepo = new XUIPanelsRepository(db);
    const nodesRepo = new NodesRepository(db);
    
    const syncStartTime = Date.now();
    
    // 获取面板配置
    const panelResult = await xuiPanelsRepo.getById(id);
    if (!panelResult.success) {
      return c.json({
        success: false,
        error: panelResult.error
      }, 404);
    }
    
    const panel = panelResult.data!;
    const connector = new XUIConnector(panel);
    
    console.log(`🔄 [X-UI同步] 开始同步面板: ${panel.name} (${panel.host}:${panel.port})`);
    
    // 获取inbound配置
    const inboundsResult = await connector.getInbounds();
    if (!inboundsResult.success) {
      // 记录失败日志
      await xuiPanelsRepo.createSyncLog({
        panelId: id,
        syncType: 'manual',
        nodesFound: 0,
        nodesImported: 0,
        nodesUpdated: 0,
        status: 'failed',
        errorMessage: inboundsResult.error,
        syncDuration: Date.now() - syncStartTime
      });
      
      // 更新面板状态
      await xuiPanelsRepo.update(id, {
        syncStatus: 'failed',
        syncError: inboundsResult.error,
        lastSyncAt: new Date().toISOString()
      });
      
      return c.json({
        success: false,
        error: inboundsResult.error
      }, 500);
    }
    
    const inbounds = inboundsResult.data!;
    console.log(`📡 [X-UI同步] 获取到 ${inbounds.length} 个入站配置`);
    
    // 解析节点
    const parsedNodes = XUIParser.parseInbounds(inbounds, panel.host);
    console.log(`🔍 [X-UI同步] 成功解析 ${parsedNodes.length} 个节点`);
    
    let importedCount = 0;
    let updatedCount = 0;
    
    // 导入节点到数据库
    for (const node of parsedNodes) {
      try {
        // 检查节点是否已存在（基于xuiId）
        const existingResult = await nodesRepo.getNodes({ page: 1, limit: 1000 });
        const existingNodes = existingResult.data?.items || [];
        const existingNode = existingNodes.find(n => 
          n.tags?.includes('x-ui') && 
          n.remark?.includes(`xui-${node.xuiId}`)
        );
        
        if (existingNode) {
          // 更新现有节点
          const updateResult = await nodesRepo.updateNode(existingNode.id, {
            name: node.name,
            server: node.server,
            port: node.port,
            enabled: node.enabled,
            remark: node.remark,
            updatedAt: new Date().toISOString()
          });
          
          if (updateResult.success) {
            updatedCount++;
            console.log(`🔄 [X-UI同步] 更新节点: ${node.name}`);
          }
        } else {
          // 创建新节点
          const createResult = await nodesRepo.createNode(node);
          if (createResult.success) {
            importedCount++;
            console.log(`➕ [X-UI同步] 导入节点: ${node.name}`);
          }
        }
      } catch (error) {
        console.error(`❌ [X-UI同步] 处理节点失败: ${node.name}`, error);
      }
    }
    
    const syncDuration = Date.now() - syncStartTime;
    
    // 记录同步日志
    await xuiPanelsRepo.createSyncLog({
      panelId: id,
      syncType: 'manual',
      nodesFound: inbounds.length,
      nodesImported: importedCount,
      nodesUpdated: updatedCount,
      status: 'success',
      syncDuration
    });
    
    // 更新面板状态
    await xuiPanelsRepo.update(id, {
      syncStatus: 'success',
      syncError: undefined,
      lastSyncAt: new Date().toISOString()
    });
    
    console.log(`✅ [X-UI同步] 同步完成: 导入${importedCount}个，更新${updatedCount}个，耗时${syncDuration}ms`);
    
    return c.json({
      success: true,
      data: {
        nodesFound: inbounds.length,
        nodesImported: importedCount,
        nodesUpdated: updatedCount,
        syncDuration
      }
    });
    
  } catch (error) {
    console.error('同步X-UI节点失败:', error);
    
    // 记录失败日志
    try {
      const db = c.env.DB;
      const xuiPanelsRepo = new XUIPanelsRepository(db);
      await xuiPanelsRepo.createSyncLog({
        panelId: c.req.param('id'),
        syncType: 'manual',
        nodesFound: 0,
        nodesImported: 0,
        nodesUpdated: 0,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        syncDuration: 0
      });
    } catch (logError) {
      console.error('记录同步日志失败:', logError);
    }
    
    return c.json({
      success: false,
      error: 'Internal Server Error'
    }, 500);
  }
});

// 获取面板同步日志
xuiPanelsRouter.get('/:id/logs', async (c) => {
  try {
    const id = c.req.param('id');
    const limit = parseInt(c.req.query('limit') || '50');
    const db = c.env.DB;
    const xuiPanelsRepo = new XUIPanelsRepository(db);
    
    const result = await xuiPanelsRepo.getSyncLogs(id, limit);
    
    if (result.success) {
      return c.json({
        success: true,
        data: result.data
      });
    } else {
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }
    
  } catch (error) {
    console.error('获取同步日志失败:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error'
    }, 500);
  }
});
