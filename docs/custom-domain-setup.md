# 🌐 Sub-Store 自定义域名配置指南

本指南将帮助你为 Sub-Store 配置自定义域名，包括前端和后端 API 的域名设置。

## 📋 配置概览

### 当前配置
- **前端域名**: `sub.senma.io` (Cloudflare Pages)
- **后端 API 域名**: `sub-api.senma.io` (Cloudflare Workers)

### 默认域名
- **前端**: `https://sub-store-frontend.pages.dev`
- **后端**: `https://substore-api.senmago231.workers.dev`

## 🔧 配置步骤

### 步骤 1: 在 Cloudflare 中添加自定义域名

#### 1.1 为 Cloudflare Pages 添加自定义域名

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → **Pages**
3. 选择你的 Pages 项目 (`sub-store-frontend`)
4. 点击 **Custom domains** 标签
5. 点击 **Set up a custom domain**
6. 输入域名: `sub.senma.io`
7. 按照提示配置 DNS 记录

#### 1.2 为 Cloudflare Workers 添加自定义域名

1. 在 Cloudflare Dashboard 中进入 **Workers & Pages** → **Workers**
2. 选择你的 Workers 项目 (`substore-api`)
3. 点击 **Settings** → **Triggers**
4. 在 **Custom Domains** 部分点击 **Add Custom Domain**
5. 输入域名: `sub-api.senma.io`
6. 按照提示配置 DNS 记录

### 步骤 2: 配置 DNS 记录

在你的域名 DNS 管理面板中添加以下记录：

```dns
# 前端域名 (Pages)
sub.senma.io    CNAME    sub-store-frontend.pages.dev

# 后端 API 域名 (Workers)
sub-api.senma.io    CNAME    substore-api.senmago231.workers.dev
```

### 步骤 3: 更新项目配置

#### 3.1 前端配置已更新
文件 `frontend/.env.production` 已更新为：
```env
VITE_API_BASE_URL=https://sub-api.senma.io
```

#### 3.2 Workers CORS 配置已更新
文件 `workers/wrangler.toml` 已更新为：
```toml
CORS_ORIGINS = "https://sub-store-frontend.pages.dev,https://senma231.github.io,https://sub.senma.io"
```

### 步骤 4: 部署更新

1. 提交并推送更改：
```bash
git add .
git commit -m "🌐 配置自定义域名 sub.senma.io 和 sub-api.senma.io"
git push origin master
```

2. GitHub Actions 将自动部署更新的配置

## 🔍 验证配置

### 检查域名解析
```bash
# 检查前端域名
nslookup sub.senma.io

# 检查 API 域名
nslookup sub-api.senma.io
```

### 测试 API 连接
```bash
# 测试健康检查端点
curl https://sub-api.senma.io/health

# 测试 CORS 配置
curl -H "Origin: https://sub.senma.io" https://sub-api.senma.io/health
```

### 测试前端访问
1. 访问 `https://sub.senma.io`
2. 尝试登录功能
3. 检查浏览器开发者工具中是否有 CORS 错误

## 🚨 故障排除

### CORS 错误
如果遇到跨域错误，检查：
1. Workers 的 `CORS_ORIGINS` 环境变量是否包含前端域名
2. 前端的 `VITE_API_BASE_URL` 是否指向正确的 API 域名
3. 重新部署 Workers 以应用新的 CORS 配置

### 域名解析问题
1. 确保 DNS 记录已正确配置
2. 等待 DNS 传播（可能需要几分钟到几小时）
3. 使用在线 DNS 检查工具验证解析

### SSL 证书问题
Cloudflare 会自动为自定义域名提供 SSL 证书，通常需要几分钟时间生效。

## 📝 配置检查清单

- [ ] Cloudflare Pages 自定义域名已配置
- [ ] Cloudflare Workers 自定义域名已配置
- [ ] DNS 记录已正确设置
- [ ] 前端环境变量已更新
- [ ] Workers CORS 配置已更新
- [ ] 代码已提交并部署
- [ ] 域名解析正常
- [ ] API 连接测试通过
- [ ] 前端访问正常
- [ ] 登录功能正常

## 🔄 回滚方案

如果自定义域名配置出现问题，可以快速回滚：

1. 恢复前端配置：
```env
VITE_API_BASE_URL=https://substore-api.senmago231.workers.dev
```

2. 恢复 Workers CORS 配置：
```toml
CORS_ORIGINS = "https://sub-store-frontend.pages.dev,https://senma231.github.io"
```

3. 重新部署项目

## 📞 支持

如果遇到问题，请检查：
1. Cloudflare Dashboard 中的域名状态
2. GitHub Actions 部署日志
3. 浏览器开发者工具中的网络请求
4. Workers 日志 (`wrangler tail substore-api`)
