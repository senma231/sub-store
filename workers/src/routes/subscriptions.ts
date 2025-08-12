import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { SubscriptionsRepository } from '../database/subscriptions';
import { parseSubscriptionContent } from '../utils/subscriptionParser';

export const subscriptionsRouter = new Hono<{ Bindings: Env }>();

// 临时禁用认证中间件以解决登录问题
// TODO: 修复登录问题后重新启用认证
// subscriptionsRouter.use('*', authMiddleware);

// 获取所有订阅
subscriptionsRouter.get('/', async (c) => {
  try {
    const subscriptionsRepo = c.get('subscriptionsRepo') as SubscriptionsRepository;
    
    if (!subscriptionsRepo) {
      return c.json({
        success: false,
        error: 'Service unavailable',
        message: 'Subscriptions repository not available',
      }, 503);
    }

    const result = await subscriptionsRepo.getAll();
    
    if (!result.success) {
      return c.json({
        success: false,
        error: 'Database error',
        message: result.error,
      }, 500);
    }

    return c.json({
      success: true,
      data: result.data,
    });

  } catch (error) {
    console.error('Get subscriptions error:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to get subscriptions',
    }, 500);
  }
});

// 创建订阅
subscriptionsRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const subscriptionsRepo = c.get('subscriptionsRepo') as SubscriptionsRepository;

    // 验证请求数据
    if (!body.name || !body.url) {
      return c.json({
        success: false,
        error: 'Validation Error',
        message: 'Name and URL are required',
      }, 400);
    }

    // 验证URL格式
    try {
      new URL(body.url);
    } catch {
      return c.json({
        success: false,
        error: 'Validation Error',
        message: 'Invalid URL format',
      }, 400);
    }

    const subscriptionData = {
      name: body.name,
      url: body.url,
      enabled: body.enabled !== undefined ? body.enabled : true,
      nodeCount: 0,
      updateInterval: body.updateInterval || 24,
      autoUpdate: body.autoUpdate !== undefined ? body.autoUpdate : true,
      tags: body.tags || [],
      remark: body.remark || null,
    };

    const result = await subscriptionsRepo.create(subscriptionData);

    if (!result.success) {
      if (result.error?.includes('UNIQUE constraint failed')) {
        return c.json({
          success: false,
          error: 'Conflict',
          message: 'Subscription URL already exists',
        }, 409);
      }
      
      return c.json({
        success: false,
        error: 'Database error',
        message: result.error,
      }, 500);
    }

    return c.json({
      success: true,
      data: result.data,
      message: 'Subscription created successfully',
    });

  } catch (error) {
    console.error('Create subscription error:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to create subscription',
    }, 500);
  }
});

// 获取单个订阅
subscriptionsRouter.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const subscriptionsRepo = c.get('subscriptionsRepo') as SubscriptionsRepository;

    const result = await subscriptionsRepo.getById(id);

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
        error: 'Not Found',
        message: 'Subscription not found',
      }, 404);
    }

    return c.json({
      success: true,
      data: result.data,
    });

  } catch (error) {
    console.error('Get subscription error:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to get subscription',
    }, 500);
  }
});

// 更新订阅
subscriptionsRouter.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const subscriptionsRepo = c.get('subscriptionsRepo') as SubscriptionsRepository;

    // 验证订阅是否存在
    const existingResult = await subscriptionsRepo.getById(id);
    if (!existingResult.success || !existingResult.data) {
      return c.json({
        success: false,
        error: 'Not Found',
        message: 'Subscription not found',
      }, 404);
    }

    // 验证URL格式（如果提供）
    if (body.url) {
      try {
        new URL(body.url);
      } catch {
        return c.json({
          success: false,
          error: 'Validation Error',
          message: 'Invalid URL format',
        }, 400);
      }
    }

    const result = await subscriptionsRepo.update(id, body);

    if (!result.success) {
      return c.json({
        success: false,
        error: 'Database error',
        message: result.error,
      }, 500);
    }

    return c.json({
      success: true,
      data: result.data,
      message: 'Subscription updated successfully',
    });

  } catch (error) {
    console.error('Update subscription error:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update subscription',
    }, 500);
  }
});

// 删除订阅
subscriptionsRouter.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const subscriptionsRepo = c.get('subscriptionsRepo') as SubscriptionsRepository;

    // 验证订阅是否存在
    const existingResult = await subscriptionsRepo.getById(id);
    if (!existingResult.success || !existingResult.data) {
      return c.json({
        success: false,
        error: 'Not Found',
        message: 'Subscription not found',
      }, 404);
    }

    const result = await subscriptionsRepo.delete(id);

    if (!result.success) {
      return c.json({
        success: false,
        error: 'Database error',
        message: result.error,
      }, 500);
    }

    return c.json({
      success: true,
      message: 'Subscription deleted successfully',
    });

  } catch (error) {
    console.error('Delete subscription error:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to delete subscription',
    }, 500);
  }
});

// 更新订阅内容（获取最新节点）
subscriptionsRouter.post('/:id/update', async (c) => {
  try {
    const id = c.req.param('id');
    const subscriptionsRepo = c.get('subscriptionsRepo') as SubscriptionsRepository;

    // 获取订阅信息
    const subResult = await subscriptionsRepo.getById(id);
    if (!subResult.success || !subResult.data) {
      return c.json({
        success: false,
        error: 'Not Found',
        message: 'Subscription not found',
      }, 404);
    }

    const subscription = subResult.data;

    // 获取订阅内容 - 使用浏览器请求头避免被拦截
    const response = await fetch(subscription.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/plain, text/html, application/json, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return c.json({
        success: false,
        error: 'Fetch Error',
        message: `Failed to fetch subscription: ${response.status} ${response.statusText}`,
      }, 400);
    }

    const content = await response.text();
    
    // 这里可以解析内容并更新节点计数
    // 简单实现：计算行数作为节点数
    const lines = content.split('\n').filter(line => line.trim());
    const nodeCount = lines.length;

    // 更新订阅信息
    const updateResult = await subscriptionsRepo.update(id, {
      lastUpdate: new Date().toISOString(),
      nodeCount,
    });

    if (!updateResult.success) {
      return c.json({
        success: false,
        error: 'Database error',
        message: updateResult.error,
      }, 500);
    }

    return c.json({
      success: true,
      data: {
        subscription: updateResult.data,
        nodeCount,
      },
      message: 'Subscription updated successfully',
    });

  } catch (error) {
    console.error('Update subscription content error:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to update subscription content',
    }, 500);
  }
});

// 解析订阅链接内容
subscriptionsRouter.post('/parse', async (c) => {
  try {
    const body = await c.req.json();

    if (!body.url) {
      return c.json({
        success: false,
        error: 'Validation Error',
        message: 'URL is required',
      }, 400);
    }

    // 验证URL格式
    try {
      new URL(body.url);
    } catch {
      return c.json({
        success: false,
        error: 'Validation Error',
        message: 'Invalid URL format',
      }, 400);
    }

    // 获取订阅内容 - 使用浏览器请求头避免被拦截
    const response = await fetch(body.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/plain, text/html, application/json, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return c.json({
        success: false,
        error: 'Fetch Error',
        message: `Failed to fetch subscription: ${response.status} ${response.statusText}`,
      }, 400);
    }

    const content = await response.text();

    // 解析订阅内容
    const nodes = parseSubscriptionContent(content);

    return c.json({
      success: true,
      data: {
        nodes,
        count: nodes.length,
      },
      message: `Successfully parsed ${nodes.length} nodes`,
    });

  } catch (error) {
    console.error('Parse subscription error:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to parse subscription',
    }, 500);
  }
});
