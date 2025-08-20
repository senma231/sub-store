import { Hono } from 'hono';
import { XUIPanelRepository } from '../repositories/xuiPanelRepository';
import { XUIPanel } from '../../../shared/types';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  ADMIN_TOKEN: string;
  JWT_SECRET: string;
};

const xuiPanels = new Hono<{ Bindings: Bindings }>();

// 启用认证中间件
xuiPanels.use('*', authMiddleware);

// 获取所有X-UI面板
xuiPanels.get('/', async (c) => {
  try {
    const repository = new XUIPanelRepository(c.env.DB);
    const result = await repository.findAll();

    if (!result.success) {
      return c.json({ 
        success: false, 
        error: result.error 
      }, 500);
    }

    return c.json({
      success: true,
      data: result.data,
      total: result.data?.length || 0
    });
  } catch (error) {
    console.error('获取X-UI面板列表失败:', error);
    return c.json({ 
      success: false, 
      error: '服务器内部错误' 
    }, 500);
  }
});

// 根据ID获取X-UI面板
xuiPanels.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const repository = new XUIPanelRepository(c.env.DB);
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
        error: 'X-UI面板不存在' 
      }, 404);
    }

    return c.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('获取X-UI面板失败:', error);
    return c.json({ 
      success: false, 
      error: '服务器内部错误' 
    }, 500);
  }
});

// 创建X-UI面板
xuiPanels.post('/', async (c) => {
  try {
    const body = await c.req.json();
    
    // 验证必需字段
    if (!body.name || !body.url || !body.username || !body.password) {
      return c.json({
        success: false,
        error: '缺少必需字段: name, url, username, password'
      }, 400);
    }

    // 验证URL格式
    try {
      new URL(body.url);
    } catch {
      return c.json({
        success: false,
        error: 'URL格式无效'
      }, 400);
    }

    const panelData: Omit<XUIPanel, 'id' | 'createdAt' | 'updatedAt'> = {
      name: body.name,
      url: body.url,
      username: body.username,
      password: body.password,
      enabled: body.enabled !== false, // 默认启用
      remark: body.remark,
      tags: body.tags,
      timeout: body.timeout || 30,
      retryCount: body.retryCount || 3,
      totalNodes: 0,
      status: 'offline'
    };

    const repository = new XUIPanelRepository(c.env.DB);
    const result = await repository.create(panelData);

    if (!result.success) {
      return c.json({ 
        success: false, 
        error: result.error 
      }, 500);
    }

    return c.json({
      success: true,
      data: result.data,
      message: 'X-UI面板创建成功'
    }, 201);
  } catch (error) {
    console.error('创建X-UI面板失败:', error);
    return c.json({ 
      success: false, 
      error: '服务器内部错误' 
    }, 500);
  }
});

// 更新X-UI面板
xuiPanels.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    // 验证URL格式（如果提供）
    if (body.url) {
      try {
        new URL(body.url);
      } catch {
        return c.json({
          success: false,
          error: 'URL格式无效'
        }, 400);
      }
    }

    const repository = new XUIPanelRepository(c.env.DB);
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
        error: 'X-UI面板不存在' 
      }, 404);
    }

    return c.json({
      success: true,
      data: result.data,
      message: 'X-UI面板更新成功'
    });
  } catch (error) {
    console.error('更新X-UI面板失败:', error);
    return c.json({ 
      success: false, 
      error: '服务器内部错误' 
    }, 500);
  }
});

// 删除X-UI面板
xuiPanels.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const repository = new XUIPanelRepository(c.env.DB);
    const result = await repository.delete(id);

    if (!result.success) {
      return c.json({ 
        success: false, 
        error: result.error 
      }, 500);
    }

    return c.json({
      success: true,
      message: 'X-UI面板删除成功'
    });
  } catch (error) {
    console.error('删除X-UI面板失败:', error);
    return c.json({ 
      success: false, 
      error: '服务器内部错误' 
    }, 500);
  }
});

// 批量操作X-UI面板
xuiPanels.post('/batch', async (c) => {
  try {
    const body = await c.req.json();
    const { action, ids, data } = body;

    if (!action || !ids || !Array.isArray(ids)) {
      return c.json({
        success: false,
        error: '缺少必需字段: action, ids'
      }, 400);
    }

    const repository = new XUIPanelRepository(c.env.DB);

    switch (action) {
      case 'enable':
        const enableResult = await repository.batchUpdate(ids, { enabled: true });
        if (!enableResult.success) {
          return c.json({ success: false, error: enableResult.error }, 500);
        }
        return c.json({
          success: true,
          message: `成功启用 ${enableResult.data} 个X-UI面板`
        });

      case 'disable':
        const disableResult = await repository.batchUpdate(ids, { enabled: false });
        if (!disableResult.success) {
          return c.json({ success: false, error: disableResult.error }, 500);
        }
        return c.json({
          success: true,
          message: `成功禁用 ${disableResult.data} 个X-UI面板`
        });

      case 'delete':
        let deletedCount = 0;
        for (const id of ids) {
          const deleteResult = await repository.delete(id);
          if (deleteResult.success) {
            deletedCount++;
          }
        }
        return c.json({
          success: true,
          message: `成功删除 ${deletedCount} 个X-UI面板`
        });

      default:
        return c.json({
          success: false,
          error: '不支持的操作类型'
        }, 400);
    }
  } catch (error) {
    console.error('批量操作X-UI面板失败:', error);
    return c.json({ 
      success: false, 
      error: '服务器内部错误' 
    }, 500);
  }
});

// 测试X-UI面板连接
xuiPanels.post('/:id/test', async (c) => {
  try {
    const id = c.req.param('id');
    const repository = new XUIPanelRepository(c.env.DB);
    
    // 获取面板信息
    const panelResult = await repository.findById(id);
    if (!panelResult.success || !panelResult.data) {
      return c.json({
        success: false,
        error: 'X-UI面板不存在'
      }, 404);
    }

    const panel = panelResult.data;
    
    try {
      // 测试连接（这里是模拟，实际需要调用X-UI API）
      const testUrl = `${panel.url}/login`;
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Sub-Store/2.0.0'
        },
        signal: AbortSignal.timeout(panel.timeout! * 1000)
      });

      const isOnline = response.ok;
      const status = isOnline ? 'online' : 'error';

      // 更新面板状态
      await repository.update(id, { 
        status,
        lastSync: new Date().toISOString()
      });

      return c.json({
        success: true,
        data: {
          status,
          statusCode: response.status,
          responseTime: Date.now() // 简化的响应时间
        },
        message: isOnline ? '连接测试成功' : '连接测试失败'
      });
    } catch (error) {
      // 更新为错误状态
      await repository.update(id, { 
        status: 'error',
        lastSync: new Date().toISOString()
      });

      return c.json({
        success: false,
        error: `连接测试失败: ${error instanceof Error ? error.message : String(error)}`,
        data: {
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  } catch (error) {
    console.error('测试X-UI面板连接失败:', error);
    return c.json({ 
      success: false, 
      error: '服务器内部错误' 
    }, 500);
  }
});

export { xuiPanels };
