/**
 * 数据库初始化模块
 * 负责创建表结构、插入默认数据、数据库健康检查等
 */

export interface DbResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 初始化数据库表结构
 */
export async function initializeDatabase(db: D1Database): Promise<DbResult<boolean>> {
  try {
    console.log('开始初始化数据库表结构...');

    // 创建用户表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        email TEXT,
        enabled BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `).run();

    // 创建节点表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        server TEXT NOT NULL,
        port INTEGER NOT NULL,
        enabled BOOLEAN DEFAULT true,
        tags TEXT,
        remark TEXT,
        uuid TEXT,
        encryption TEXT,
        flow TEXT,
        alter_id INTEGER,
        security TEXT,
        password TEXT,
        method TEXT,
        username TEXT,
        network TEXT,
        tls BOOLEAN DEFAULT false,
        sni TEXT,
        alpn TEXT,
        fingerprint TEXT,
        allow_insecure BOOLEAN DEFAULT false,
        ws_path TEXT,
        ws_headers TEXT,
        h2_path TEXT,
        h2_host TEXT,
        grpc_service_name TEXT,
        grpc_mode TEXT,
        plugin TEXT,
        plugin_opts TEXT,
        obfs TEXT,
        obfs_password TEXT,
        up_mbps INTEGER,
        down_mbps INTEGER,
        auth TEXT,
        auth_str TEXT,
        protocol TEXT,
        total_requests INTEGER DEFAULT 0,
        last_used DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 创建X-UI面板表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS xui_panels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        enabled BOOLEAN DEFAULT true,
        remark TEXT,
        tags TEXT,
        timeout INTEGER DEFAULT 30,
        retry_count INTEGER DEFAULT 3,
        total_nodes INTEGER DEFAULT 0,
        last_sync DATETIME,
        status TEXT DEFAULT 'offline',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 创建自定义订阅表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS custom_subscriptions (
        uuid TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        node_ids TEXT NOT NULL,
        enabled BOOLEAN DEFAULT true,
        format TEXT DEFAULT 'v2ray',
        include_types TEXT,
        exclude_types TEXT,
        include_keywords TEXT,
        exclude_keywords TEXT,
        sort_by TEXT DEFAULT 'name',
        sort_order TEXT DEFAULT 'asc',
        group_enabled BOOLEAN DEFAULT false,
        group_by TEXT DEFAULT 'type',
        rename_rules TEXT,
        total_requests INTEGER DEFAULT 0,
        last_accessed DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME
      )
    `).run();

    // 添加format字段到现有表（如果不存在）
    try {
      await db.prepare(`
        ALTER TABLE custom_subscriptions ADD COLUMN format TEXT DEFAULT 'v2ray'
      `).run();
    } catch (error) {
      // 字段已存在，忽略错误
      console.log('format字段已存在或添加失败:', error);
    }

    // 创建访问日志表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS access_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        user_agent TEXT,
        ip_address TEXT,
        referer TEXT,
        subscription_format TEXT,
        node_count INTEGER,
        status_code INTEGER,
        response_time INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 创建系统设置表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        type TEXT DEFAULT 'string',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // 创建会话表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `).run();

    console.log('数据库表结构创建完成');

    // 创建索引
    await createIndexes(db);

    // 插入默认数据
    await insertDefaultData(db);

    console.log('数据库初始化完成');

    return {
      success: true,
      data: true
    };
  } catch (error) {
    console.error('数据库初始化失败:', error);
    return {
      success: false,
      error: `数据库初始化失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * 创建数据库索引
 */
async function createIndexes(db: D1Database): Promise<void> {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_nodes_enabled ON nodes(enabled)',
    'CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)',
    'CREATE INDEX IF NOT EXISTS idx_nodes_server ON nodes(server)',
    'CREATE INDEX IF NOT EXISTS idx_xui_panels_enabled ON xui_panels(enabled)',
    'CREATE INDEX IF NOT EXISTS idx_xui_panels_status ON xui_panels(status)',
    'CREATE INDEX IF NOT EXISTS idx_custom_subscriptions_enabled ON custom_subscriptions(enabled)',
    'CREATE INDEX IF NOT EXISTS idx_custom_subscriptions_expires ON custom_subscriptions(expires_at)',
    'CREATE INDEX IF NOT EXISTS idx_access_logs_type ON access_logs(type)',
    'CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)',
    'CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)'
  ];

  for (const indexSql of indexes) {
    await db.prepare(indexSql).run();
  }

  console.log('数据库索引创建完成');
}

/**
 * 插入默认数据
 */
async function insertDefaultData(db: D1Database): Promise<void> {
  // 插入默认管理员用户（密码将在首次启动时设置）
  await db.prepare(`
    INSERT OR IGNORE INTO users (id, username, password, role, enabled) 
    VALUES ('admin', 'admin', '', 'admin', true)
  `).run();

  // 插入默认系统设置
  const defaultSettings = [
    ['app_name', 'Sub-Store', '应用名称', 'string'],
    ['app_version', '2.0.0', '应用版本', 'string'],
    ['max_nodes_per_subscription', '1000', '每个订阅最大节点数', 'number'],
    ['default_subscription_interval', '86400', '默认订阅更新间隔（秒）', 'number'],
    ['enable_access_log', 'true', '启用访问日志', 'boolean'],
    ['log_retention_days', '30', '日志保留天数', 'number']
  ];

  for (const [key, value, description, type] of defaultSettings) {
    await db.prepare(`
      INSERT OR IGNORE INTO settings (key, value, description, type) 
      VALUES (?, ?, ?, ?)
    `).bind(key, value, description, type).run();
  }

  console.log('默认数据插入完成');
}

/**
 * 数据库健康检查
 */
export async function checkDatabaseHealth(db: D1Database): Promise<DbResult<any>> {
  try {
    // 检查表是否存在
    const tables = await db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table'
    `).all();

    const requiredTables = ['users', 'nodes', 'xui_panels', 'custom_subscriptions', 'access_logs', 'settings'];
    const existingTables = tables.results.map((row: any) => row.name);
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));

    if (missingTables.length > 0) {
      return {
        success: false,
        error: `缺少数据库表: ${missingTables.join(', ')}`
      };
    }

    // 获取基本统计信息
    const nodeCount = await db.prepare('SELECT COUNT(*) as count FROM nodes').first();
    const subscriptionCount = await db.prepare('SELECT COUNT(*) as count FROM custom_subscriptions').first();
    const xuiPanelCount = await db.prepare('SELECT COUNT(*) as count FROM xui_panels').first();

    return {
      success: true,
      data: {
        healthy: true,
        tables: existingTables,
        stats: {
          nodes: { total: (nodeCount as any)?.count || 0 },
          subscriptions: { total: (subscriptionCount as any)?.count || 0 },
          xuiPanels: { total: (xuiPanelCount as any)?.count || 0 }
        }
      }
    };
  } catch (error) {
    console.error('数据库健康检查失败:', error);
    return {
      success: false,
      error: `数据库健康检查失败: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}
