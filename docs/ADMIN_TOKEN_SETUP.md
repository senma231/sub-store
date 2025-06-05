# 🔐 ADMIN_TOKEN 完整配置指南

## 📋 配置位置说明

### 1. GitHub Actions Secrets（必需）
**位置**: Repository Settings > Secrets and variables > Actions > Repository secrets

**必需配置**:
```bash
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
ADMIN_TOKEN=your_secure_admin_password  
JWT_SECRET=your_jwt_secret_32_chars_min
CORS_ORIGINS=https://sub-store-frontend.pages.dev
```

**作用**: 部署时传递给 Cloudflare Workers

### 2. Cloudflare Workers 环境变量（自动配置）
**位置**: Cloudflare Dashboard > Workers & Pages > sub-store-api > Settings > Environment Variables

**说明**: 通过 GitHub Actions 自动设置，无需手动配置

## 🛠️ 解决 Workers 环境变量保存失败

### 方法 1: 使用 Wrangler CLI（推荐）
```bash
cd workers
npx wrangler secret put ADMIN_TOKEN
# 输入您的管理员密码

npx wrangler secret put JWT_SECRET  
# 输入至少32字符的JWT密钥

npx wrangler secret put CORS_ORIGINS
# 输入: https://sub-store-frontend.pages.dev
```

### 方法 2: 通过 GitHub Actions 自动设置
1. 确保 GitHub Secrets 已正确配置
2. 推送代码触发自动部署
3. Workers 环境变量会自动设置

### 方法 3: 手动在 Cloudflare Dashboard 设置
如果 Dashboard 保存失败，尝试：
1. 刷新页面重试
2. 使用无痕模式
3. 清除浏览器缓存
4. 检查网络连接

## ✅ 验证配置是否生效

### 1. 检查 Workers 环境变量
```bash
cd workers
npx wrangler secret list
```

### 2. 测试登录功能
```bash
curl -X POST https://substore-api.senmago231.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_ADMIN_TOKEN"}'
```

**预期结果**: 返回 JWT token 和用户信息

### 3. 运行配置检查脚本
```bash
node scripts/check-config.js
```

## 🔧 故障排除

### 405 错误解决
✅ **已解决**: 最新检查显示登录端点返回 401（正常）

### CORS 错误解决
1. 确保 `CORS_ORIGINS` 包含前端域名
2. 检查域名格式（包含 https://，无尾随斜杠）
3. 重新部署 Workers

### 认证失败解决
1. 确保使用正确的 ADMIN_TOKEN
2. 检查用户名是否为 "admin"
3. 清除浏览器 localStorage

## 📊 配置状态检查

当前状态（2024-06-05）:
- ✅ Workers API 健康检查通过
- ✅ 登录端点正常响应（401 预期）
- ✅ 前端部署正常
- ✅ GitHub Actions 配置正确

## 🚀 快速测试

使用正确的 ADMIN_TOKEN 测试登录：
```javascript
// 在浏览器控制台执行
fetch('https://substore-api.senmago231.workers.dev/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'YOUR_ACTUAL_ADMIN_TOKEN'
  })
}).then(r => r.json()).then(console.log);
```

如果返回 token，说明配置成功！
