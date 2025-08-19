/**
 * 安全配置管理API
 * 提供订阅链接安全配置的管理接口
 */

import { Hono } from 'hono';
import type { Env } from '../types';

export const securityConfigRouter = new Hono<{ Bindings: Env }>();

// 安全配置接口
interface SecurityConfig {
  rateLimitEnabled: boolean;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  blockDurationMinutes: number;
  userAgentCheckEnabled: boolean;
  geoRestrictionEnabled: boolean;
  allowedCountries: string[];
  logRetentionDays: number;
}

// 访问日志接口
interface AccessLog {
  id: string;
  ip: string;
  userAgent: string;
  country: string;
  timestamp: string;
  status: 'allowed' | 'blocked' | 'suspicious';
  reason?: string;
  subscriptionId?: string;
}

// 安全统计接口
interface SecurityStats {
  totalRequests: number;
  blockedRequests: number;
  suspiciousRequests: number;
  uniqueIPs: number;
  topCountries: Array<{ country: string; count: number }>;
  topUserAgents: Array<{ userAgent: string; count: number }>;
}

// 默认安全配置
const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  rateLimitEnabled: true,
  maxRequestsPerHour: 60,
  maxRequestsPerDay: 500,
  blockDurationMinutes: 60,
  userAgentCheckEnabled: true,
  geoRestrictionEnabled: false,
  allowedCountries: [],
  logRetentionDays: 30
};

// 获取安全配置
securityConfigRouter.get('/config', async (c) => {
  try {
    const db = c.env.DB;
    
    // 从数据库获取配置
    const result = await db.prepare(`
      SELECT config_value FROM security_config WHERE config_key = ?
    `).bind('subscription_security').first();
    
    let config = DEFAULT_SECURITY_CONFIG;
    
    if (result) {
      try {
        config = { ...DEFAULT_SECURITY_CONFIG, ...JSON.parse(result.config_value as string) };
      } catch (error) {
        console.error('解析安全配置失败:', error);
      }
    }
    
    return c.json({
      success: true,
      data: config
    });
    
  } catch (error) {
    console.error('获取安全配置失败:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to get security config'
    }, 500);
  }
});

// 保存安全配置
securityConfigRouter.post('/config', async (c) => {
  try {
    const config = await c.req.json() as SecurityConfig;
    const db = c.env.DB;
    
    // 验证配置
    if (config.maxRequestsPerHour < 1 || config.maxRequestsPerHour > 1000) {
      return c.json({
        success: false,
        error: 'Validation Error',
        message: 'maxRequestsPerHour must be between 1 and 1000'
      }, 400);
    }
    
    if (config.maxRequestsPerDay < 1 || config.maxRequestsPerDay > 10000) {
      return c.json({
        success: false,
        error: 'Validation Error',
        message: 'maxRequestsPerDay must be between 1 and 10000'
      }, 400);
    }
    
    // 保存到数据库
    await db.prepare(`
      INSERT OR REPLACE INTO security_config (config_key, config_value, updated_at)
      VALUES (?, ?, ?)
    `).bind('subscription_security', JSON.stringify(config), new Date().toISOString()).run();
    
    return c.json({
      success: true,
      message: 'Security config saved successfully'
    });
    
  } catch (error) {
    console.error('保存安全配置失败:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to save security config'
    }, 500);
  }
});

