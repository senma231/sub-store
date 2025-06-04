# Sub-Store 部署指南

## 错误分析与解决方案

### 当前遇到的两个错误：

1. **Workers 部署错误**: `workers/dist/` 目录不存在
2. **Cloudflare Pages 部署错误**: 项目 `sub-store-frontend` 不存在

## 完整部署步骤

### 第一步：配置 Cloudflare

#### 1.1 获取 Cloudflare 凭据
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 获取 **Account ID**:
   - 右侧边栏可以看到 Account ID
3. 获取 **API Token**:
   - 点击右上角头像 → "My Profile" → "API Tokens"
   - 点击 "Create Token" → "Custom token"
   - 权限设置：
     ```
     Account - Cloudflare Pages:Edit
     Account - D1:Edit  
     Zone - Zone:Read
     Zone - DNS:Edit
     ```

#### 1.2 创建 Cloudflare Pages 项目（必须手动创建）

⚠️ **重要**: Cloudflare Pages 项目无法通过 API 自动创建，必须手动创建！

1. **登录 Cloudflare Dashboard**
   - 访问：https://dash.cloudflare.com
   - 点击左侧菜单 "Pages"

2. **创建新项目**
   - 点击 "Create a project"
   - 选择 "Connect to Git"

3. **连接 GitHub 仓库**
   - 如果首次使用，需要授权 Cloudflare 访问 GitHub
   - 选择您的仓库：`senma231/sub-store`

4. **配置构建设置**
   ```
   Project name: sub-store-frontend
   Production branch: master
   Framework preset: None
   Build command: cd frontend && npm install --legacy-peer-deps && npm run build
   Build output directory: frontend/dist
   Root directory: (留空)
   ```

5. **环境变量设置**
   - 点击 "Environment variables"
   - 添加：`VITE_API_BASE_URL` = `https://sub-store-api.senma231.workers.dev`

6. **开始部署**
   - 点击 "Save and Deploy"
   - 等待首次部署完成（约3-5分钟）

7. **记录 Pages URL**
   - 部署完成后，记录 Pages URL：`https://sub-store-frontend.pages.dev`

### 第二步：配置 GitHub Secrets

在 GitHub 仓库设置中添加以下 Secrets：

1. 进入仓库 → Settings → Secrets and variables → Actions
2. 添加以下 Repository secrets：

```
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
API_BASE_URL=https://sub-store-api.senma231.workers.dev
FRONTEND_URL=https://sub-store-frontend.pages.dev
```

### 第三步：部署 Workers 和 D1 数据库

#### 3.1 本地准备（可选，用于测试）
```bash
# 安装 wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 进入 workers 目录
cd workers

# 创建 D1 数据库
wrangler d1 create sub-store-db

# 记录返回的 database_id，更新 wrangler.toml
```

#### 3.2 通过 GitHub Actions 自动部署
1. 确保所有 Secrets 已正确配置
2. 推送代码到 master 分支
3. GitHub Actions 将自动：
   - 构建前端和后端
   - 创建 D1 数据库（如果不存在）
   - 部署 Workers
   - 部署到 Cloudflare Pages

### 第四步：验证部署

#### 4.1 检查部署状态
- **前端**: https://sub-store-frontend.pages.dev
- **API**: https://sub-store-api.senma231.workers.dev

#### 4.2 测试 API 端点
```bash
# 健康检查
curl https://sub-store-api.senma231.workers.dev/health

# 获取订阅列表
curl https://sub-store-api.senma231.workers.dev/api/subscriptions
```

## 安全注意事项

### 1. Secrets 管理
- 所有敏感信息都通过 GitHub Secrets 管理
- API Token 具有最小权限原则
- 定期轮换 API Token

### 2. CORS 配置
- 已在 `wrangler.toml` 中配置正确的 CORS 源
- 只允许来自 Pages 域名的请求

### 3. 环境隔离
- 生产环境使用独立的数据库
- 可以配置 staging 环境进行测试

## 故障排除

### 常见问题

1. **"Project not found" 错误**
   - 确保在 Cloudflare Pages 中创建了名为 `sub-store-frontend` 的项目
   - 检查 Account ID 是否正确

2. **D1 数据库错误**
   - 首次部署时数据库会自动创建
   - 如果失败，可以手动创建后更新 `wrangler.toml`

3. **Workers 构建失败**
   - 检查 TypeScript 类型错误
   - 确保所有依赖都已正确安装

4. **CORS 错误**
   - 检查 `wrangler.toml` 中的 CORS_ORIGINS 配置
   - 确保包含正确的前端域名

### 调试命令

```bash
# 查看 Workers 日志
wrangler tail sub-store-api

# 本地开发模式
cd workers && npm run dev

# 检查 D1 数据库
wrangler d1 execute sub-store-db --command="SELECT name FROM sqlite_master WHERE type='table';"
```

## 下一步

1. 配置自定义域名（可选）
2. 设置监控和告警
3. 配置 CDN 缓存策略
4. 添加更多的健康检查端点
