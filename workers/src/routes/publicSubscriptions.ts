import { Hono } from 'hono';
import type { Env } from '../types';
import { CustomSubscriptionsRepository } from '../database/customSubscriptions';
import { NodesRepository } from '../database/nodes';
import { generateCustomSubscriptionContent } from './customSubscriptions';
import { createSubscriptionAntiCrawlerMiddleware } from '../utils/subscriptionSecurity';

export const publicSubscriptionsRouter = new Hono<{ Bindings: Env }>();

// 应用订阅专用的反爬虫中间件
publicSubscriptionsRouter.use('*', createSubscriptionAntiCrawlerMiddleware());

// 公开访问自定义订阅内容 - 不需要认证
// 路由格式: /subscriptions/:uuid/:format
publicSubscriptionsRouter.get('/:uuid/:format', async (c) => {
  try {
    const uuid = c.req.param('uuid');
    const format = c.req.param('format');
    
    console.log(`🔍 [公开订阅] 访问自定义订阅: UUID=${uuid}, 格式=${format}`);
    
    // 验证格式
    const supportedFormats = ['v2ray', 'clash', 'shadowrocket'];
    if (!supportedFormats.includes(format)) {
      console.log(`❌ [公开订阅] 不支持的格式: ${format}`);
      return c.json({
        success: false,
        error: 'Bad Request',
        message: `Unsupported format: ${format}. Supported formats: ${supportedFormats.join(', ')}`
      }, 400);
    }

    const db = c.get('db');
    if (!db) {
      console.log('❌ [公开订阅] 数据库未配置');
      return c.json({
        success: false,
        error: 'Service Unavailable',
        message: 'Database not configured'
      }, 503);
    }

    // 获取自定义订阅信息
    const customSubsRepo = new CustomSubscriptionsRepository(db);
    const subscription = await customSubsRepo.getByUuid(uuid);
    
    if (!subscription.success || !subscription.data) {
      console.log(`❌ [公开订阅] 订阅不存在: UUID=${uuid}`);
      return c.json({
        success: false,
        error: 'Not Found',
        message: 'Subscription not found'
      }, 404);
    }

    console.log(`✅ [公开订阅] 找到订阅: ${subscription.data.name}, 节点数: ${subscription.data.node_ids?.length || 0}`);

    // 获取节点数据
    const nodesRepo = c.get('nodesRepo') as NodesRepository;
    if (!nodesRepo) {
      console.log('❌ [公开订阅] 节点仓库未初始化');
      return c.json({
        success: false,
        error: 'Service Unavailable',
        message: 'Nodes repository not available'
      }, 503);
    }

    // 获取订阅包含的节点
    const nodeIds = subscription.data.node_ids || [];
    if (nodeIds.length === 0) {
      console.log(`⚠️ [公开订阅] 订阅无节点: UUID=${uuid}`);
      // 返回空订阅而不是错误
      const emptyContent = generateCustomSubscriptionContent([], format);
      
      // 更新访问统计
      await customSubsRepo.updateAccessCount(uuid);
      
      return new Response(emptyContent.content, {
        headers: {
          'Content-Type': emptyContent.contentType,
          'Content-Disposition': `attachment; filename="${emptyContent.filename}"`,
          'Cache-Control': 'no-cache',
        },
      });
    }

    // 获取节点详情
    const nodes = [];
    for (const nodeId of nodeIds) {
      const nodeResult = await nodesRepo.getById(nodeId);
      if (nodeResult.success && nodeResult.data) {
        nodes.push(nodeResult.data);
      }
    }

    console.log(`📋 [公开订阅] 获取到 ${nodes.length} 个有效节点`);

    // 生成订阅内容
    const subscriptionContent = generateCustomSubscriptionContent(nodes, format);
    
    // 更新访问统计
    await customSubsRepo.updateAccessCount(uuid);
    
    console.log(`✅ [公开订阅] 订阅生成成功: UUID=${uuid}, 格式=${format}, 节点数=${nodes.length}`);

    return new Response(subscriptionContent.content, {
      headers: {
        'Content-Type': subscriptionContent.contentType,
        'Content-Disposition': `attachment; filename="${subscriptionContent.filename}"`,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('❌ [公开订阅] 生成订阅时发生错误:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to generate subscription content'
    }, 500);
  }
});

// 获取自定义订阅信息（不包含节点内容，用于预览）
publicSubscriptionsRouter.get('/:uuid/info', async (c) => {
  try {
    const uuid = c.req.param('uuid');
    
    console.log(`🔍 [公开订阅] 获取订阅信息: UUID=${uuid}`);
    
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

    // 返回基本信息，不包含敏感数据
    return c.json({
      success: true,
      data: {
        uuid: subscription.data.uuid,
        name: subscription.data.name,
        description: subscription.data.description,
        node_count: subscription.data.node_ids?.length || 0,
        access_count: subscription.data.access_count || 0,
        last_accessed: subscription.data.last_accessed,
        created_at: subscription.data.created_at,
        updated_at: subscription.data.updated_at
      }
    });

  } catch (error) {
    console.error('❌ [公开订阅] 获取订阅信息时发生错误:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to get subscription info'
    }, 500);
  }
});