// 获取安全统计
securityConfigRouter.get('/stats', async (c) => {
  try {
    const db = c.env.DB;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // 获取基础统计
    const totalResult = await db.prepare(`
      SELECT COUNT(*) as total FROM access_logs WHERE timestamp >= ?
    `).bind(oneDayAgo.toISOString()).first();
    
    const blockedResult = await db.prepare(`
      SELECT COUNT(*) as blocked FROM access_logs 
      WHERE timestamp >= ? AND status = 'blocked'
    `).bind(oneDayAgo.toISOString()).first();
    
    const suspiciousResult = await db.prepare(`
      SELECT COUNT(*) as suspicious FROM access_logs 
      WHERE timestamp >= ? AND status = 'suspicious'
    `).bind(oneDayAgo.toISOString()).first();
    
    const uniqueIPsResult = await db.prepare(`
      SELECT COUNT(DISTINCT ip) as unique_ips FROM access_logs 
      WHERE timestamp >= ?
    `).bind(oneDayAgo.toISOString()).first();
    
    // 获取热门国家
    const topCountriesResult = await db.prepare(`
      SELECT country, COUNT(*) as count FROM access_logs 
      WHERE timestamp >= ? AND country IS NOT NULL
      GROUP BY country ORDER BY count DESC LIMIT 5
    `).bind(oneDayAgo.toISOString()).all();
    
    // 获取热门User-Agent
    const topUserAgentsResult = await db.prepare(`
      SELECT user_agent, COUNT(*) as count FROM access_logs 
      WHERE timestamp >= ? AND user_agent IS NOT NULL
      GROUP BY user_agent ORDER BY count DESC LIMIT 5
    `).bind(oneDayAgo.toISOString()).all();
    
    const stats: SecurityStats = {
      totalRequests: (totalResult?.total as number) || 0,
      blockedRequests: (blockedResult?.blocked as number) || 0,
      suspiciousRequests: (suspiciousResult?.suspicious as number) || 0,
      uniqueIPs: (uniqueIPsResult?.unique_ips as number) || 0,
      topCountries: topCountriesResult.results.map((row: any) => ({
        country: row.country,
        count: row.count
      })),
      topUserAgents: topUserAgentsResult.results.map((row: any) => ({
        userAgent: row.user_agent,
        count: row.count
      }))
    };
    
    return c.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error('获取安全统计失败:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to get security stats'
    }, 500);
  }
});

// 获取访问日志
securityConfigRouter.get('/logs', async (c) => {
  try {
    const db = c.env.DB;
    const limit = parseInt(c.req.query('limit') || '100');
    const offset = parseInt(c.req.query('offset') || '0');
    
    const result = await db.prepare(`
      SELECT * FROM access_logs 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `).bind(limit, offset).all();
    
    const logs: AccessLog[] = result.results.map((row: any) => ({
      id: row.id,
      ip: row.ip,
      userAgent: row.user_agent,
      country: row.country,
      timestamp: row.timestamp,
      status: row.status,
      reason: row.reason,
      subscriptionId: row.subscription_id
    }));
    
    return c.json({
      success: true,
      data: logs
    });
    
  } catch (error) {
    console.error('获取访问日志失败:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to get access logs'
    }, 500);
  }
});

// 清除访问日志
securityConfigRouter.delete('/logs', async (c) => {
  try {
    const db = c.env.DB;
    
    await db.prepare(`DELETE FROM access_logs`).run();
    
    return c.json({
      success: true,
      message: 'Access logs cleared successfully'
    });
    
  } catch (error) {
    console.error('清除访问日志失败:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to clear access logs'
    }, 500);
  }
});

// 创建必要的数据库表
export async function initSecurityTables(db: any) {
  try {
    // 安全配置表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS security_config (
        config_key TEXT PRIMARY KEY,
        config_value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `).run();
    
    // 访问日志表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id TEXT PRIMARY KEY,
        ip TEXT NOT NULL,
        user_agent TEXT,
        country TEXT,
        timestamp TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT,
        subscription_id TEXT,
        path TEXT
      )
    `).run();
    
    // 创建索引
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp)
    `).run();
    
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_access_logs_ip ON access_logs(ip)
    `).run();
    
    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_access_logs_status ON access_logs(status)
    `).run();
    
    console.log('✅ 安全相关数据库表初始化完成');
    
  } catch (error) {
    console.error('❌ 初始化安全数据库表失败:', error);
  }
}
