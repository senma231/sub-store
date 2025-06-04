-- Sub-Store D1 数据库表结构
-- 创建时间: 2024-01-01

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    enabled BOOLEAN DEFAULT 1
);

-- 代理节点表
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- vless, vmess, trojan, ss, socks5, hy2, hy
    server TEXT NOT NULL,
    port INTEGER NOT NULL,
    
    -- 通用配置
    enabled BOOLEAN DEFAULT 1,
    tags TEXT, -- JSON 数组
    remark TEXT,
    
    -- VLESS/VMess 配置
    uuid TEXT,
    encryption TEXT,
    flow TEXT,
    alter_id INTEGER,
    security TEXT, -- none, auto, aes-128-gcm, aes-256-gcm, chacha20-poly1305
    
    -- Trojan/SS 配置
    password TEXT,
    method TEXT, -- SS 加密方法
    
    -- SOCKS5 配置
    username TEXT,
    
    -- 网络配置
    network TEXT DEFAULT 'tcp', -- tcp, udp, ws, h2, grpc, quic
    tls BOOLEAN DEFAULT 0,
    sni TEXT,
    alpn TEXT, -- JSON 数组
    fingerprint TEXT,
    allow_insecure BOOLEAN DEFAULT 0,
    
    -- WebSocket 配置
    ws_path TEXT,
    ws_headers TEXT, -- JSON 对象
    
    -- HTTP/2 配置
    h2_path TEXT,
    h2_host TEXT, -- JSON 数组
    
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

-- 订阅表
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT 1,
    
    -- 过滤配置
    include_types TEXT, -- JSON 数组
    exclude_types TEXT, -- JSON 数组
    include_keywords TEXT, -- JSON 数组
    exclude_keywords TEXT, -- JSON 数组
    
    -- 排序和分组
    sort_by TEXT DEFAULT 'name',
    sort_order TEXT DEFAULT 'asc',
    group_enabled BOOLEAN DEFAULT 0,
    group_by TEXT DEFAULT 'type',
    
    -- 重命名规则
    rename_rules TEXT, -- JSON 数组
    
    -- 统计信息
    total_requests INTEGER DEFAULT 0,
    last_accessed DATETIME,
    
    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 订阅节点关联表
CREATE TABLE IF NOT EXISTS subscription_nodes (
    subscription_id TEXT,
    node_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (subscription_id, node_id),
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- 访问统计表
CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- api, subscription
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    
    -- 请求信息
    user_agent TEXT,
    ip_address TEXT,
    referer TEXT,
    
    -- 订阅相关
    subscription_format TEXT,
    node_count INTEGER,
    
    -- 响应信息
    status_code INTEGER,
    response_time INTEGER, -- 毫秒
    
    -- 时间戳
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 系统配置表
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
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_enabled ON nodes(enabled);
CREATE INDEX IF NOT EXISTS idx_nodes_server ON nodes(server);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_access_logs_type ON access_logs(type);
CREATE INDEX IF NOT EXISTS idx_access_logs_ip ON access_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 插入默认管理员用户
INSERT OR IGNORE INTO users (id, username, password, role) 
VALUES ('admin', 'admin', 'change_me_on_first_deploy', 'admin');

-- 插入默认系统配置
INSERT OR IGNORE INTO settings (key, value, description, type) VALUES
('app_name', 'Sub-Store', '应用名称', 'string'),
('app_version', '2.0.0', '应用版本', 'string'),
('max_nodes_per_subscription', '100', '每个订阅最大节点数', 'number'),
('enable_analytics', 'true', '启用访问统计', 'boolean'),
('analytics_retention_days', '30', '统计数据保留天数', 'number'),
('rate_limit_requests', '100', '速率限制（请求/分钟）', 'number'),
('subscription_update_interval', '3600', '订阅更新间隔（秒）', 'number');
