/**
 * 安全中间件
 * 包括IP白名单/黑名单、DDoS防护、恶意请求检测等
 */

import { Context, Next } from 'hono';
import type { Env } from '../types';
import { isValidIP, isPrivateIP } from '../utils/security';

// 内存存储安全信息
interface SecurityInfo {
  requestCount: number;
  lastRequest: number;
  suspiciousCount: number;
  blockedUntil?: number;
  userAgents: Set<string>;
}

const securityStore = new Map<string, SecurityInfo>();

// 已知的恶意IP黑名单（示例）
const IP_BLACKLIST = new Set([
  // 可以添加已知的恶意IP
]);

// 可信IP白名单（示例）
const IP_WHITELIST = new Set([
  '127.0.0.1',
  '::1',
  // 可以添加可信的IP
]);

// 恶意User-Agent黑名单
const MALICIOUS_USER_AGENTS = [
  'masscan',
  'nmap',
  'sqlmap',
  'nikto',
  'dirb',
  'dirbuster',
  'gobuster',
  'wfuzz',
  'burpsuite',
  'owasp zap',
  'acunetix',
  'nessus',
  'openvas',
  'metasploit',
  'havij',
  'pangolin',
  'jsql',
  'commix'
];

// DDoS防护中间件
export async function ddosProtectionMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  try {
    const clientIP = c.req.header('CF-Connecting-IP') ||
                    c.req.header('X-Forwarded-For') ||
                    c.req.header('X-Real-IP') ||
                    'unknown';

    const userAgent = c.req.header('User-Agent') || '';
    const now = Date.now();

    // 1. 检查IP黑名单
    if (IP_BLACKLIST.has(clientIP)) {
      console.log(`🚫 [安全] IP在黑名单中: ${clientIP}`);
      return c.text('Access denied', 403);
    }

    // 2. 白名单IP直接通过
    if (IP_WHITELIST.has(clientIP) || isPrivateIP(clientIP)) {
      return next();
    }

    // 3. 检查恶意User-Agent
    const lowerUserAgent = userAgent.toLowerCase();
    const isMaliciousUA = MALICIOUS_USER_AGENTS.some(malicious => 
      lowerUserAgent.includes(malicious)
    );

    if (isMaliciousUA) {
      console.log(`🚫 [安全] 检测到恶意User-Agent: ${clientIP} - ${userAgent}`);
      return c.text('Access denied', 403);
    }

    // 4. 获取或创建安全信息
    let securityInfo = securityStore.get(clientIP);
    if (!securityInfo) {
      securityInfo = {
        requestCount: 0,
        lastRequest: 0,
        suspiciousCount: 0,
        userAgents: new Set()
      };
    }

    // 5. 检查是否被临时封禁
    if (securityInfo.blockedUntil && now < securityInfo.blockedUntil) {
      const remainingTime = Math.ceil((securityInfo.blockedUntil - now) / 1000);
      console.log(`🚫 [安全] IP被临时封禁: ${clientIP}, 剩余时间: ${remainingTime}秒`);
      return c.text(`Access temporarily blocked. Try again in ${remainingTime} seconds.`, 429);
    }

    // 6. 重置计数器（每分钟）
    const windowMs = 60 * 1000; // 1分钟窗口
    if (now - securityInfo.lastRequest > windowMs) {
      securityInfo.requestCount = 0;
      securityInfo.suspiciousCount = 0;
      securityInfo.userAgents.clear();
    }

    // 7. 更新请求信息
    securityInfo.requestCount++;
    securityInfo.lastRequest = now;
    securityInfo.userAgents.add(userAgent);

    // 8. DDoS检测
    const maxRequestsPerMinute = 30; // 每分钟最多30个请求
    if (securityInfo.requestCount > maxRequestsPerMinute) {
      securityInfo.suspiciousCount++;
      console.log(`⚠️ [安全] 检测到高频请求: ${clientIP}, 请求数: ${securityInfo.requestCount}`);
    }

    // 9. 检测User-Agent变化（可能是脚本）
    if (securityInfo.userAgents.size > 5) {
      securityInfo.suspiciousCount++;
      console.log(`⚠️ [安全] 检测到User-Agent频繁变化: ${clientIP}, 数量: ${securityInfo.userAgents.size}`);
    }

    // 10. 检测请求间隔过短
    const timeSinceLastRequest = now - securityInfo.lastRequest;
    if (timeSinceLastRequest < 1000 && securityInfo.requestCount > 1) { // 1秒内重复请求
      securityInfo.suspiciousCount++;
      console.log(`⚠️ [安全] 检测到高频请求: ${clientIP}, 间隔: ${timeSinceLastRequest}ms`);
    }

    // 11. 根据可疑度决定是否封禁
    if (securityInfo.suspiciousCount > 5) {
      // 临时封禁15分钟
      securityInfo.blockedUntil = now + 15 * 60 * 1000;
      console.log(`🚫 [安全] 临时封禁IP: ${clientIP}, 可疑度: ${securityInfo.suspiciousCount}`);
      
      securityStore.set(clientIP, securityInfo);
      return c.text('Access temporarily blocked due to suspicious activity', 429);
    }

    // 12. 如果请求过于频繁，返回429
    if (securityInfo.requestCount > maxRequestsPerMinute) {
      securityStore.set(clientIP, securityInfo);
      return c.text('Too many requests', 429);
    }

    // 13. 更新安全信息
    securityStore.set(clientIP, securityInfo);

    // 14. 清理过期的安全信息
    setTimeout(() => {
      const currentInfo = securityStore.get(clientIP);
      if (currentInfo && now - currentInfo.lastRequest > 60 * 60 * 1000) { // 1小时后清理
        securityStore.delete(clientIP);
      }
    }, 60 * 60 * 1000);

    return next();

  } catch (error) {
    console.error('DDoS protection middleware error:', error);
    // 如果安全检测出错，继续处理请求
    return next();
  }
}

