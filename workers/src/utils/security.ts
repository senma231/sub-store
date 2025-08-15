/**
 * 安全工具函数
 * 包括订阅链接加密、解密、签名验证等
 */

// 简单的字符串加密/解密（基于异或和Base64）
export function encryptSubscriptionId(uuid: string, secret: string): string {
  try {
    const timestamp = Date.now().toString();
    const data = `${uuid}:${timestamp}`;
    
    // 使用密钥进行简单异或加密
    let encrypted = '';
    for (let i = 0; i < data.length; i++) {
      const keyChar = secret.charCodeAt(i % secret.length);
      const dataChar = data.charCodeAt(i);
      encrypted += String.fromCharCode(dataChar ^ keyChar);
    }
    
    // Base64编码并URL安全化
    return btoa(encrypted)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } catch (error) {
    console.error('Encryption error:', error);
    return uuid; // 失败时返回原始UUID
  }
}

export function decryptSubscriptionId(encryptedId: string, secret: string): { uuid: string; timestamp: number } | null {
  try {
    // 恢复Base64格式
    let base64 = encryptedId
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
    
    // 解析UUID和时间戳
    const parts = decrypted.split(':');
    if (parts.length !== 2) {
      return null;
    }
    
    const uuid = parts[0];
    const timestamp = parseInt(parts[1], 10);
    
    if (isNaN(timestamp)) {
      return null;
    }
    
    // 检查时间戳是否过期（24小时）
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    
    if (now - timestamp > maxAge) {
      console.log('🚫 [安全] 加密链接已过期');
      return null;
    }
    
    return { uuid, timestamp };
  } catch (error) {
    console.error('Decryption error:', error);
    return null;
  }
}

// 生成访问令牌（包含IP和时间戳）
export function generateAccessToken(ip: string, uuid: string, secret: string): string {
  try {
    const timestamp = Date.now();
    const data = `${ip}:${uuid}:${timestamp}`;
    
    // 简单哈希
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    const token = `${timestamp}.${Math.abs(hash).toString(36)}`;
    return btoa(token).replace(/=/g, '');
  } catch (error) {
    console.error('Token generation error:', error);
    return '';
  }
}

// 验证访问令牌
export function verifyAccessToken(token: string, ip: string, uuid: string, secret: string): boolean {
  try {
    const decoded = atob(token + '=='.slice(0, (4 - token.length % 4) % 4));
    const parts = decoded.split('.');
    
    if (parts.length !== 2) {
      return false;
    }
    
    const timestamp = parseInt(parts[0], 10);
    const hash = parts[1];
    
    if (isNaN(timestamp)) {
      return false;
    }
    
    // 检查时间戳（5分钟有效期）
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5分钟
    
    if (now - timestamp > maxAge) {
      return false;
    }
    
    // 重新计算哈希验证
    const data = `${ip}:${uuid}:${timestamp}`;
    let expectedHash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      expectedHash = ((expectedHash << 5) - expectedHash) + char;
      expectedHash = expectedHash & expectedHash;
    }
    
    return hash === Math.abs(expectedHash).toString(36);
  } catch (error) {
    console.error('Token verification error:', error);
    return false;
  }
}

// IP地址验证
export function isValidIP(ip: string): boolean {
  // IPv4正则
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  // IPv6正则（简化版）
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
  
  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

// 检查是否为内网IP
export function isPrivateIP(ip: string): boolean {
  if (!isValidIP(ip)) {
    return false;
  }
  
  // 内网IP范围
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/
  ];
  
  return privateRanges.some(range => range.test(ip));
}
