import { Context, Next } from 'hono';
import { Env } from '../index';

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

// 内存存储速率限制信息（仅在单个Worker实例生命周期内有效）
// 注意：在Cloudflare Workers中，这个存储在Worker重启后会丢失
// 生产环境建议使用Cloudflare KV或D1数据库存储速率限制信息
const rateLimitStore = new Map<string, RateLimitInfo>();

export async function rateLimitMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  try {
    const clientIP = c.req.header('CF-Connecting-IP') ||
                    c.req.header('X-Forwarded-For') ||
                    c.req.header('X-Real-IP') ||
                    'unknown';

    const now = Date.now();
    const windowMs = 60 * 1000; // 1分钟窗口
    const maxRequests = 100; // 每分钟最多100个请求

    const key = `rate_limit:${clientIP}`;

    // 从内存获取当前速率限制信息
    let rateLimitInfo = rateLimitStore.get(key);

    if (rateLimitInfo) {
      // 检查是否需要重置计数器
      if (now > rateLimitInfo.resetTime) {
        rateLimitInfo = {
          count: 1,
          resetTime: now + windowMs,
        };
      } else {
        rateLimitInfo.count++;
      }
    } else {
      rateLimitInfo = {
        count: 1,
        resetTime: now + windowMs,
      };
    }
    
    // 检查是否超过限制
    if (rateLimitInfo.count > maxRequests) {
      const retryAfter = Math.ceil((rateLimitInfo.resetTime - now) / 1000);
      
      return c.json({
        success: false,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter,
      }, 429, {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimitInfo.resetTime.toString(),
      });
    }
    
    // 更新内存中的速率限制信息
    rateLimitStore.set(key, rateLimitInfo);

    // 清理过期的条目
    setTimeout(() => {
      if (rateLimitStore.get(key) === rateLimitInfo && now > rateLimitInfo.resetTime) {
        rateLimitStore.delete(key);
      }
    }, windowMs + 10000);
    
    // 添加速率限制头部
    const remaining = Math.max(0, maxRequests - rateLimitInfo.count);
    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', rateLimitInfo.resetTime.toString());
    
    return next();
    
  } catch (error) {
    console.error('Rate limit middleware error:', error);
    // 如果速率限制出错，继续处理请求
    return next();
  }
}

// 订阅专用的速率限制 (更宽松)
export async function subscriptionRateLimitMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  try {
    const clientIP = c.req.header('CF-Connecting-IP') ||
                    c.req.header('X-Forwarded-For') ||
                    c.req.header('X-Real-IP') ||
                    'unknown';

    const now = Date.now();
    const windowMs = 60 * 1000; // 1分钟窗口
    const maxRequests = 10; // 每分钟最多10个订阅请求

    const key = `sub_rate_limit:${clientIP}`;

    let rateLimitInfo = rateLimitStore.get(key);

    if (rateLimitInfo) {
      if (now > rateLimitInfo.resetTime) {
        rateLimitInfo = {
          count: 1,
          resetTime: now + windowMs,
        };
      } else {
        rateLimitInfo.count++;
      }
    } else {
      rateLimitInfo = {
        count: 1,
        resetTime: now + windowMs,
      };
    }
    
    if (rateLimitInfo.count > maxRequests) {
      const retryAfter = Math.ceil((rateLimitInfo.resetTime - now) / 1000);
      
      return c.text('Rate limit exceeded for subscription requests', 429, {
        'Retry-After': retryAfter.toString(),
      });
    }
    
    // 更新内存中的速率限制信息
    rateLimitStore.set(key, rateLimitInfo);

    // 清理过期的条目
    setTimeout(() => {
      if (rateLimitStore.get(key) === rateLimitInfo && now > rateLimitInfo.resetTime) {
        rateLimitStore.delete(key);
      }
    }, windowMs + 10000);
    
    return next();
    
  } catch (error) {
    console.error('Subscription rate limit middleware error:', error);
    return next();
  }
}
