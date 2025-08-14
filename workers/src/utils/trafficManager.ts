// 流量管理工具类
export class TrafficManager {
  
  // 格式化流量显示
  static formatTraffic(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
  }

  // 解析流量字符串为字节数
  static parseTraffic(trafficStr: string): number {
    const match = trafficStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    const multipliers: { [key: string]: number } = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    };
    
    return Math.floor(value * (multipliers[unit] || 0));
  }

  // 计算下次重置日期
  static calculateNextResetDate(cycle: string, currentDate?: Date): string {
    const now = currentDate || new Date();
    let nextReset: Date;
    
    switch (cycle) {
      case 'daily':
        nextReset = new Date(now);
        nextReset.setDate(now.getDate() + 1);
        nextReset.setHours(0, 0, 0, 0);
        break;
        
      case 'weekly':
        nextReset = new Date(now);
        const daysUntilMonday = (7 - now.getDay() + 1) % 7 || 7;
        nextReset.setDate(now.getDate() + daysUntilMonday);
        nextReset.setHours(0, 0, 0, 0);
        break;
        
      case 'monthly':
      default:
        nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        break;
    }
    
    return nextReset.toISOString();
  }

  // 检查是否需要重置流量
  static shouldResetTraffic(resetDate: string): boolean {
    if (!resetDate) return false;
    return new Date() >= new Date(resetDate);
  }

  // 检查流量是否超限
  static isTrafficExceeded(used: number, limit: number, enabled: boolean): boolean {
    if (!enabled || limit === 0) return false;
    return used >= limit;
  }

  // 计算流量使用百分比
  static getTrafficUsagePercentage(used: number, limit: number): number {
    if (limit === 0) return 0;
    return Math.min(Math.round((used / limit) * 100), 100);
  }

  // 计算订阅内容流量
  static calculateContentTraffic(content: string): number {
    // 计算Base64内容的实际字节数
    const base64Length = content.length;
    const originalLength = Math.floor(base64Length * 3 / 4);
    
    // 加上HTTP头部的估算大小（约200字节）
    return originalLength + 200;
  }

  // 生成流量超限提示内容
  static generateTrafficExceededContent(subscriptionName: string, used: number, limit: number): string {
    const usedFormatted = this.formatTraffic(used);
    const limitFormatted = this.formatTraffic(limit);
    
    const message = `# 流量已用完\n\n订阅 "${subscriptionName}" 的流量已达到限制。\n\n- 已使用: ${usedFormatted}\n- 限制: ${limitFormatted}\n\n请联系管理员增加流量配额或等待下次重置。`;
    
    // 返回Base64编码的提示信息
    return btoa(message);
  }
}

// 流量统计接口
export interface TrafficStats {
  limit: number;           // 流量限制(字节)
  used: number;           // 已使用流量(字节)
  remaining: number;      // 剩余流量(字节)
  percentage: number;     // 使用百分比
  resetDate: string;      // 下次重置日期
  resetCycle: string;     // 重置周期
  enabled: boolean;       // 是否启用限制
}

// 流量设置接口
export interface TrafficSettings {
  enabled: boolean;       // 是否启用流量限制
  limit: number;         // 流量限制(字节)
  resetCycle: string;    // 重置周期: daily/weekly/monthly/manual
}