// 获取安全统计信息
export function getSecurityStats() {
  const stats = {
    totalIPs: securityStore.size,
    blockedIPs: 0,
    suspiciousIPs: 0,
    totalRequests: 0
  };

  for (const [ip, info] of securityStore.entries()) {
    if (info.blockedUntil && Date.now() < info.blockedUntil) {
      stats.blockedIPs++;
    }
    if (info.suspiciousCount > 2) {
      stats.suspiciousIPs++;
    }
    stats.totalRequests += info.requestCount;
  }

  return stats;
}

// 手动添加IP到黑名单
export function addToBlacklist(ip: string) {
  if (isValidIP(ip)) {
    IP_BLACKLIST.add(ip);
    console.log(`🚫 [安全] IP已添加到黑名单: ${ip}`);
    return true;
  }
  return false;
}

// 手动添加IP到白名单
export function addToWhitelist(ip: string) {
  if (isValidIP(ip)) {
    IP_WHITELIST.add(ip);
    console.log(`✅ [安全] IP已添加到白名单: ${ip}`);
    return true;
  }
  return false;
}

// 清除IP的安全记录
export function clearSecurityRecord(ip: string) {
  securityStore.delete(ip);
  console.log(`🧹 [安全] 已清除IP的安全记录: ${ip}`);
}

// 敏感信息过滤中间件
export async function sensitiveInfoProtectionMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  try {
    // 执行下一个中间件
    await next();

    // 检查响应内容是否包含敏感信息
    const response = c.res;
    const contentType = response.headers.get('content-type') || '';
    const path = c.req.path;

    // 跳过登录和认证相关的响应，这些需要返回token
    const authPaths = ['/auth/login', '/auth/refresh', '/auth/verify'];
    const isAuthPath = authPaths.some(authPath => path.includes(authPath));

    if (isAuthPath) {
      console.log(`🔐 [安全] 跳过认证路径的敏感信息过滤: ${path}`);
      return; // 不过滤认证相关的响应
    }

    // 只处理JSON响应
    if (contentType.includes('application/json')) {
      const responseText = await response.text();

      // 检查是否包含敏感信息
      const sensitivePatterns = [
        /password/gi,
        /secret/gi,
        /token.*[A-Za-z0-9]{20,}/gi,
        /key.*[A-Za-z0-9]{20,}/gi,
        /api.*key/gi,
        /private.*key/gi,
        /jwt.*secret/gi,
        /database.*url/gi,
        /connection.*string/gi
      ];

      let filteredResponse = responseText;
      let hasSensitiveInfo = false;

      for (const pattern of sensitivePatterns) {
        if (pattern.test(responseText)) {
          hasSensitiveInfo = true;
          filteredResponse = filteredResponse.replace(pattern, '[REDACTED]');
        }
      }

      if (hasSensitiveInfo) {
        console.log(`⚠️ [安全] 检测到响应中包含敏感信息，已过滤: ${path}`);

        // 创建新的响应
        const newResponse = new Response(filteredResponse, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });

        // 替换响应
        c.res = newResponse;
      }
    }

  } catch (error) {
    console.error('Sensitive info protection middleware error:', error);
    // 如果出错，继续处理请求
  }
}

// API访问限制中间件
export async function apiAccessControlMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  try {
    const path = c.req.path;
    const method = c.req.method;
    const userAgent = c.req.header('User-Agent') || '';
    const clientIP = c.req.header('CF-Connecting-IP') ||
                    c.req.header('X-Forwarded-For') ||
                    c.req.header('X-Real-IP') ||
                    'unknown';

    // 检查是否为敏感API端点
    const sensitiveEndpoints = [
      '/api/migration',
      '/api/security',
      '/api/manage',
      '/auth/register',
      '/api/users'
    ];

    const isSensitiveEndpoint = sensitiveEndpoints.some(endpoint =>
      path.startsWith(endpoint)
    );

    if (isSensitiveEndpoint) {
      // 对敏感端点进行额外的安全检查

      // 1. 检查User-Agent是否为已知的管理工具
      const adminUserAgents = [
        'AdminPanel',
        'SubStoreAdmin',
        'Mozilla/5.0' // 允许浏览器访问
      ];

      const isValidAdminUA = adminUserAgents.some(agent =>
        userAgent.includes(agent)
      );

      if (!isValidAdminUA && !userAgent.includes('Mozilla')) {
        console.log(`🚫 [安全] 敏感端点访问被拒绝: ${path}, IP: ${clientIP}, UA: ${userAgent}`);
        return c.json({
          success: false,
          error: 'Access denied',
          message: 'This endpoint requires administrative access'
        }, 403);
      }

      // 2. 记录敏感操作
      console.log(`🔐 [安全] 敏感端点访问: ${method} ${path}, IP: ${clientIP}, UA: ${userAgent}`);
    }

    return next();

  } catch (error) {
    console.error('API access control middleware error:', error);
    return next();
  }
}

