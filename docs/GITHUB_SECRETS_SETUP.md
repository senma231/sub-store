# GitHub Repository Secrets 配置指南

## 🎯 概述

本指南详细说明如何使用 GitHub Repository Secrets 来安全管理 Sub-Store 项目的 Cloudflare D1 数据库配置，避免在代码仓库中硬编码敏感信息。

## 🔐 安全优势

- ✅ **敏感信息保护**：数据库配置不会出现在代码仓库中
- ✅ **环境隔离**：不同分支可以使用不同的数据库实例
- ✅ **访问控制**：只有授权的 GitHub Actions 可以访问 Secrets
- ✅ **审计追踪**：Secret 的使用和修改都有完整的日志记录

## 📋 必需的 GitHub Secrets

### D1 数据库配置
| Secret 名称 | 描述 | 示例值 | 必需 |
|------------|------|--------|------|
| `CF_D1_DATABASE_NAME` | D1 数据库名称 | `sub-store-db` | ✅ |
| `CF_D1_DATABASE_ID` | D1 数据库 UUID | `12345678-1234-1234-1234-123456789abc` | ✅ |

### Cloudflare 认证
| Secret 名称 | 描述 | 获取方式 | 必需 |
|------------|------|----------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token | Dashboard > My Profile > API Tokens | ✅ |

### 应用配置
| Secret 名称 | 描述 | 示例值 | 必需 |
|------------|------|--------|------|
| `ADMIN_TOKEN` | 管理员登录密码 | `your-secure-password` | ✅ |
| `JWT_SECRET` | JWT 签名密钥 | `your-jwt-secret-key` | ⚠️ |

> ⚠️ `JWT_SECRET` 是可选的，系统会自动生成。

## 🚀 快速配置

### 方法 1: 使用自动化脚本 (推荐)

1. **运行配置脚本**：
   ```bash
   chmod +x scripts/setup-github-secrets.sh
   ./scripts/setup-github-secrets.sh
   ```

2. **按照提示输入**：
   - D1 数据库名称
   - D1 数据库 ID

3. **脚本会自动**：
   - 验证 GitHub CLI 认证
   - 设置 D1 相关的 Secrets
   - 检查其他必需的 Secrets

### 方法 2: 手动配置

1. **访问 GitHub Repository Settings**：
   ```
   https://github.com/senma231/sub-store/settings/secrets/actions
   ```

2. **点击 "New repository secret"**

3. **逐个添加 Secrets**：
   - 名称：`CF_D1_DATABASE_NAME`，值：`sub-store-db`
   - 名称：`CF_D1_DATABASE_ID`，值：你的数据库 UUID

## 🗄️ 获取 D1 数据库信息

### 方法 1: Cloudflare Dashboard
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 导航到 **D1** 部分
3. 选择你的数据库
4. 在右侧面板查看 **Database ID**

### 方法 2: Wrangler CLI
```bash
# 列出所有数据库
wrangler d1 list

# 查看特定数据库信息
wrangler d1 info sub-store-db
```

### 方法 3: 创建新数据库
```bash
# 创建新的 D1 数据库
wrangler d1 create sub-store-db

# 输出示例:
# ✅ Successfully created DB 'sub-store-db'
# 
# [[d1_databases]]
# binding = "DB"
# database_name = "sub-store-db"
# database_id = "12345678-1234-1234-1234-123456789abc"
```

## 🔧 GitHub Actions 工作流程

### 配置注入流程
1. **读取 Secrets**：从 GitHub Repository Secrets 读取数据库配置
2. **验证配置**：检查必需的 Secrets 是否存在
3. **动态替换**：使用 `envsubst` 替换 `wrangler.toml` 中的占位符
4. **验证格式**：确保配置文件格式正确
5. **部署应用**：使用配置好的 `wrangler.toml` 部署 Workers

### 安全措施
- ✅ **敏感信息隐藏**：在日志中隐藏数据库 ID
- ✅ **配置验证**：部署前验证配置文件格式
- ✅ **错误处理**：配置失败时停止部署
- ✅ **连接测试**：部署后验证数据库连接

## 📝 配置文件模板

### wrangler.toml
```toml
# D1 数据库配置 (替换 KV)
# 注意：database_id 和 database_name 将在部署时通过环境变量动态注入
# 这些值存储在 GitHub Repository Secrets 中以确保安全性
[[d1_databases]]
binding = "DB"
database_name = "${CF_D1_DATABASE_NAME}"
database_id = "${CF_D1_DATABASE_ID}"
```

### GitHub Actions 环境变量替换
```yaml
- name: Configure D1 Database Settings
  run: |
    # 设置环境变量
    export CF_D1_DATABASE_ID="${{ secrets.CF_D1_DATABASE_ID }}"
    export CF_D1_DATABASE_NAME="${{ secrets.CF_D1_DATABASE_NAME }}"
    
    # 替换占位符
    envsubst < wrangler.toml > wrangler.toml.tmp && mv wrangler.toml.tmp wrangler.toml
```

## 🌍 多环境配置

### 生产环境 (master 分支)
```
CF_D1_DATABASE_NAME: sub-store-db
CF_D1_DATABASE_ID: production-database-uuid
```

### 开发环境 (develop 分支)
```
CF_D1_DATABASE_NAME: sub-store-db-dev
CF_D1_DATABASE_ID: development-database-uuid
```

### 环境特定的 Secrets
可以使用 GitHub Environments 为不同环境设置不同的 Secrets：

1. **创建环境**：
   - Repository Settings > Environments
   - 创建 `production` 和 `development` 环境

2. **设置环境特定的 Secrets**：
   - 在每个环境中设置相应的数据库配置

3. **修改 GitHub Actions**：
   ```yaml
   deploy-workers:
     environment: production  # 或 development
     # ... 其他配置
   ```

## 🔍 故障排除

### 常见问题

#### 1. Secret 未配置
**错误信息**：
```
❌ 错误：CF_D1_DATABASE_ID secret 未配置
```

**解决方案**：
- 检查 Secret 名称是否正确
- 确认 Secret 已在正确的仓库中设置
- 验证 GitHub Actions 有权限访问 Secrets

#### 2. 环境变量替换失败
**错误信息**：
```
❌ 错误：环境变量替换失败
```

**解决方案**：
- 检查 `envsubst` 命令是否可用
- 验证占位符格式：`${VARIABLE_NAME}`
- 确认环境变量已正确设置

#### 3. 数据库连接失败
**错误信息**：
```
Database connection failed
```

**解决方案**：
- 验证数据库 ID 是否正确
- 检查数据库是否存在
- 确认 API Token 有 D1 权限

### 调试步骤

1. **检查 Secrets 配置**：
   ```bash
   gh secret list --repo senma231/sub-store
   ```

2. **验证数据库存在**：
   ```bash
   wrangler d1 list
   wrangler d1 info your-database-name
   ```

3. **测试 API Token 权限**：
   ```bash
   wrangler auth whoami
   wrangler d1 list
   ```

4. **查看 GitHub Actions 日志**：
   - 访问 Actions 页面查看详细的部署日志
   - 检查配置注入步骤的输出

## 📚 相关文档

- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions Environment Variables](https://docs.github.com/en/actions/learn-github-actions/environment-variables)

## 🆘 获取帮助

如果遇到问题，请：

1. **检查文档**：查看上述故障排除部分
2. **查看日志**：检查 GitHub Actions 的详细日志
3. **验证配置**：使用提供的调试命令验证配置
4. **寻求支持**：在项目 Issues 中报告问题

---

**配置完成后，你的 Sub-Store 项目将使用安全的 GitHub Secrets 管理数据库配置！** 🎉
