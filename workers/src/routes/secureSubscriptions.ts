/**
 * 安全订阅路由
 * 提供加密的订阅链接，专门防止节点被轻易解析
 */

import { Hono } from 'hono';
import type { Env } from '../types';
import { CustomSubscriptionsRepository } from '../database/customSubscriptions';
import { NodesRepository } from '../database/nodes';
import { generateCustomSubscriptionContent } from './customSubscriptions';
import { 
  parseSecureSubscriptionUrl, 
  createSubscriptionAntiCrawlerMiddleware,
  decryptNodeContent 
} from '../utils/subscriptionSecurity';

export const secureSubscriptionsRouter = new Hono<{ Bindings: Env }>();

// 应用订阅专用的反爬中间件
secureSubscriptionsRouter.use('*', createSubscriptionAntiCrawlerMiddleware());

// 安全订阅访问 - 加密链接格式
// 路由格式: /secure/:token/:format
secureSubscriptionsRouter.get('/:token/:format', async (c) => {
  try {
    const token = c.req.param('token');
    const format = c.req.param('format');
    const secret = c.env.ADMIN_TOKEN || 'default-secret';

    console.log(`🔐 [安全订阅] 访问加密订阅: token=${token.substring(0, 10)}..., format=${format}`);

    // 解析安全链接
    const parsed = parseSecureSubscriptionUrl(token, secret);
    if (!parsed) {
      console.log(`🚫 [安全订阅] 无效的安全链接`);
      return c.text('Invalid or expired subscription link', 404);
    }

    const { uuid, format: parsedFormat, timestamp } = parsed;

    // 验证格式匹配
    if (format !== parsedFormat) {
      console.log(`🚫 [安全订阅] 格式不匹配: ${format} vs ${parsedFormat}`);
      return c.text('Format mismatch', 400);
    }

    // 验证格式
    const validFormats = ['v2ray', 'clash', 'shadowrocket'];
    if (!validFormats.includes(format)) {
      return c.text('Unsupported format', 400);
    }

    // 获取自定义订阅
    const customSubscriptionsRepo = new CustomSubscriptionsRepository(c.env.DB);
    const subscription = await customSubscriptionsRepo.getByUuid(uuid);

    if (!subscription) {
      console.log(`🚫 [安全订阅] 订阅不存在: ${uuid}`);
      return c.text('Subscription not found', 404);
    }

    // 检查订阅是否过期
    if (subscription.expiresAt && new Date(subscription.expiresAt) < new Date()) {
      console.log(`🚫 [安全订阅] 订阅已过期: ${uuid}`);
      return c.text('Subscription expired', 410);
    }

    // 获取节点数据
    const nodesRepo = new NodesRepository(c.env.DB);
    const nodes = await nodesRepo.getByIds(subscription.nodeIds);

    if (nodes.length === 0) {
      console.log(`⚠️ [安全订阅] 订阅无可用节点: ${uuid}`);
      return c.text('No available nodes', 404);
    }

    // 过滤启用的节点
    const enabledNodes = nodes.filter(node => node.enabled);
    if (enabledNodes.length === 0) {
      console.log(`⚠️ [安全订阅] 订阅无启用节点: ${uuid}`);
      return c.text('No enabled nodes', 404);
    }

    // 生成加密的订阅内容
    const { content, contentType, filename } = generateCustomSubscriptionContent(
      enabledNodes, 
      format,
      {
        encrypt: true,
        secret: secret,
        addDecoys: true // 添加诱饵节点
      }
    );

    // 更新访问统计
    await customSubscriptionsRepo.updateAccessStats(subscription.id);

    console.log(`✅ [安全订阅] 成功生成加密订阅: ${uuid}, 节点数: ${enabledNodes.length}`);

    // 返回加密的订阅内容
    return c.text(content, 200, {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Subscription-Type': 'secure-encrypted',
      'X-Node-Count': enabledNodes.length.toString(),
      'X-Generated-At': new Date().toISOString()
    });

  } catch (error) {
    console.error('安全订阅生成失败:', error);
    return c.text('Internal server error', 500);
  }
});

// 解密订阅内容的辅助端点（仅用于调试，生产环境应移除）
secureSubscriptionsRouter.post('/decrypt', async (c) => {
  try {
    const { encryptedContent, secret } = await c.req.json();
    
    if (!encryptedContent || !secret) {
      return c.json({
        success: false,
        error: '缺少必要参数'
      }, 400);
    }

    const decrypted = decryptNodeContent(encryptedContent, secret);
    
    return c.json({
      success: true,
      data: {
        decryptedContent: decrypted
      }
    });

  } catch (error) {
    console.error('解密失败:', error);
    return c.json({
      success: false,
      error: '解密失败'
    }, 500);
  }
});

// 生成安全订阅链接的端点
secureSubscriptionsRouter.post('/generate-link', async (c) => {
  try {
    const { uuid, format } = await c.req.json();
    const secret = c.env.ADMIN_TOKEN || 'default-secret';
    const baseUrl = c.env.API_BASE_URL || 'https://sub-api.senma.io';

    if (!uuid || !format) {
      return c.json({
        success: false,
        error: '缺少必要参数'
      }, 400);
    }

    // 验证订阅是否存在
    const customSubscriptionsRepo = new CustomSubscriptionsRepository(c.env.DB);
    const subscription = await customSubscriptionsRepo.getByUuid(uuid);

    if (!subscription) {
      return c.json({
        success: false,
        error: '订阅不存在'
      }, 404);
    }

    // 生成安全链接
    const timestamp = Date.now();
    const data = `${uuid}:${format}:${timestamp}`;
    
    // 生成签名
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    const signature = Math.abs(hash).toString(36);
    const token = btoa(`${data}:${signature}`).replace(/=/g, '');
    
    const secureUrl = `${baseUrl}/secure/${token}/${format}`;

    return c.json({
      success: true,
      data: {
        secureUrl,
        expiresAt: new Date(timestamp + 24 * 60 * 60 * 1000).toISOString(), // 24小时后过期
        format
      }
    });

  } catch (error) {
    console.error('生成安全链接失败:', error);
    return c.json({
      success: false,
      error: '生成安全链接失败'
    }, 500);
  }
});
