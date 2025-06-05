# 🚀 Sub-Store 部署配置指南

## 📋 环境变量配置

### Workers 环境变量

在 Cloudflare Workers 设置中配置以下环境变量：

```bash
# 必需配置
ADMIN_TOKEN=your-secure-admin-password
JWT_SECRET=your-jwt-secret-key-at-least-32-characters

# 可选配置
ENVIRONMENT=production
APP_NAME=Sub-Store API
CORS_ORIGINS=https://your-frontend-domain.pages.dev,https://your-custom-domain.com
```

### GitHub Actions Secrets

在 GitHub 仓库的 Settings > Secrets and variables > Actions 中配置：

```bash
# Cloudflare 配置
CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id

# Workers 配置
ADMIN_TOKEN=your-secure-admin-password
JWT_SECRET=your-jwt-secret-key-at-least-32-characters

# Pages 配置 (如果使用)
CLOUDFLARE_PROJECT_NAME=your-pages-project-name
```

## 🌐 域名配置

### 1. Workers 自定义域名

如果您为 Workers 配置了自定义域名：

1. 在 Cloudflare Dashboard 中为 Workers 添加自定义域名
2. 更新 `frontend/.env.production` 中的 `VITE_API_BASE_URL`：

```bash
VITE_API_BASE_URL=https://api.yourdomain.com
```

### 2. Pages 自定义域名

如果您为 Pages 配置了自定义域名：

1. 在 Cloudflare Dashboard 中为 Pages 添加自定义域名
2. 更新 Workers 的 `CORS_ORIGINS` 环境变量：

```bash
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 3. 同时使用自定义域名

如果 Workers 和 Pages 都使用自定义域名：

**Workers 环境变量：**
```bash
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

**前端环境变量：**
```bash
VITE_API_BASE_URL=https://api.yourdomain.com
```

## 🔧 常见问题解决

### 405 Method Not Allowed 错误

1. **检查 API 基础 URL**：确保前端的 `VITE_API_BASE_URL` 指向正确的 Workers 域名
2. **检查 CORS 配置**：确保 Workers 的 `CORS_ORIGINS` 包含前端域名
3. **检查路由配置**：确保请求路径正确（如 `/auth/login` 而不是 `/api/auth/login`）

### CORS 错误

1. **更新 CORS_ORIGINS**：在 Workers 环境变量中添加您的前端域名
2. **检查域名格式**：确保包含协议（https://）且没有尾随斜杠
3. **重新部署**：修改环境变量后需要重新部署 Workers

### 认证失败

1. **检查 ADMIN_TOKEN**：确保 Workers 和 GitHub Actions 中的值一致
2. **检查 JWT_SECRET**：确保至少 32 个字符长度
3. **清除浏览器缓存**：清除 localStorage 中的认证信息

## 📝 部署检查清单

- [ ] Workers 环境变量已配置
- [ ] GitHub Actions Secrets 已配置
- [ ] 前端环境变量已配置
- [ ] CORS 域名已正确设置
- [ ] 自定义域名已配置（如果使用）
- [ ] 部署成功且无错误
- [ ] 前端可以正常访问
- [ ] 登录功能正常工作