// 脚本扫描防护中间件
export async function antiScanningMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  try {
    const path = c.req.path;
    const method = c.req.method;
    const userAgent = c.req.header('User-Agent') || '';
    const clientIP = c.req.header('CF-Connecting-IP') ||
                    c.req.header('X-Forwarded-For') ||
                    c.req.header('X-Real-IP') ||
                    'unknown';

    // 检测常见的扫描路径
    const scanningPaths = [
      '/admin',
      '/administrator',
      '/wp-admin',
      '/wp-login',
      '/login.php',
      '/admin.php',
      '/phpmyadmin',
      '/mysql',
      '/database',
      '/config',
      '/backup',
      '/test',
      '/debug',
      '/api/v1',
      '/api/v2',
      '/swagger',
      '/docs',
      '/graphql',
      '/.env',
      '/.git',
      '/robots.txt',
      '/sitemap.xml',
      '/crossdomain.xml',
      '/favicon.ico'
    ];

    const isScanningPath = scanningPaths.some(scanPath =>
      path.toLowerCase().includes(scanPath.toLowerCase())
    );

    // 检测扫描工具的User-Agent
    const scanningUserAgents = [
      'nmap',
      'masscan',
      'zmap',
      'sqlmap',
      'nikto',
      'dirb',
      'dirbuster',
      'gobuster',
      'wfuzz',
      'burpsuite',
      'owasp zap',
      'acunetix',
      'nessus',
      'openvas',
      'metasploit',
      'havij',
      'pangolin',
      'jsql',
      'commix',
      'w3af',
      'skipfish',
      'arachni',
      'vega',
      'webscarab'
    ];

    const isScanningUA = scanningUserAgents.some(scanner =>
      userAgent.toLowerCase().includes(scanner)
    );

    // 检测可疑的请求模式
    const suspiciousPatterns = [
      /\.\./g, // 目录遍历
      /union.*select/gi, // SQL注入
      /<script/gi, // XSS
      /javascript:/gi, // XSS
      /eval\(/gi, // 代码注入
      /exec\(/gi, // 命令注入
      /system\(/gi, // 命令注入
      /passthru\(/gi, // 命令注入
      /shell_exec\(/gi, // 命令注入
      /base64_decode\(/gi, // 编码攻击
      /file_get_contents\(/gi, // 文件包含
      /include\(/gi, // 文件包含
      /require\(/gi, // 文件包含
    ];

    const hasSuspiciousPattern = suspiciousPatterns.some(pattern =>
      pattern.test(path) || pattern.test(c.req.query().toString())
    );

    // 如果检测到扫描行为
    if (isScanningPath || isScanningUA || hasSuspiciousPattern) {
      let reason = '';
      if (isScanningPath) reason += '扫描路径 ';
      if (isScanningUA) reason += '扫描工具 ';
      if (hasSuspiciousPattern) reason += '可疑模式 ';

      console.log(`🚫 [反扫描] 检测到扫描行为: ${reason.trim()}, IP: ${clientIP}, Path: ${path}, UA: ${userAgent}`);

      // 记录扫描尝试
      const scanKey = `scan_attempt:${clientIP}`;
      let scanInfo = securityStore.get(scanKey) || { count: 0, lastScan: 0, suspiciousCount: 0 };

      scanInfo.count++;
      scanInfo.lastScan = Date.now();
      scanInfo.suspiciousCount++;

      securityStore.set(scanKey, scanInfo);

      // 如果扫描次数过多，临时封禁
      if (scanInfo.count > 10) {
        const blockKey = `blocked:${clientIP}`;
        securityStore.set(blockKey, {
          count: 0,
          resetTime: Date.now() + 60 * 60 * 1000, // 1小时封禁
          lastAccess: Date.now(),
          suspiciousCount: scanInfo.suspiciousCount
        });

        console.log(`🚫 [反扫描] IP因频繁扫描被封禁1小时: ${clientIP}`);
      }

      // 返回假的404错误，不暴露真实的系统信息
      return c.text('Not Found', 404);
    }

    return next();

  } catch (error) {
    console.error('Anti-scanning middleware error:', error);
    return next();
  }
}
