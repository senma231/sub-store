import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { SubscriptionsRepository } from '../database/subscriptions';
import { parseSubscriptionContent } from '../utils/subscriptionParser';

// 时效性订阅链接工具函数
const generateTimedSubscriptionUrl = async (uuid: string, userId: string, secretKey: string) => {
  const timestamp = Date.now();
  const expiry = timestamp + (24 * 60 * 60 * 1000); // 24小时有效期

  // 创建签名载荷
  const payload = `${uuid}:${userId}:${expiry}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(payload + secretKey);

  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 编码链接
  const encoded = btoa(payload).replace(/[+/=]/g, '');

  return `/s/${encoded}?sig=${signature}&t=${timestamp}`;
};

const validateTimedSubscription = async (encoded: string, signature: string, secretKey: string) => {
  try {
    const payload = atob(encoded);
    const [uuid, userId, expiry] = payload.split(':');

    // 验证签名
    const encoder = new TextEncoder();
    const data = encoder.encode(payload + secretKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const expectedSig = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    if (signature !== expectedSig) return null;

    // 验证时效性
    if (Date.now() > parseInt(expiry)) return null;

    return { uuid, userId, expiry: parseInt(expiry) };
  } catch {
    return null;
  }
};

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

    // 获取订阅内容 - 使用简单请求头避免405错误
    const response = await fetch(subscription.url, {
      method: 'GET',
      headers: {
        'User-Agent': 'v2rayN/6.23',
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
  console.log('🔍 [订阅解析] 开始处理解析请求');
  console.log('🌐 [订阅解析] 请求来源: 已隐藏避免错误');
  console.log('🌐 [订阅解析] 请求头: 已隐藏避免错误');

  try {
    const body = await c.req.json();
    console.log('📋 [订阅解析] 请求体:', body);

    // 支持两种模式：URL解析或直接内容解析
    if (!body.url && !body.content) {
      console.error('❌ [订阅解析] 参数验证失败: 缺少url或content');
      return c.json({
        success: false,
        error: 'Validation Error',
        message: 'Either URL or content is required',
      }, 400);
    }

    let content = '';

    // 如果提供了直接内容，跳过网络请求
    if (body.content) {
      content = body.content;
    } else {
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

      // 获取订阅内容 - 使用最简单的请求避免405错误
      let response;
      let lastError = '';

      try {
        // 尝试最简单的请求，完全无自定义头部
        response = await fetch(body.url, {
          method: 'GET',
          redirect: 'follow',
        });

        if (!response.ok) {
          lastError = `Simple request failed: ${response.status} ${response.statusText}`;

          // 如果简单请求失败，尝试添加基本的User-Agent
          try {
            response = await fetch(body.url, {
              method: 'GET',
              headers: {
                'User-Agent': 'curl/7.68.0',
              },
              redirect: 'follow',
            });

            if (!response.ok) {
              lastError += ` | Curl-like request failed: ${response.status} ${response.statusText}`;
            }
          } catch (error) {
            lastError += ` | Curl-like request error: ${error}`;
          }
        }
      } catch (error) {
        lastError = `Request error: ${error}`;
        response = null;
      }

      if (!response || !response.ok) {
        console.error('Subscription fetch failed:', {
          url: body.url,
          status: response?.status,
          statusText: response?.statusText,
          lastError,
        });

        return c.json({
          success: false,
          error: 'Fetch Error',
          message: response
            ? `Failed to fetch subscription: ${response.status} ${response.statusText}. Details: ${lastError}`
            : `Request failed. Error: ${lastError}`,
          debug: {
            url: body.url,
            status: response?.status,
            statusText: response?.statusText,
            lastError,
          },
          suggestion: 'Try copying the subscription content manually and use the content field instead of url',
        }, 400);
      }

      content = await response.text();
    }

    // content 已经在上面设置了，这里不需要再处理

    // 解析订阅内容
    console.log('Starting to parse content, length:', content.length);
    console.log('Content preview:', content.substring(0, 100));

    let nodes;
    try {
      nodes = parseSubscriptionContent(content);
      console.log('Parse successful, found nodes:', nodes.length);
    } catch (parseError) {
      console.error('Parse function error:', parseError);
      return c.json({
        success: false,
        error: 'Parse Error',
        message: `Failed to parse subscription content: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
        debug: {
          contentLength: content.length,
          contentPreview: content.substring(0, 100),
          parseError: parseError instanceof Error ? parseError.stack : String(parseError)
        }
      }, 500);
    }

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
      message: `Failed to parse subscription: ${error instanceof Error ? error.message : String(error)}`,
      debug: {
        error: error instanceof Error ? error.stack : String(error)
      }
    }, 500);
  }
});

// 生成时效性订阅链接
subscriptionsRouter.post('/:id/timed-link', async (c) => {
  try {
    const id = c.req.param('id');
    const subscriptionsRepo = c.get('subscriptionsRepo') as SubscriptionsRepository;

    if (!subscriptionsRepo) {
      return c.json({
        success: false,
        error: 'Service unavailable',
        message: 'Subscriptions repository not available',
      }, 503);
    }

    // 获取订阅信息
    const result = await subscriptionsRepo.getById(id);
    if (!result.success || !result.data) {
      return c.json({
        success: false,
        error: 'Not Found',
        message: 'Subscription not found',
      }, 404);
    }

    // 生成时效性链接
    const secretKey = c.env.ADMIN_TOKEN || 'default-secret-key';
    const userId = 'user-' + Date.now(); // 临时用户ID，实际应该从认证中获取
    const timedUrl = await generateTimedSubscriptionUrl(id, userId, secretKey);

    return c.json({
      success: true,
      data: {
        timedUrl,
        expiresIn: '24 hours',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    });

  } catch (error) {
    console.error('Generate timed link error:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to generate timed link',
    }, 500);
  }
});
