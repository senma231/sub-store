# Cloudflare D1数据库配置错误修复指南

## 🚨 当前问题

根据GitHub Actions部署日志，系统显示以下错误：
```
✘ [ERROR] You must use a real database in the database_id configuration. You can find your databases using 'wrangler d1 list', or read how to develop locally with D1 here: https://developers.cloudflare.com/d1/configuration/local-development
```

**问题根源**：`wrangler.toml`中的`database_id = "${CF_D1_DATABASE_ID}"`占位符没有被实际的数据库ID替换。

## 🔧 解决方案

### 步骤1: 创建Cloudflare D1数据库

#### 方法1: 使用Wrangler CLI (推荐)
```bash
# 1. 安装Wrangler CLI
npm install -g wrangler

# 2. 登录Cloudflare
wrangler auth login

# 3. 创建D1数据库
wrangler d1 create sub-store-db

# 4. 记录输出的数据库信息
# 输出示例：
# ✅ Successfully created DB 'sub-store-db'
# 
# [[d1_databases]]
# binding = "DB"
# database_name = "sub-store-db"
# database_id = "12345678-1234-1234-1234-123456789abc"
```

#### 方法2: 使用Cloudflare Dashboard
1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 导航到 **D1** 部分
3. 点击 **Create database**
4. 输入数据库名称：`sub-store-db`
5. 点击 **Create**
6. 记录生成的 **Database ID**

### 步骤2: 配置GitHub Repository Secrets

#### 自动配置 (如果有GitHub CLI)
```bash
# 1. 安装GitHub CLI
# 访问: https://cli.github.com/

# 2. 登录GitHub
gh auth login

# 3. 设置Secrets
gh secret set CF_D1_DATABASE_NAME --body "sub-store-db" --repo senma231/sub-store
gh secret set CF_D1_DATABASE_ID --body "你的数据库ID" --repo senma231/sub-store
```

#### 手动配置
1. **访问Repository Secrets设置页面**：
   ```
   https://github.com/senma231/sub-store/settings/secrets/actions
   ```

2. **添加第一个Secret**：
   - 点击 **New repository secret**
   - Name: `CF_D1_DATABASE_NAME`
   - Secret: `sub-store-db`
   - 点击 **Add secret**

3. **添加第二个Secret**：
   - 点击 **New repository secret**
   - Name: `CF_D1_DATABASE_ID`
   - Secret: `你从步骤1获取的数据库ID`
   - 点击 **Add secret**

### 步骤3: 创建数据库表结构

使用Wrangler CLI执行以下SQL来创建必需的表：

```bash
# 创建临时SQL文件
cat > schema.sql << 'EOF'
-- 创建节点表
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

-- 创建自定义订阅表
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_nodes_enabled ON nodes(enabled);
CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
CREATE INDEX IF NOT EXISTS idx_custom_subscriptions_expires ON custom_subscriptions(expires_at);
EOF

# 执行SQL
wrangler d1 execute sub-store-db --file=schema.sql

# 清理临时文件
rm schema.sql
```

### 步骤4: 验证配置

#### 检查数据库
```bash
# 列出所有数据库
wrangler d1 list

# 查看特定数据库信息
wrangler d1 info sub-store-db

# 测试数据库连接
wrangler d1 execute sub-store-db --command="SELECT name FROM sqlite_master WHERE type='table';"
```

#### 检查GitHub Secrets
```bash
# 使用GitHub CLI检查
gh secret list --repo senma231/sub-store

# 应该看到：
# CF_D1_DATABASE_ID
# CF_D1_DATABASE_NAME
# CLOUDFLARE_API_TOKEN
# ADMIN_TOKEN
```

### 步骤5: 触发重新部署

1. **推送任何代码更改**：
   ```bash
   git commit --allow-empty -m "触发重新部署以应用D1数据库配置"
   git push origin master
   ```

2. **观察GitHub Actions日志**：
   - 访问 https://github.com/senma231/sub-store/actions
   - 查看最新的部署运行
   - 确认看到以下成功信息：
     ```
     ✅ D1 数据库配置完成
     数据库名称: sub-store-db
     数据库ID: ********
     ✅ 配置文件验证通过
     ```

## 🔍 故障排除

### 常见错误1: 数据库ID格式错误
**症状**：`database_id`不是有效的UUID格式
**解决**：确保数据库ID是标准的UUID格式：`xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### 常见错误2: Secret未配置
**症状**：GitHub Actions显示"CF_D1_DATABASE_ID secret 未配置"
**解决**：检查Repository Secrets设置，确保Secret名称完全匹配

### 常见错误3: 环境变量替换失败
**症状**：wrangler.toml中仍包含`${CF_D1_DATABASE_ID}`
**解决**：检查GitHub Actions日志，确认envsubst命令执行成功

### 常见错误4: 数据库不存在
**症状**：部署时提示数据库不存在
**解决**：使用`wrangler d1 create`重新创建数据库

## 📋 配置检查清单

- [ ] ✅ 已创建Cloudflare D1数据库
- [ ] ✅ 已获取正确的数据库ID和名称
- [ ] ✅ 已在GitHub Repository Secrets中配置`CF_D1_DATABASE_NAME`
- [ ] ✅ 已在GitHub Repository Secrets中配置`CF_D1_DATABASE_ID`
- [ ] ✅ 已创建数据库表结构
- [ ] ✅ 已验证数据库连接
- [ ] ✅ 已触发重新部署
- [ ] ✅ GitHub Actions部署成功
- [ ] ✅ Workers API健康检查通过

## 🎯 预期结果

配置完成后，你应该看到：

1. **GitHub Actions成功部署**：
   ```
   ✅ Workers API 部署成功
   ✅ 数据库连接配置正常
   ✅ 部署验证完成
   ```

2. **健康检查通过**：
   ```bash
   curl https://substore-api.senmago231.workers.dev/health
   ```
   返回：
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

3. **Sub-Store系统正常工作**：
   - 前端界面可以正常访问
   - 节点管理功能正常
   - 自定义订阅功能正常
   - 数据持久化正常

## 🆘 获取帮助

如果遇到问题：

1. **检查GitHub Actions日志**：查看详细的错误信息
2. **验证数据库状态**：使用`wrangler d1 info`检查
3. **检查Secrets配置**：确认所有必需的Secrets都已设置
4. **运行验证脚本**：使用`npm run verify:secrets`检查配置

---

**按照此指南完成配置后，Sub-Store的D1数据库配置错误将被完全修复！** 🚀
