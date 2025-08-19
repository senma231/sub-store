/**
 * 订阅链接专用安全机制
 * 专门针对节点订阅进行加密保护，不影响其他功能
 */

// 访问频率限制配置
interface RateLimitConfig {
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  blockDurationMinutes: number;
}

// 访问记录
interface AccessRecord {
  ip: string;
  timestamp: number;
  count: number;
  blocked: boolean;
  blockUntil?: number;
}

// 内存中的访问记录存储（生产环境应使用Redis或数据库）
const accessRecords = new Map<string, AccessRecord>();

// 默认频率限制配置
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequestsPerHour: 60,    // 每小时最多60次请求
  maxRequestsPerDay: 500,    // 每天最多500次请求
  blockDurationMinutes: 60   // 违规后阻止60分钟
};

// 节点内容加密
export function encryptNodeContent(nodeContent: string, secret: string): string {
  try {
    // 使用简单的异或加密 + Base64编码
    let encrypted = '';
    for (let i = 0; i < nodeContent.length; i++) {
      const keyChar = secret.charCodeAt(i % secret.length);
      const contentChar = nodeContent.charCodeAt(i);
      encrypted += String.fromCharCode(contentChar ^ keyChar);
    }
    
    // Base64编码并URL安全化
    return btoa(encrypted)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } catch (error) {
    console.error('节点加密失败:', error);
    return nodeContent; // 失败时返回原内容
  }
}

// 节点内容解密
export function decryptNodeContent(encryptedContent: string, secret: string): string {
  try {
    // 恢复Base64格式
    let base64 = encryptedContent
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    // 补充Base64填充
    while (base64.length % 4) {
      base64 += '=';
    }
    
    const encrypted = atob(base64);
    
    // 使用密钥进行解密
    let decrypted = '';
    for (let i = 0; i < encrypted.length; i++) {
      const keyChar = secret.charCodeAt(i % secret.length);
      const encryptedChar = encrypted.charCodeAt(i);
      decrypted += String.fromCharCode(encryptedChar ^ keyChar);
    }
    
    return decrypted;
  } catch (error) {
    console.error('节点解密失败:', error);
    return encryptedContent; // 失败时返回原内容
  }
}

// 生成动态订阅链接
export function generateSecureSubscriptionUrl(uuid: string, format: string, baseUrl: string, secret: string): string {
  try {
    const timestamp = Date.now();
    const data = `${uuid}:${format}:${timestamp}`;
    
    // 生成签名
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    const signature = Math.abs(hash).toString(36);
    const token = btoa(`${data}:${signature}`).replace(/=/g, '');
    
    return `${baseUrl}/secure/${token}/${format}`;
  } catch (error) {
    console.error('生成安全订阅链接失败:', error);
    return `${baseUrl}/subscriptions/${uuid}/${format}`;
  }
}

