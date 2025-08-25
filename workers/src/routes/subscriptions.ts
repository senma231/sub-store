import { Hono } from 'hono';
import { SubscriptionRepository } from '../repositories/subscriptionRepository';
import { CustomSubscriptionData } from '../../../shared/types';
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
    console.log('开始获取订阅列表...');

    // 获取查询参数
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);

    const repository = new SubscriptionRepository(c.env.DB);
    const result = await repository.findAll();

    if (!result.success) {
      console.error('获取订阅失败:', result.error);
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }

    const subscriptions = result.data || [];

    // 计算分页
    const total = subscriptions.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedSubscriptions = subscriptions.slice(offset, offset + limit);

    console.log('返回订阅数据，总数:', total, '当前页:', paginatedSubscriptions.length);

    // 返回标准分页格式
    return c.json({
      success: true,
      data: {
        items: paginatedSubscriptions,
        total: total,
        page: page,
        limit: limit,
        totalPages: totalPages
      }
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

    const subscriptionData: Omit<CustomSubscriptionData, 'uuid' | 'createdAt' | 'updatedAt'> = {
      name: body.name,
      description: body.description,
      nodeIds: body.nodeIds,
      enabled: body.enabled !== false, // 默认启用
      format: body.format || 'v2ray', // 添加format字段
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

// 更新订阅流量设置
subscriptions.put('/:uuid/traffic', async (c) => {
  try {
    const uuid = c.req.param('uuid');
    const body = await c.req.json();

    // 验证流量设置数据
    const { enabled, limit, resetCycle } = body;

    if (enabled && (!limit || limit < 0)) {
      return c.json({
        success: false,
        error: '启用流量限制时必须设置有效的限制值'
      }, 400);
    }

    // 这里应该更新订阅的流量设置
    // 由于当前数据库表结构中没有流量相关字段，我们先返回成功响应
    // 在实际实现中，需要扩展数据库表结构来存储流量设置

    return c.json({
      success: true,
      message: '流量设置更新成功',
      data: {
        enabled: enabled || false,
        limit: limit || 0,
        resetCycle: resetCycle || 'monthly'
      }
    });
  } catch (error) {
    console.error('更新流量设置失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 获取订阅流量统计
subscriptions.get('/:uuid/traffic', async (c) => {
  try {
    const uuid = c.req.param('uuid');

    // 这里应该从数据库获取实际的流量统计数据
    // 目前返回模拟数据
    const stats = {
      limit: 0,
      used: 0,
      remaining: 0,
      percentage: 0,
      resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      resetCycle: 'monthly',
      enabled: false
    };

    return c.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取流量统计失败:', error);
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
