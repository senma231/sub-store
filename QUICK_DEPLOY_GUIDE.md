# Sub-Store 快速部署指南

## 🚨 解决当前错误的两种方案

### 当前错误分析：
1. **Workers 部署错误**: `workers/dist/` 目录不存在 ✅ 已修复
2. **Cloudflare Pages 部署错误**: 项目 `sub-store-frontend` 不存在

---

## 🎯 方案一：手动创建 Pages 项目（推荐）

### 步骤1：手动创建 Cloudflare Pages 项目

1. **登录 Cloudflare Dashboard**
   - 访问：https://dash.cloudflare.com
   - 点击左侧菜单 "Pages"

2. **创建项目**
   - 点击 "Create a project"
   - 选择 "Connect to Git"
   - 选择您的 GitHub 仓库：`senma231/sub-store`

3. **配置构建设置**
   ```
   Project name: sub-store-frontend
   Production branch: master
   Build command: cd frontend && npm install --legacy-peer-deps && npm run build
   Build output directory: frontend/dist
   ```

4. **添加环境变量**
   - `VITE_API_BASE_URL` = `https://sub-store-api.senma231.workers.dev`

5. **保存并部署**
   - 点击 "Save and Deploy"

### 步骤2：配置 GitHub Secrets

在 GitHub 仓库设置中添加：
```
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
API_BASE_URL=https://sub-store-api.senma231.workers.dev
FRONTEND_URL=https://sub-store-frontend.pages.dev
```

### 步骤3：重新运行 GitHub Actions

推送代码或手动触发 Actions，现在应该可以成功部署！

---

## 🔧 方案二：使用 Wrangler 自动创建（已配置）

我已经修改了 GitHub Actions 配置，现在使用 `wrangler pages deploy` 命令，可以自动创建 Pages 项目。

### 只需要配置 GitHub Secrets：

```
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
API_BASE_URL=https://sub-store-api.senma231.workers.dev
FRONTEND_URL=https://sub-store-frontend.pages.dev
```

然后推送代码，GitHub Actions 会自动：
1. 构建前端和后端
2. 创建 D1 数据库
3. 部署 Workers
4. 自动创建并部署 Pages 项目

---

## 📋 获取 Cloudflare 凭据

### 获取 Account ID
1. 登录 Cloudflare Dashboard
2. 右侧边栏可以看到 Account ID

### 获取 API Token
1. 点击右上角头像 → "My Profile" → "API Tokens"
2. 点击 "Create Token" → "Custom token"
3. 权限设置：
   ```
   Account - Cloudflare Pages:Edit
   Account - Cloudflare Workers:Edit
   Account - D1:Edit
   Zone - Zone:Read (可选)
   ```

---

## ✅ 验证部署

部署成功后访问：
- **前端**: https://sub-store-frontend.pages.dev
- **API**: https://sub-store-api.senma231.workers.dev/health

---

## 🔍 故障排除

### 如果仍然出现 "Project not found" 错误：
1. 确保 Account ID 正确
2. 确保 API Token 有 Pages:Edit 权限
3. 使用方案一手动创建项目

### 如果 Workers 部署失败：
1. 检查 API Token 权限
2. 确保 D1 数据库创建成功

### 如果前端无法访问后端：
1. 检查 CORS 配置
2. 确认 API_BASE_URL 正确
3. 检查 Workers 部署状态

---

## 💡 推荐流程

1. **首次部署**: 使用方案一（手动创建）
2. **后续更新**: GitHub Actions 自动部署
3. **开发测试**: 使用本地环境

这样可以确保部署的稳定性和可靠性！