// 验证并解析安全订阅链接
export function parseSecureSubscriptionUrl(token: string, secret: string): { uuid: string; format: string; timestamp: number } | null {
  try {
    // Base64解码
    const decoded = atob(token + '=='.slice(0, (4 - token.length % 4) % 4));
    const parts = decoded.split(':');
    
    if (parts.length !== 4) {
      return null;
    }
    
    const uuid = parts[0];
    const format = parts[1];
    const timestamp = parseInt(parts[2], 10);
    const signature = parts[3];
    
    if (isNaN(timestamp)) {
      return null;
    }
    
    // 验证时间戳（24小时有效期）
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    
    if (now - timestamp > maxAge) {
      console.log('🚫 [订阅安全] 链接已过期');
      return null;
    }
    
    // 验证签名
    const data = `${uuid}:${format}:${timestamp}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    const expectedSignature = Math.abs(hash).toString(36);
    
    if (signature !== expectedSignature) {
      console.log('🚫 [订阅安全] 签名验证失败');
      return null;
    }
    
    return { uuid, format, timestamp };
  } catch (error) {
    console.error('解析安全订阅链接失败:', error);
    return null;
  }
}

// 检查访问频率限制
function checkRateLimit(ip: string, config: RateLimitConfig = DEFAULT_RATE_LIMIT): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const oneHourAgo = now - (60 * 60 * 1000);
  const oneDayAgo = now - (24 * 60 * 60 * 1000);

  let record = accessRecords.get(ip);

  if (!record) {
    // 首次访问，创建记录
    record = {
      ip,
      timestamp: now,
      count: 1,
      blocked: false
    };
    accessRecords.set(ip, record);
    return { allowed: true };
  }

  // 检查是否在阻止期内
  if (record.blocked && record.blockUntil && now < record.blockUntil) {
    return {
      allowed: false,
      reason: `IP blocked until ${new Date(record.blockUntil).toISOString()}`
    };
  }

  // 清除阻止状态（如果已过期）
  if (record.blocked && record.blockUntil && now >= record.blockUntil) {
    record.blocked = false;
    record.blockUntil = undefined;
    record.count = 1;
    record.timestamp = now;
    return { allowed: true };
  }

  // 计算最近一小时的访问次数
  const hourlyCount = getAccessCountInTimeRange(ip, oneHourAgo, now);
  const dailyCount = getAccessCountInTimeRange(ip, oneDayAgo, now);

  // 检查小时限制
  if (hourlyCount >= config.maxRequestsPerHour) {
    record.blocked = true;
    record.blockUntil = now + (config.blockDurationMinutes * 60 * 1000);
    return {
      allowed: false,
      reason: `Hourly limit exceeded: ${hourlyCount}/${config.maxRequestsPerHour}`
    };
  }

  // 检查日限制
  if (dailyCount >= config.maxRequestsPerDay) {
    record.blocked = true;
    record.blockUntil = now + (config.blockDurationMinutes * 60 * 1000);
    return {
      allowed: false,
      reason: `Daily limit exceeded: ${dailyCount}/${config.maxRequestsPerDay}`
    };
  }

  // 更新访问记录
  record.count++;
  record.timestamp = now;

  return { allowed: true };
}

// 获取指定时间范围内的访问次数
function getAccessCountInTimeRange(ip: string, startTime: number, endTime: number): number {
  // 简化实现：在生产环境中应该使用更精确的时间窗口计算
  const record = accessRecords.get(ip);
  if (!record) return 0;

  // 如果记录在时间范围内，返回计数
  if (record.timestamp >= startTime && record.timestamp <= endTime) {
    return record.count;
  }

  return 0;
}

// 订阅专用的反爬中间件（只针对订阅路径）
export function createSubscriptionAntiCrawlerMiddleware() {
  return async (c: any, next: any) => {
    const path = c.req.path;
    const userAgent = c.req.header('User-Agent') || '';
    const clientIP = c.req.header('CF-Connecting-IP') ||
                    c.req.header('X-Forwarded-For') ||
                    c.req.header('X-Real-IP') ||
                    'unknown';
    const db = c.get('db');

    // 只对订阅路径进行检查
    const isSubscriptionPath = path.includes('/subscriptions/') || path.includes('/secure/') || path.includes('/sub/');

    if (!isSubscriptionPath) {
      return next(); // 非订阅路径直接通过
    }

    // 检查访问频率限制
    const rateLimitResult = checkRateLimit(clientIP);
    if (!rateLimitResult.allowed) {
      console.log(`🚫 [订阅安全] 访问频率超限: ${clientIP} - ${rateLimitResult.reason}`);

      // 记录被阻止的访问
      if (db) {
        await recordBlockedAccess(db, clientIP, userAgent, path, rateLimitResult.reason || 'Rate limit exceeded');
      }

      return c.text('Too Many Requests', 429, {
        'Retry-After': '3600', // 1小时后重试
        'Content-Type': 'text/plain'
      });
    }

    // 检查User-Agent是否为已知的代理客户端
    const validUserAgents = [
      'v2rayN', 'v2rayNG', 'Clash', 'ClashX', 'ClashForAndroid',
      'Shadowrocket', 'QuantumultX', 'Surge', 'Loon', 'Stash',
      'Pharos', 'Kitsunebi', 'BifrostV', 'Matsuri', 'SagerNet',
      'sing-box', 'Hiddify', 'FairVPN', 'OneClick', 'Streisand'
    ];

    const isValidUserAgent = validUserAgents.some(agent => 
      userAgent.toLowerCase().includes(agent.toLowerCase())
    );

    // 检测可疑的User-Agent
    const suspiciousUserAgents = [
      'curl', 'wget', 'python', 'requests', 'httpie', 'postman'
    ];

    const isSuspiciousUserAgent = suspiciousUserAgents.some(agent => 
      userAgent.toLowerCase().includes(agent.toLowerCase())
    );

    if (isSuspiciousUserAgent) {
      console.log(`🚫 [订阅安全] 检测到可疑User-Agent: ${clientIP} - ${userAgent}`);
      // 记录可疑访问
      if (db) {
        await recordSuspiciousAccess(db, clientIP, userAgent, path, 'suspicious_user_agent');
      }
      // 返回空订阅内容，不暴露错误信息
      return c.text('', 200, {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="subscription.txt"',
      });
    }

    // 如果不是已知的代理客户端，记录但允许通过（可能是新客户端）
    if (!isValidUserAgent && userAgent.length > 0) {
      console.log(`⚠️ [订阅安全] 未知User-Agent访问订阅: ${clientIP} - ${userAgent}`);
      if (db) {
        await recordSuspiciousAccess(db, clientIP, userAgent, path, 'unknown_user_agent');
      }
    }

    // 记录正常访问
    if (db) {
      await recordNormalAccess(db, clientIP, userAgent, path);
    }

    return next();
  };
}

// 记录访问日志到数据库
async function recordAccessLog(
  db: any,
  ip: string,
  userAgent: string,
  path: string,
  status: 'allowed' | 'blocked' | 'suspicious',
  reason?: string,
  subscriptionId?: string
) {
  try {
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // 获取国家信息（如果可用）
    let country = 'unknown';
    try {
      // Cloudflare Workers 提供的国家信息
      country = globalThis.cf?.country || 'unknown';
    } catch (error) {
      // 忽略错误，使用默认值
    }

    await db.prepare(`
      INSERT INTO access_logs (id, ip, user_agent, country, timestamp, status, reason, subscription_id, path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, ip, userAgent, country, timestamp, status, reason, subscriptionId, path).run();

    console.log(`📝 [访问日志] ${timestamp} - ${status}: IP=${ip}, 国家=${country}, 路径=${path}`);

  } catch (error) {
    console.error('记录访问日志失败:', error);
  }
}

