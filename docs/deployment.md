# Sub-Store 部署指南

本指南将帮助您在 GitHub + Cloudflare 平台上安全部署 Sub-Store 代理节点订阅管理系统。

## 🔒 安全须知

**重要提醒**: 本项目可以公开发布，但部署时需要注意以下安全事项：

1. **GitHub Secrets**: 敏感信息（API Token、密钥等）通过 GitHub Secrets 存储，不会暴露在代码中
2. **环境变量**: 生产环境的配置通过 Cloudflare Workers 的环境变量和 Secrets 管理
3. **访问控制**: 管理员密码和 JWT 密钥在部署时单独设置
4. **代码安全**: 项目代码本身不包含任何敏感信息，可以安全地公开

## 🚀 快速部署

### 1. 准备工作

#### 1.1 GitHub 账户
- 注册 [GitHub](https://github.com) 账户
- **Fork 本项目**到您的 GitHub 账户（不是直接 clone）
- 这样您就有了自己的私有副本来管理 Secrets

#### 1.2 Cloudflare 账户
- 注册 [Cloudflare](https://cloudflare.com) 账户
- 获取 Cloudflare API Token（下面有详细步骤）
- 记录 Account ID

### 2. Cloudflare 配置

#### 2.1 创建 KV 命名空间
```bash
# 使用 Wrangler CLI
wrangler kv:namespace create "SUB_STORE_KV"
wrangler kv:namespace create "SUB_STORE_KV" --preview
```

#### 2.2 获取必要信息
- **API Token**: Cloudflare Dashboard → My Profile → API Tokens → Create Token
- **Account ID**: Cloudflare Dashboard → 右侧边栏
- **Zone ID**: 如果使用自定义域名需要

### 3. GitHub 配置

#### 3.1 设置 Secrets

**重要**: GitHub Secrets 是安全存储敏感信息的方式，只有仓库所有者可以查看和修改。

**步骤**:
1. 进入您 Fork 的项目页面
2. 点击 `Settings` → `Secrets and variables` → `Actions`
3. 点击 `New repository secret` 添加以下 Secrets：

| Secret 名称 | 说明 | 示例值 |
|------------|------|--------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 令牌 | `abc123...` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID | `def456...` |
| `CLOUDFLARE_ZONE_ID` | 域名 Zone ID (可选) | `ghi789...` |
| `API_BASE_URL` | Workers API 地址 | `https://sub-store-api.your-username.workers.dev` |
| `FRONTEND_URL` | 前端访问地址 | `https://your-username.github.io/sub-store` |

**获取 Cloudflare API Token 步骤**:
1. 登录 Cloudflare Dashboard
2. 点击右上角头像 → `My Profile`
3. 选择 `API Tokens` 标签
4. 点击 `Create Token`
5. 选择 `Custom token` 模板
6. 设置权限：
   - `Account` - `Cloudflare Workers:Edit`
   - `Zone` - `Zone:Read` (如果使用自定义域名)
   - `Zone` - `Zone Settings:Edit` (如果使用自定义域名)
7. 复制生成的 Token

#### 3.2 启用 GitHub Pages
1. 进入项目设置 → Pages
2. Source 选择 "GitHub Actions"
3. 保存设置

### 4. 配置文件修改

#### 4.1 更新 wrangler.toml
```toml
# workers/wrangler.toml
name = "sub-store-api"
main = "src/index.ts"
compatibility_date = "2023-12-18"

[[kv_namespaces]]
binding = "SUB_STORE_KV"
id = "your_kv_namespace_id"
preview_id = "your_preview_kv_namespace_id"

[vars]
ENVIRONMENT = "production"
APP_NAME = "Sub-Store"
CORS_ORIGINS = "https://your-username.github.io"
```

#### 4.2 设置环境变量
```bash
# 设置 Workers 密钥
wrangler secret put ADMIN_TOKEN
wrangler secret put JWT_SECRET
```

### 5. 部署

#### 5.1 自动部署
推送代码到 main 分支将自动触发部署：

```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

#### 5.2 手动部署
```bash
# 部署 Workers
cd workers
npm install
npm run deploy

# 构建前端
cd ../frontend
npm install
npm run build
```

## 🔧 高级配置

### 1. 自定义域名

#### 1.1 Workers 自定义域名
1. Cloudflare Dashboard → Workers → 选择您的 Worker
2. Settings → Triggers → Add Custom Domain
3. 输入您的域名（如：api.yourdomain.com）

#### 1.2 前端自定义域名
1. GitHub Pages 设置中添加自定义域名
2. 在域名 DNS 中添加 CNAME 记录指向 `your-username.github.io`

### 2. 环境变量配置

#### 2.1 Workers 环境变量
```bash
# 管理员令牌
wrangler secret put ADMIN_TOKEN

# JWT 密钥
wrangler secret put JWT_SECRET

# Cloudflare API Token (如需要)
wrangler secret put CLOUDFLARE_API_TOKEN
```

#### 2.2 前端环境变量
在 GitHub Actions 中设置：
```yaml
env:
  VITE_API_BASE_URL: ${{ secrets.API_BASE_URL }}
  VITE_APP_TITLE: Sub-Store
```

### 3. 数据库初始化

首次部署后，系统会自动初始化必要的数据结构。您也可以手动初始化：

```bash
# 使用 curl 初始化
curl -X POST https://your-api-domain.workers.dev/api/init \
  -H "Authorization: Admin your_admin_token"
```

## 📋 部署检查清单

- [ ] GitHub 项目已 Fork
- [ ] Cloudflare 账户已注册
- [ ] KV 命名空间已创建
- [ ] GitHub Secrets 已配置
- [ ] wrangler.toml 已更新
- [ ] Workers 密钥已设置
- [ ] GitHub Pages 已启用
- [ ] 自动部署已触发
- [ ] 前端可正常访问
- [ ] API 健康检查通过
- [ ] 管理员登录正常

## 🔍 故障排除

### 1. 部署失败

#### Workers 部署失败
```bash
# 检查 wrangler 配置
wrangler whoami
wrangler kv:namespace list

# 重新部署
cd workers
npm run deploy
```

#### 前端部署失败
- 检查 GitHub Actions 日志
- 确认 GitHub Pages 设置正确
- 检查环境变量配置

### 2. 访问问题

#### API 无法访问
- 检查 Workers 域名是否正确
- 确认 CORS 配置
- 检查 KV 命名空间绑定

#### 前端无法访问
- 检查 GitHub Pages 状态
- 确认自定义域名配置
- 检查 DNS 解析

### 3. 功能异常

#### 登录失败
- 检查 ADMIN_TOKEN 是否正确设置
- 确认 JWT_SECRET 已配置
- 查看浏览器控制台错误

#### 节点操作失败
- 检查 KV 存储权限
- 确认数据格式正确
- 查看 Workers 日志

## 📚 相关文档

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [GitHub Pages 文档](https://docs.github.com/en/pages)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)

## 💡 最佳实践

1. **安全性**
   - 使用强密码作为 ADMIN_TOKEN
   - 定期更换 JWT_SECRET
   - 启用适当的 CORS 策略

2. **性能优化**
   - 合理设置缓存策略
   - 优化 KV 存储访问
   - 使用 CDN 加速前端资源

3. **监控运维**
   - 定期检查 Workers 日志
   - 监控 KV 存储使用量
   - 备份重要配置数据

4. **成本控制**
   - 了解 Cloudflare 免费额度
   - 监控 Workers 请求量
   - 优化不必要的 API 调用
