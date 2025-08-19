-- Sub-Store 数据库表结构
-- 创建时间: 2024-08-19
-- 版本: 2.0.0

-- 用户表
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
);

-- 节点表
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    server TEXT NOT NULL,
    port INTEGER NOT NULL,
    enabled BOOLEAN DEFAULT true,
    tags TEXT, -- JSON 字符串
    remark TEXT,

    -- 认证配置
    uuid TEXT,
    encryption TEXT,
    flow TEXT,
    alter_id INTEGER,
    security TEXT,
    password TEXT,
    method TEXT,
    username TEXT,

    -- 网络配置
    network TEXT,
    tls BOOLEAN DEFAULT false,
    sni TEXT,
    alpn TEXT, -- JSON 字符串
    fingerprint TEXT,
    allow_insecure BOOLEAN DEFAULT false,

    -- WebSocket 配置
    ws_path TEXT,
    ws_headers TEXT, -- JSON 字符串

    -- HTTP/2 配置
    h2_path TEXT,
    h2_host TEXT, -- JSON 字符串

    -- gRPC 配置
    grpc_service_name TEXT,
    grpc_mode TEXT,

    -- 插件配置
    plugin TEXT,
    plugin_opts TEXT,

    -- Hysteria 配置
    obfs TEXT,
    obfs_password TEXT,
    up_mbps INTEGER,
    down_mbps INTEGER,
    auth TEXT,
    auth_str TEXT,
    protocol TEXT,

    -- 统计信息
    total_requests INTEGER DEFAULT 0,
    last_used DATETIME,

    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- X-UI 面板表
CREATE TABLE IF NOT EXISTS xui_panels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    remark TEXT,
    tags TEXT, -- JSON 字符串
    
    -- 连接配置
    timeout INTEGER DEFAULT 30,
    retry_count INTEGER DEFAULT 3,
    
    -- 统计信息
    total_nodes INTEGER DEFAULT 0,
    last_sync DATETIME,
    status TEXT DEFAULT 'offline', -- online, offline, error
    
    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 自定义订阅表
CREATE TABLE IF NOT EXISTS custom_subscriptions (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    node_ids TEXT NOT NULL, -- JSON 数组字符串
    enabled BOOLEAN DEFAULT true,
    
    -- 过滤配置
    include_types TEXT, -- JSON 字符串
    exclude_types TEXT, -- JSON 字符串
    include_keywords TEXT, -- JSON 字符串
    exclude_keywords TEXT, -- JSON 字符串
    
    -- 排序和分组
    sort_by TEXT DEFAULT 'name',
    sort_order TEXT DEFAULT 'asc',
    group_enabled BOOLEAN DEFAULT false,
    group_by TEXT DEFAULT 'type',
    
    -- 重命名规则
    rename_rules TEXT, -- JSON 字符串
    
    -- 统计信息
    total_requests INTEGER DEFAULT 0,
    last_accessed DATETIME,
    
    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);

-- 访问日志表
CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- subscription, api, admin
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
);

-- 系统设置表
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'string', -- string, number, boolean, json
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_nodes_enabled ON nodes(enabled);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_server ON nodes(server);
CREATE INDEX IF NOT EXISTS idx_xui_panels_enabled ON xui_panels(enabled);
CREATE INDEX IF NOT EXISTS idx_xui_panels_status ON xui_panels(status);
CREATE INDEX IF NOT EXISTS idx_custom_subscriptions_enabled ON custom_subscriptions(enabled);
CREATE INDEX IF NOT EXISTS idx_custom_subscriptions_expires ON custom_subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_access_logs_type ON access_logs(type);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 插入默认管理员用户（密码将在首次启动时设置）
INSERT OR IGNORE INTO users (id, username, password, role, enabled) 
VALUES ('admin', 'admin', '', 'admin', true);

-- 插入默认系统设置
INSERT OR IGNORE INTO settings (key, value, description, type) VALUES
('app_name', 'Sub-Store', '应用名称', 'string'),
('app_version', '2.0.0', '应用版本', 'string'),
('max_nodes_per_subscription', '1000', '每个订阅最大节点数', 'number'),
('default_subscription_interval', '86400', '默认订阅更新间隔（秒）', 'number'),
('enable_access_log', 'true', '启用访问日志', 'boolean'),
('log_retention_days', '30', '日志保留天数', 'number');