// 记录可疑访问
async function recordSuspiciousAccess(db: any, ip: string, userAgent: string, path: string, reason: string) {
  const timestamp = new Date().toISOString();
  console.log(`🚨 [安全日志] ${timestamp} - 可疑访问: IP=${ip}, UA=${userAgent}, 原因=${reason}`);

  await recordAccessLog(db, ip, userAgent, path, 'suspicious', reason);
}

// 记录正常访问
async function recordNormalAccess(db: any, ip: string, userAgent: string, path: string) {
  const timestamp = new Date().toISOString();
  console.log(`✅ [访问日志] ${timestamp} - 正常访问: IP=${ip}, UA=${userAgent}, 路径=${path}`);

  await recordAccessLog(db, ip, userAgent, path, 'allowed');
}

// 记录被阻止的访问
async function recordBlockedAccess(db: any, ip: string, userAgent: string, path: string, reason: string) {
  const timestamp = new Date().toISOString();
  console.log(`🚫 [安全日志] ${timestamp} - 阻止访问: IP=${ip}, UA=${userAgent}, 原因=${reason}`);

  await recordAccessLog(db, ip, userAgent, path, 'blocked', reason);
}

// 节点混淆处理
export function obfuscateNodeConfig(nodeConfig: string): string {
  try {
    // 对节点配置进行混淆处理
    const lines = nodeConfig.split('\n');
    const obfuscatedLines = lines.map(line => {
      if (line.trim() === '') return line;
      
      // 添加随机注释和空行来混淆
      const shouldAddComment = Math.random() > 0.7;
      if (shouldAddComment) {
        const comments = [
          '# Generated by Sub-Store',
          '# Updated: ' + new Date().toISOString(),
          '# Version: 2.0.0'
        ];
        return line + '\n' + comments[Math.floor(Math.random() * comments.length)];
      }
      
      return line;
    });
    
    return obfuscatedLines.join('\n');
  } catch (error) {
    console.error('节点混淆失败:', error);
    return nodeConfig;
  }
}

// 生成诱饵节点（用于迷惑爬虫）
export function generateDecoyNodes(count: number = 3): string[] {
  const decoyNodes = [];
  
  for (let i = 0; i < count; i++) {
    const decoyNode = `vmess://eyJ2IjoiMiIsInBzIjoi6K+35LiN6KaB6K+V6K+VIiwiYWRkIjoiMTI3LjAuMC4xIiwicG9ydCI6IjgwODAiLCJpZCI6IjAwMDAwMDAwLTAwMDAtMDAwMC0wMDAwLTAwMDAwMDAwMDAwMCIsImFpZCI6IjAiLCJzY3kiOiJhdXRvIiwibmV0IjoidGNwIiwidHlwZSI6Im5vbmUiLCJob3N0IjoiIiwicGF0aCI6IiIsInRscyI6IiIsInNuaSI6IiJ9`;
    decoyNodes.push(decoyNode);
  }
  
  return decoyNodes;
}
