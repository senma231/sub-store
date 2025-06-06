# 🗄️ **D1 数据库设置指南**

## 🎯 **当前状态**
- ✅ Workers 已成功部署并运行
- ✅ 基础 API 功能正常
- 🔄 需要启用 D1 数据库以获得完整功能

## 📋 **手动设置步骤**

### **步骤 1: 通过 Cloudflare Dashboard 创建 D1 数据库**

1. **访问 Cloudflare Dashboard**
   - 打开: https://dash.cloudflare.com/
   - 登录你的 Cloudflare 账户

2. **创建 D1 数据库**
   - 在左侧菜单中选择 "Workers & Pages"
   - 点击 "D1 SQL Database"
   - 点击 "Create database"
   - 数据库名称: `sub-store-db`
   - 点击 "Create"

3. **获取数据库信息**
   - 创建完成后，记录以下信息：
     - Database Name: `sub-store-db`
     - Database ID: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### **步骤 2: 运行数据库迁移**

1. **在 D1 控制台中执行 SQL**
   - 在数据库详情页面，点击 "Console" 标签
   - 复制以下 SQL 内容并执行：

```sql
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 节点表
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  server TEXT NOT NULL,
  port INTEGER NOT NULL,
  uuid TEXT,
  password TEXT,
  method TEXT,
  plugin TEXT,
  plugin_opts TEXT,
  obfs TEXT,
  obfs_host TEXT,
  obfs_uri TEXT,
  protocol TEXT,
  protocol_param TEXT,
  remarks TEXT,
  group TEXT,
  enabled BOOLEAN DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 自定义订阅表
CREATE TABLE IF NOT EXISTS custom_subscriptions (
  id TEXT PRIMARY KEY,
  uuid TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  node_ids TEXT NOT NULL,
  format TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  access_count INTEGER DEFAULT 0,
  last_access_at TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_nodes_enabled ON nodes(enabled);
CREATE INDEX IF NOT EXISTS idx_nodes_created_at ON nodes(created_at);
CREATE INDEX IF NOT EXISTS idx_custom_subscriptions_uuid ON custom_subscriptions(uuid);
CREATE INDEX IF NOT EXISTS idx_custom_subscriptions_created_at ON custom_subscriptions(created_at);

-- 插入默认管理员用户
INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at, updated_at)
VALUES (
  'admin-001',
  'admin',
  '$2b$10$rQZ9vKzqzqzqzqzqzqzqzOeKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK',
  'admin',
  datetime('now'),
  datetime('now')
);
```

### **步骤 3: 更新 wrangler.toml 配置**

1. **编辑 `workers/wrangler.toml`**
   - 找到被注释的 D1 配置部分
   - 取消注释并更新为真实的数据库 ID：

```toml
# 取消注释这部分
[[d1_databases]]
binding = "DB"
database_name = "sub-store-db"
database_id = "你的真实数据库ID"  # 替换为步骤1中获取的 Database ID
```

### **步骤 4: 重新部署**

1. **提交更改**
   ```bash
   git add workers/wrangler.toml
   git commit -m "🗄️ 启用 D1 数据库配置"
   git push origin master
   ```

2. **等待自动部署**
   - GitHub Actions 会自动触发部署
   - 等待部署完成

### **步骤 5: 验证数据库功能**

1. **检查健康状态**
   - 访问: https://substore-api.senmago231.workers.dev/health
   - 确认 `database.nodeCount` 不再是 0

2. **测试节点管理**
   - 登录前端: https://sub-store-frontend.pages.dev
   - 使用管理员账户登录 (admin / Sz@2400104)
   - 测试添加、编辑、删除节点

## 🔧 **替代方案：使用 GitHub Actions**

如果你有 Cloudflare API Token，可以通过 GitHub Actions 自动创建：

1. **设置 GitHub Secrets**
   - 在 GitHub 仓库设置中添加：
     - `CLOUDFLARE_API_TOKEN`: 你的 Cloudflare API Token
     - `CF_D1_DATABASE_NAME`: `sub-store-db`

2. **手动触发工作流**
   - 在 GitHub Actions 页面手动运行部署工作流
   - 工作流会自动创建数据库并配置

## 📊 **预期结果**

配置完成后，健康检查应该显示：

```json
{
  "status": "healthy",
  "database": {
    "nodeCount": 0,
    "subscriptionCount": 0
  },
  "services": {
    "database": "healthy"
  }
}
```

## 🚨 **注意事项**

1. **数据库 ID 保密**: 不要在公开代码中暴露真实的数据库 ID
2. **备份重要**: 在生产环境中定期备份数据库
3. **权限管理**: 确保只有授权用户可以访问数据库控制台

---

**下一步**: 完成数据库配置后，运行验证脚本确认所有功能正常工作。
