# 快速修复D1数据库配置错误

## 🚨 当前状态

根据验证脚本的结果：
- ✅ wrangler.toml配置正确（包含环境变量占位符）
- ✅ Workers API响应正常
- ❌ 数据库健康信息不可用（D1配置问题）
- ❌ GitHub Secrets未配置

## 🔧 快速修复方案

### 方案1: 临时硬编码配置（立即修复）

如果需要立即修复部署问题，可以临时使用硬编码配置：

1. **创建Cloudflare D1数据库**：
   ```bash
   wrangler d1 create sub-store-db
   ```

2. **临时修改wrangler.toml**：
   将环境变量占位符替换为实际值：
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "sub-store-db"
   database_id = "你的实际数据库ID"
   ```

3. **推送修复**：
   ```bash
   git add workers/wrangler.toml
   git commit -m "临时修复D1数据库配置"
   git push origin master
   ```

### 方案2: 正确的Secrets配置（推荐）

#### 步骤1: 创建D1数据库
```bash
# 使用Wrangler CLI
wrangler d1 create sub-store-db

# 记录输出的数据库ID，格式类似：
# database_id = "12345678-1234-1234-1234-123456789abc"
```

#### 步骤2: 配置GitHub Secrets

**手动配置**（推荐）：
1. 访问：https://github.com/senma231/sub-store/settings/secrets/actions
2. 点击 "New repository secret"
3. 添加以下两个Secrets：

   **Secret 1:**
   - Name: `CF_D1_DATABASE_NAME`
   - Secret: `sub-store-db`

   **Secret 2:**
   - Name: `CF_D1_DATABASE_ID`
   - Secret: `你从步骤1获取的数据库ID`

#### 步骤3: 验证配置
```bash
# 推送任何更改触发重新部署
git commit --allow-empty -m "触发重新部署以应用D1数据库配置"
git push origin master
```

## 🔍 验证修复结果

### 检查GitHub Actions
1. 访问：https://github.com/senma231/sub-store/actions
2. 查看最新的部署运行
3. 确认看到：
   ```
   ✅ D1 数据库配置完成
   数据库名称: sub-store-db
   数据库ID: ********
   ✅ 配置文件验证通过
   ```

### 检查Workers健康状态
```bash
curl https://substore-api.senmago231.workers.dev/health
```

应该返回：
```json
{
  "status": "healthy",
  "database": {
    "healthy": true,
    "nodeCount": 0,
    "subscriptionCount": 0
  }
}
```

### 运行验证脚本
```bash
node scripts/verify-d1-config.js
```

应该显示：
```
✅ 所有检查通过！D1数据库配置正确
🎉 Sub-Store系统已准备就绪
```

## 📋 数据库表结构

配置完成后，需要创建数据库表：

```bash
# 创建schema.sql文件
cat > schema.sql << 'EOF'
CREATE TABLE IF NOT EXISTS nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    server TEXT NOT NULL,
    port INTEGER NOT NULL,
    enabled BOOLEAN DEFAULT true,
    uuid TEXT,
    password TEXT,
    method TEXT,
    network TEXT,
    path TEXT,
    host TEXT,
    tls BOOLEAN DEFAULT false,
    sni TEXT,
    alpn TEXT,
    fingerprint TEXT,
    remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_subscriptions (
    uuid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    node_ids TEXT NOT NULL,
    format TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    access_count INTEGER DEFAULT 0,
    last_accessed DATETIME
);

CREATE INDEX IF NOT EXISTS idx_nodes_enabled ON nodes(enabled);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_custom_subscriptions_expires ON custom_subscriptions(expires_at);
EOF

# 执行SQL
wrangler d1 execute sub-store-db --file=schema.sql

# 清理
rm schema.sql
```

## 🎯 预期结果

修复完成后：

1. **GitHub Actions部署成功**
2. **Workers API健康检查通过**
3. **D1数据库连接正常**
4. **Sub-Store系统完全可用**

## 🆘 如果仍有问题

1. **检查数据库是否存在**：
   ```bash
   wrangler d1 list
   ```

2. **检查数据库ID格式**：
   确保是标准UUID格式：`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

3. **检查Secrets配置**：
   确保Secret名称完全匹配：`CF_D1_DATABASE_NAME`和`CF_D1_DATABASE_ID`

4. **查看详细错误日志**：
   在GitHub Actions中查看完整的部署日志

---

**选择方案2进行正确的配置，这样可以保持代码的安全性和可维护性！** 🚀
