import { Context, Next } from 'hono';
import { Env } from '../index';

interface RateLimitInfo {
  count: number;
  resetTime: number;
  lastAccess?: number;
  suspiciousCount?: number;
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

// 订阅专用的反爬虫中间件
export async function antiCrawlerMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  try {
    const clientIP = c.req.header('CF-Connecting-IP') ||
                    c.req.header('X-Forwarded-For') ||
                    c.req.header('X-Real-IP') ||
                    'unknown';

    const userAgent = c.req.header('User-Agent') || '';
    const referer = c.req.header('Referer') || '';
    const now = Date.now();

    // 1. User-Agent 检测
    const validUserAgents = [
      'v2rayN',
      'v2rayNG',
      'Clash',
      'ClashX',
      'ClashForAndroid',
      'Shadowrocket',
      'QuantumultX',
      'Surge',
      'Loon',
      'Stash',
      'Pharos',
      'Kitsunebi',
      'BifrostV',
      'Matsuri',
      'SagerNet',
      'sing-box',
      'Hiddify',
      'FairVPN',
      'OneClick',
      'Streisand'
    ];

    const isValidUserAgent = validUserAgents.some(agent =>
      userAgent.toLowerCase().includes(agent.toLowerCase())
    );

    // 检测可疑的User-Agent
    const suspiciousUserAgents = [
      'curl',
      'wget',
      'python',
      'requests',
      'httpie',
      'postman',
      'insomnia',
      'bot',
      'crawler',
      'spider',
      'scraper'
    ];

    const isSuspiciousUserAgent = suspiciousUserAgents.some(agent =>
      userAgent.toLowerCase().includes(agent.toLowerCase())
    );

    // 2. 访问频率检测（更严格）
    const windowMs = 60 * 1000; // 1分钟窗口
    const maxRequests = 5; // 每分钟最多5个订阅请求
    const key = `anti_crawler:${clientIP}`;

    let accessInfo = rateLimitStore.get(key) || {
      count: 0,
      resetTime: now + windowMs,
      lastAccess: 0,
      suspiciousCount: 0
    };

    // 检查是否需要重置计数器
    if (now > accessInfo.resetTime) {
      accessInfo = {
        count: 1,
        resetTime: now + windowMs,
        lastAccess: now,
        suspiciousCount: accessInfo.suspiciousCount
      };
    } else {
      accessInfo.count++;

      // 3. 检测访问间隔过短（可能是脚本）
      const timeSinceLastAccess = now - accessInfo.lastAccess;
      if (timeSinceLastAccess < 5000) { // 5秒内重复访问
        accessInfo.suspiciousCount++;
      }

      accessInfo.lastAccess = now;
    }

    // 4. 综合判断是否为爬虫
    let isCrawler = false;
    let reason = '';

    if (isSuspiciousUserAgent) {
      isCrawler = true;
      reason = 'Suspicious User-Agent detected';
    } else if (!isValidUserAgent && userAgent.length > 0) {
      // 如果不是已知的代理客户端，但有User-Agent，增加可疑度
      accessInfo.suspiciousCount++;
    }

    if (accessInfo.count > maxRequests) {
      isCrawler = true;
      reason = 'Rate limit exceeded';
    }

    if (accessInfo.suspiciousCount > 3) {
      isCrawler = true;
      reason = 'Suspicious access pattern detected';
    }

    // 5. 如果检测到爬虫，返回错误或空内容
    if (isCrawler) {
      console.log(`🚫 [反爬虫] 检测到爬虫访问: IP=${clientIP}, UA=${userAgent}, 原因=${reason}`);

      // 更新访问信息
      rateLimitStore.set(key, accessInfo);

      // 返回看起来正常但实际为空的订阅内容
      return c.text('', 200, {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="subscription.txt"',
        'Cache-Control': 'no-cache',
      });
    }

    // 6. 记录正常访问
    console.log(`✅ [反爬虫] 正常访问: IP=${clientIP}, UA=${userAgent}`);
    rateLimitStore.set(key, accessInfo);

    // 清理过期的条目
    setTimeout(() => {
      if (rateLimitStore.get(key) === accessInfo && now > accessInfo.resetTime) {
        rateLimitStore.delete(key);
      }
    }, windowMs + 10000);

    return next();

  } catch (error) {
    console.error('Anti-crawler middleware error:', error);
    // 如果反爬虫检测出错，继续处理请求
    return next();
  }
}
