import { Hono } from 'hono';
import { SubscriptionRepository } from '../repositories/subscriptionRepository';
import { Subscription } from '../../../shared/types';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  ADMIN_TOKEN: string;
  JWT_SECRET: string;
};

const subscriptions = new Hono<{ Bindings: Bindings }>();

// 启用认证中间件
subscriptions.use('*', authMiddleware);

// 获取所有订阅
subscriptions.get('/', async (c) => {
  try {
    const repository = new SubscriptionRepository(c.env.DB);
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
    console.error('获取订阅列表失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 根据UUID获取订阅
subscriptions.get('/:uuid', async (c) => {
  try {
    const uuid = c.req.param('uuid');
    const repository = new SubscriptionRepository(c.env.DB);
    const result = await repository.findByUuid(uuid);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }

    if (!result.data) {
      return c.json({
        success: false,
        error: '订阅不存在'
      }, 404);
    }

    return c.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('获取订阅失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 创建自定义订阅
subscriptions.post('/', async (c) => {
  try {
    const body = await c.req.json();
    
    // 验证必需字段
    if (!body.name || !body.nodeIds || !Array.isArray(body.nodeIds)) {
      return c.json({
        success: false,
        error: '缺少必需字段: name, nodeIds'
      }, 400);
    }

    const subscriptionData: Omit<Subscription, 'uuid' | 'createdAt' | 'updatedAt'> = {
      name: body.name,
      description: body.description,
      nodeIds: body.nodeIds,
      enabled: body.enabled !== false, // 默认启用
      includeTypes: body.includeTypes,
      excludeTypes: body.excludeTypes,
      includeKeywords: body.includeKeywords,
      excludeKeywords: body.excludeKeywords,
      sortBy: body.sortBy || 'name',
      sortOrder: body.sortOrder || 'asc',
      groupEnabled: body.groupEnabled || false,
      groupBy: body.groupBy || 'type',
      renameRules: body.renameRules,
      totalRequests: 0,
      lastAccessed: undefined,
      expiresAt: body.expiresAt
    };

    const repository = new SubscriptionRepository(c.env.DB);
    const result = await repository.create(subscriptionData);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }

    return c.json({
      success: true,
      data: result.data,
      message: '订阅创建成功'
    });
  } catch (error) {
    console.error('创建订阅失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 更新订阅
subscriptions.put('/:uuid', async (c) => {
  try {
    const uuid = c.req.param('uuid');
    const body = await c.req.json();

    const repository = new SubscriptionRepository(c.env.DB);
    const result = await repository.update(uuid, body);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }

    if (!result.data) {
      return c.json({
        success: false,
        error: '订阅不存在'
      }, 404);
    }

    return c.json({
      success: true,
      data: result.data,
      message: '订阅更新成功'
    });
  } catch (error) {
    console.error('更新订阅失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 删除订阅
subscriptions.delete('/:uuid', async (c) => {
  try {
    const uuid = c.req.param('uuid');
    const repository = new SubscriptionRepository(c.env.DB);
    const result = await repository.delete(uuid);

    if (!result.success) {
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }

    return c.json({
      success: true,
      message: '订阅删除成功'
    });
  } catch (error) {
    console.error('删除订阅失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 批量操作订阅
subscriptions.post('/batch', async (c) => {
  try {
    const body = await c.req.json();
    const { action, uuids } = body;

    if (!action || !uuids || !Array.isArray(uuids)) {
      return c.json({
        success: false,
        error: '缺少必需字段: action, uuids'
      }, 400);
    }

    const repository = new SubscriptionRepository(c.env.DB);
    let result;

    switch (action) {
      case 'delete':
        result = await repository.batchDelete(uuids);
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

export { subscriptions };
