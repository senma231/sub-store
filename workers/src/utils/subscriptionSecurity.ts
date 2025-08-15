/**
 * 订阅链接专用安全机制
 * 专门针对节点订阅进行加密保护，不影响其他功能
 */

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

// 订阅专用的反爬中间件（只针对订阅路径）
export function createSubscriptionAntiCrawlerMiddleware() {
  return async (c: any, next: any) => {
    const path = c.req.path;
    const userAgent = c.req.header('User-Agent') || '';
    const clientIP = c.req.header('CF-Connecting-IP') ||
                    c.req.header('X-Forwarded-For') ||
                    c.req.header('X-Real-IP') ||
                    'unknown';

    // 只对订阅路径进行检查
    const isSubscriptionPath = path.includes('/subscriptions/') || path.includes('/secure/');
    
    if (!isSubscriptionPath) {
      return next(); // 非订阅路径直接通过
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
      // 返回空订阅内容，不暴露错误信息
      return c.text('', 200, {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="subscription.txt"',
      });
    }

    // 如果不是已知的代理客户端，记录但允许通过（可能是新客户端）
    if (!isValidUserAgent && userAgent.length > 0) {
      console.log(`⚠️ [订阅安全] 未知User-Agent访问订阅: ${clientIP} - ${userAgent}`);
    }

    return next();
  };
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
