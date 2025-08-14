import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { CustomSubscriptionsRepository } from '../database/customSubscriptions';

export const migrationRouter = new Hono<{ Bindings: Env }>();

// 应用认证中间件
migrationRouter.use('*', authMiddleware);

// 执行数据库迁移
migrationRouter.post('/traffic-fields', async (c) => {
  try {
    const db = c.get('db');
    
    if (!db) {
      return c.json({
        success: false,
        error: 'Service Unavailable',
        message: 'Database not configured'
      }, 503);
    }

    console.log('Starting traffic fields migration...');
    
    const customSubsRepo = new CustomSubscriptionsRepository(db);
    const result = await customSubsRepo.migrateTrafficFields();
    
    if (!result.success) {
      console.error('Migration failed:', result.error);
      return c.json({
        success: false,
        error: 'Migration Failed',
        message: result.error || 'Failed to migrate traffic fields'
      }, 500);
    }

    console.log('Traffic fields migration completed successfully');
    
    return c.json({
      success: true,
      message: 'Traffic fields migration completed successfully'
    });

  } catch (error) {
    console.error('Migration error:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Migration failed'
    }, 500);
  }
});

// 检查迁移状态
migrationRouter.get('/status', async (c) => {
  try {
    const db = c.get('db');
    
    if (!db) {
      return c.json({
        success: false,
        error: 'Service Unavailable',
        message: 'Database not configured'
      }, 503);
    }

    // 检查表结构
    const result = await db.execute('PRAGMA table_info(custom_subscriptions)');
    
    if (!result.success) {
      return c.json({
        success: false,
        error: 'Database Error',
        message: 'Failed to check table structure'
      }, 500);
    }

    const columns = result.data || [];
    const trafficColumns = columns.filter((col: any) => 
      col.name && col.name.startsWith('traffic_')
    );

    const hasTrafficFields = trafficColumns.length >= 5;
    
    return c.json({
      success: true,
      data: {
        hasTrafficFields,
        trafficColumns: trafficColumns.map((col: any) => col.name),
        totalColumns: columns.length
      },
      message: hasTrafficFields ? 'Traffic fields are available' : 'Traffic fields need migration'
    });

  } catch (error) {
    console.error('Status check error:', error);
    return c.json({
      success: false,
      error: 'Internal Server Error',
      message: 'Failed to check migration status'
    }, 500);
  }
});
