import { Database } from './index';
import { NodesRepository } from './nodes';
import { CustomSubscriptionsRepository } from './customSubscriptions';

/**
 * 初始化数据库表和数据
 */
export async function initializeDatabase(db: Database): Promise<void> {
  console.log('Initializing database...');

  try {
    // 初始化数据库连接
    const initResult = await db.init();
    if (!initResult.success) {
      throw new Error(`Database initialization failed: ${initResult.error}`);
    }

    // 创建节点仓库并初始化表
    const nodesRepo = new NodesRepository(db);
    console.log('Nodes repository initialized');

    // 创建自定义订阅仓库并初始化表
    const customSubsRepo = new CustomSubscriptionsRepository(db);
    await customSubsRepo.createTable();
    await customSubsRepo.createIndexes();

    console.log('Database initialization completed successfully');

  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

/**
 * 检查数据库健康状态
 */
export async function checkDatabaseHealth(db: Database): Promise<{
  healthy: boolean;
  nodeCount: number;
  subscriptionCount: number;
  error?: string;
}> {
  try {
    const nodesRepo = new NodesRepository(db);
    const customSubsRepo = new CustomSubscriptionsRepository(db);

    // 检查节点数量
    const nodesResult = await nodesRepo.getNodes(1, 1);
    const nodeCount = nodesResult.total || 0;

    // 检查订阅数量
    const subsResult = await customSubsRepo.getAll();
    const subscriptionCount = subsResult.data?.length || 0;

    return {
      healthy: true,
      nodeCount,
      subscriptionCount,
    };

  } catch (error) {
    return {
      healthy: false,
      nodeCount: 0,
      subscriptionCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 清理过期的自定义订阅
 */
export async function cleanupExpiredSubscriptions(db: Database): Promise<number> {
  try {
    const customSubsRepo = new CustomSubscriptionsRepository(db);
    const result = await customSubsRepo.cleanupExpired();
    
    if (result.success) {
      const cleanedCount = result.data || 0;
      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired subscriptions`);
      }
      return cleanedCount;
    } else {
      console.warn('Failed to cleanup expired subscriptions:', result.error);
      return 0;
    }
  } catch (error) {
    console.error('Error during subscription cleanup:', error);
    return 0;
  }
}

/**
 * 获取数据库统计信息
 */
export async function getDatabaseStats(db: Database): Promise<{
  nodes: {
    total: number;
    enabled: number;
    byType: Record<string, number>;
  };
  subscriptions: {
    total: number;
    active: number;
    expired: number;
    totalAccess: number;
  };
}> {
  try {
    const nodesRepo = new NodesRepository(db);
    const customSubsRepo = new CustomSubscriptionsRepository(db);

    // 获取节点统计
    const nodesResult = await nodesRepo.getNodes(1, 1000);
    const nodes = nodesResult.data || [];
    const enabledNodes = nodes.filter(n => n.enabled);
    
    const nodesByType = nodes.reduce((acc, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 获取订阅统计
    const subsStatsResult = await customSubsRepo.getStats();
    const subsStats = subsStatsResult.data || {
      total: 0,
      active: 0,
      expired: 0,
      totalAccess: 0,
    };

    return {
      nodes: {
        total: nodes.length,
        enabled: enabledNodes.length,
        byType: nodesByType,
      },
      subscriptions: subsStats,
    };

  } catch (error) {
    console.error('Error getting database stats:', error);
    return {
      nodes: {
        total: 0,
        enabled: 0,
        byType: {},
      },
      subscriptions: {
        total: 0,
        active: 0,
        expired: 0,
        totalAccess: 0,
      },
    };
  }
}

/**
 * 备份数据库数据
 */
export async function backupDatabase(db: Database): Promise<{
  nodes: any[];
  subscriptions: any[];
  timestamp: string;
}> {
  try {
    const nodesRepo = new NodesRepository(db);
    const customSubsRepo = new CustomSubscriptionsRepository(db);

    // 获取所有节点
    const nodesResult = await nodesRepo.getNodes(1, 10000);
    const nodes = nodesResult.data || [];

    // 获取所有订阅
    const subsResult = await customSubsRepo.getAll();
    const subscriptions = subsResult.data || [];

    return {
      nodes,
      subscriptions,
      timestamp: new Date().toISOString(),
    };

  } catch (error) {
    console.error('Error backing up database:', error);
    throw error;
  }
}

/**
 * 恢复数据库数据
 */
export async function restoreDatabase(
  db: Database,
  backup: {
    nodes: any[];
    subscriptions: any[];
    timestamp: string;
  }
): Promise<{
  nodesRestored: number;
  subscriptionsRestored: number;
}> {
  try {
    const nodesRepo = new NodesRepository(db);
    const customSubsRepo = new CustomSubscriptionsRepository(db);

    let nodesRestored = 0;
    let subscriptionsRestored = 0;

    // 恢复节点
    for (const node of backup.nodes) {
      try {
        const result = await nodesRepo.createNode(node);
        if (result.success) {
          nodesRestored++;
        }
      } catch (error) {
        console.warn(`Failed to restore node ${node.id}:`, error);
      }
    }

    // 恢复订阅
    for (const subscription of backup.subscriptions) {
      try {
        const result = await customSubsRepo.create(subscription);
        if (result.success) {
          subscriptionsRestored++;
        }
      } catch (error) {
        console.warn(`Failed to restore subscription ${subscription.uuid}:`, error);
      }
    }

    console.log(`Restored ${nodesRestored} nodes and ${subscriptionsRestored} subscriptions`);

    return {
      nodesRestored,
      subscriptionsRestored,
    };

  } catch (error) {
    console.error('Error restoring database:', error);
    throw error;
  }
}
