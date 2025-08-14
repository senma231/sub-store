import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { CustomSubscriptionsRepository } from '../database/customSubscriptions';
import { TrafficManager, TrafficStats, TrafficSettings } from '../utils/trafficManager';

export const trafficManagementRouter = new Hono<{ Bindings: Env }>();

// 认证中间件已在主路由中应用，这里不需要重复应用

// 获取订阅流量统计
trafficManagementRouter.get('/:uuid/traffic', async (c) => {
  try {
    const uuid = c.req.param('uuid');
    const db = c.get('db');
    
    if (!db) {
      return c.json({
        success: false,
        error: 'Service Unavailable',
        message: 'Database not configured'
      }, 503);
    }

    const customSubsRepo = new CustomSubscriptionsRepository(db);
    const subscription = await customSubsRepo.getByUuid(uuid);
    
    if (!subscription.success || !subscription.data) {
      return c.json({
        success: false,
        error: 'Not Found',
        message: 'Subscription not found'
      }, 404);
    }

    const sub = subscription.data;
    
    const stats: TrafficStats = {
      limit: sub.trafficLimit || 0,
      used: sub.trafficUsed || 0,
      remaining: Math.max(0, (sub.trafficLimit || 0) - (sub.trafficUsed || 0)),
      percentage: TrafficManager.getTrafficUsagePercentage(sub.trafficUsed || 0, sub.trafficLimit || 0),
      resetDate: sub.trafficResetDate || '',
      resetCycle: sub.trafficResetCycle || 'monthly',
      enabled: sub.trafficEnabled || false
    };

    return c.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('获取流量统计失败:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to get traffic stats'
    }, 500);
  }
});
