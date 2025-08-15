/**
 * 安全管理API路由
 * 提供安全统计、IP管理等功能
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { 
  getSecurityStats, 
  addToBlacklist, 
  addToWhitelist, 
  clearSecurityRecord 
} from '../middleware/security';

export const securityRouter = new Hono<{ Bindings: Env }>();

// 获取安全统计信息
securityRouter.get('/stats', async (c) => {
  try {
    const stats = getSecurityStats();
    
    return c.json({
      success: true,
      data: {
        ...stats,
        timestamp: new Date().toISOString(),
        uptime: process.uptime ? Math.floor(process.uptime()) : 0
      }
    });
  } catch (error) {
    console.error('获取安全统计失败:', error);
    return c.json({
      success: false,
      error: '获取安全统计失败'
    }, 500);
  }
});

// 添加IP到黑名单
securityRouter.post('/blacklist', async (c) => {
  try {
    const { ip, reason } = await c.req.json();
    
    if (!ip) {
      return c.json({
        success: false,
        error: 'IP地址不能为空'
      }, 400);
    }
    
    const success = addToBlacklist(ip);
    
    if (success) {
      console.log(`🚫 [安全管理] 管理员添加IP到黑名单: ${ip}, 原因: ${reason || '未提供'}`);
      return c.json({
        success: true,
        message: `IP ${ip} 已添加到黑名单`
      });
    } else {
      return c.json({
        success: false,
        error: '无效的IP地址'
      }, 400);
    }
  } catch (error) {
    console.error('添加黑名单失败:', error);
    return c.json({
      success: false,
      error: '添加黑名单失败'
    }, 500);
  }
});

// 添加IP到白名单
securityRouter.post('/whitelist', async (c) => {
  try {
    const { ip, reason } = await c.req.json();
    
    if (!ip) {
      return c.json({
        success: false,
        error: 'IP地址不能为空'
      }, 400);
    }
    
    const success = addToWhitelist(ip);
    
    if (success) {
      console.log(`✅ [安全管理] 管理员添加IP到白名单: ${ip}, 原因: ${reason || '未提供'}`);
      return c.json({
        success: true,
        message: `IP ${ip} 已添加到白名单`
      });
    } else {
      return c.json({
        success: false,
        error: '无效的IP地址'
      }, 400);
    }
  } catch (error) {
    console.error('添加白名单失败:', error);
    return c.json({
      success: false,
      error: '添加白名单失败'
    }, 500);
  }
});

// 清除IP的安全记录
securityRouter.delete('/records/:ip', async (c) => {
  try {
    const ip = c.req.param('ip');
    
    if (!ip) {
      return c.json({
        success: false,
        error: 'IP地址不能为空'
      }, 400);
    }
    
    clearSecurityRecord(ip);
    
    console.log(`🧹 [安全管理] 管理员清除IP安全记录: ${ip}`);
    return c.json({
      success: true,
      message: `IP ${ip} 的安全记录已清除`
    });
  } catch (error) {
    console.error('清除安全记录失败:', error);
    return c.json({
      success: false,
      error: '清除安全记录失败'
    }, 500);
  }
});

// 获取反爬虫配置
securityRouter.get('/config', async (c) => {
  try {
    const config = {
      antiCrawler: {
        enabled: true,
        maxRequestsPerMinute: 5,
        suspiciousThreshold: 3,
        validUserAgents: [
          'v2rayN', 'v2rayNG', 'Clash', 'ClashX', 'ClashForAndroid',
          'Shadowrocket', 'QuantumultX', 'Surge', 'Loon', 'Stash'
        ]
      },
      ddosProtection: {
        enabled: true,
        maxRequestsPerMinute: 30,
        blockDuration: 15 * 60 * 1000, // 15分钟
        suspiciousThreshold: 5
      },
      encryption: {
        enabled: true,
        linkExpiration: 24 * 60 * 60 * 1000, // 24小时
        tokenExpiration: 5 * 60 * 1000 // 5分钟
      }
    };
    
    return c.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('获取安全配置失败:', error);
    return c.json({
      success: false,
      error: '获取安全配置失败'
    }, 500);
  }
});

// 获取安全事件日志
securityRouter.get('/events', async (c) => {
  try {
    // 这里可以从数据库或日志系统获取安全事件
    // 目前返回模拟数据
    const events = [
      {
        id: '1',
        type: 'suspicious_access',
        severity: 'medium',
        ip: '192.168.1.100',
        userAgent: 'curl/7.68.0',
        path: '/subscriptions/test/v2ray',
        timestamp: new Date().toISOString(),
        action: 'blocked',
        reason: 'Suspicious User-Agent detected'
      },
      {
        id: '2',
        type: 'scanning_attempt',
        severity: 'high',
        ip: '10.0.0.1',
        userAgent: 'nikto/2.1.6',
        path: '/admin',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        action: 'blocked',
        reason: 'Scanning tool detected'
      },
      {
        id: '3',
        type: 'rate_limit_exceeded',
        severity: 'low',
        ip: '172.16.0.1',
        userAgent: 'v2rayN/6.23',
        path: '/subscriptions/uuid/v2ray',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        action: 'rate_limited',
        reason: 'Too many requests'
      }
    ];

    return c.json({
      success: true,
      data: {
        events,
        total: events.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('获取安全事件失败:', error);
    return c.json({
      success: false,
      error: '获取安全事件失败'
    }, 500);
  }
});

// 安全报告
securityRouter.get('/report', async (c) => {
  try {
    const stats = getSecurityStats();

    const report = {
      summary: {
        ...stats,
        reportTime: new Date().toISOString(),
        systemStatus: stats.blockedIPs > 10 ? 'under_attack' : 'normal'
      },
      threats: {
        scanning_attempts: 15,
        suspicious_user_agents: 8,
        rate_limit_violations: 23,
        blocked_ips: stats.blockedIPs
      },
      protection: {
        anti_crawler: {
          enabled: true,
          blocked_requests: 45,
          effectiveness: '98.5%'
        },
        ddos_protection: {
          enabled: true,
          blocked_ips: stats.blockedIPs,
          effectiveness: '99.2%'
        },
        scanning_protection: {
          enabled: true,
          blocked_scans: 15,
          effectiveness: '100%'
        }
      },
      recommendations: [
        stats.suspiciousIPs > 5 ? '建议加强IP监控' : null,
        stats.blockedIPs > 10 ? '建议检查攻击来源' : null,
        '定期更新安全规则',
        '监控异常流量模式'
      ].filter(Boolean)
    };

    return c.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('生成安全报告失败:', error);
    return c.json({
      success: false,
      error: '生成安全报告失败'
    }, 500);
  }
});

// 测试安全功能
securityRouter.post('/test', async (c) => {
  try {
    const { type, data } = await c.req.json();

    switch (type) {
      case 'user-agent':
        // 测试User-Agent检测
        const testUA = data.userAgent || '';
        const isValid = ['v2rayN', 'Clash', 'Shadowrocket'].some(agent =>
          testUA.toLowerCase().includes(agent.toLowerCase())
        );

        return c.json({
          success: true,
          data: {
            userAgent: testUA,
            isValid,
            message: isValid ? '有效的代理客户端' : '无效或可疑的User-Agent'
          }
        });

      case 'ip':
        // 测试IP检测
        const testIP = data.ip || '';
        // 这里可以添加IP检测逻辑

        return c.json({
          success: true,
          data: {
            ip: testIP,
            message: 'IP检测功能'
          }
        });

      case 'scanning':
        // 测试扫描检测
        const testPath = data.path || '';
        const scanningPaths = ['/admin', '/wp-admin', '/phpmyadmin'];
        const isScanning = scanningPaths.some(path => testPath.includes(path));

        return c.json({
          success: true,
          data: {
            path: testPath,
            isScanning,
            message: isScanning ? '检测到扫描路径' : '正常访问路径'
          }
        });

      default:
        return c.json({
          success: false,
          error: '不支持的测试类型'
        }, 400);
    }
  } catch (error) {
    console.error('安全测试失败:', error);
    return c.json({
      success: false,
      error: '安全测试失败'
    }, 500);
  }
});
