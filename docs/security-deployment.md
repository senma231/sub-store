# Sub-Store 安全部署指南

## 🔒 安全原则

本项目设计时充分考虑了安全性，可以安全地在 GitHub 上公开发布。以下是安全部署的详细说明。

## 🛡️ 安全架构

### 1. 代码安全
- ✅ **无硬编码密钥**: 项目代码中不包含任何敏感信息
- ✅ **环境变量分离**: 所有配置通过环境变量管理
- ✅ **开源透明**: 代码完全开源，可供审计
- ✅ **最小权限**: 每个组件只获得必要的权限

### 2. 部署安全
- ✅ **GitHub Secrets**: 敏感信息通过 GitHub Secrets 安全存储
- ✅ **Cloudflare Secrets**: 生产密钥通过 Cloudflare Workers Secrets 管理
- ✅ **访问控制**: 多层访问控制和认证机制
- ✅ **传输加密**: 全程 HTTPS 加密传输

## 📋 安全部署检查清单

### 部署前检查
- [ ] 已 Fork 项目到个人 GitHub 账户
- [ ] 已注册 Cloudflare 账户
- [ ] 已创建 Cloudflare API Token（最小权限）
- [ ] 已准备强密码作为管理员密码

### GitHub 安全配置
- [ ] 已设置所有必要的 GitHub Secrets
- [ ] 已启用 GitHub Pages（通过 Actions）
- [ ] 已确认 Secrets 只有仓库所有者可见
- [ ] 已检查 Actions 权限设置

### Cloudflare 安全配置
- [ ] 已创建 KV 命名空间
- [ ] 已设置 Workers Secrets
- [ ] 已配置适当的 CORS 策略
- [ ] 已启用速率限制

### 生产环境安全
- [ ] 已使用强密码和随机密钥
- [ ] 已配置自定义域名（可选）
- [ ] 已测试所有功能正常
- [ ] 已确认无敏感信息泄露

## 🔑 密钥管理最佳实践

### 1. 管理员密码 (ADMIN_TOKEN)
```bash
# 生成强密码（推荐）
openssl rand -hex 32

# 或使用在线工具生成
# https://www.random.org/passwords/
```

**要求**:
- 至少 32 个字符
- 包含大小写字母、数字、特殊字符
- 不要使用常见密码或个人信息

### 2. JWT 密钥 (JWT_SECRET)
```bash
# 生成 JWT 密钥
openssl rand -hex 64
```

**要求**:
- 至少 64 个字符
- 完全随机生成
- 定期更换（建议每 6 个月）

### 3. Cloudflare API Token
**权限设置**:
```
Account: Cloudflare Workers:Edit
Zone: Zone:Read (仅在使用自定义域名时)
Zone: Zone Settings:Edit (仅在使用自定义域名时)
```

**安全建议**:
- 使用最小权限原则
- 设置 IP 限制（如果有固定 IP）
- 定期检查和轮换 Token

## 🚀 安全部署步骤

### 步骤 1: Fork 项目
```bash
# 1. 在 GitHub 上 Fork 项目
# 2. Clone 到本地
git clone https://github.com/YOUR_USERNAME/sub-store.git
cd sub-store
```

### 步骤 2: 生成密钥
```bash
# 生成管理员密码
ADMIN_TOKEN=$(openssl rand -hex 32)
echo "ADMIN_TOKEN: $ADMIN_TOKEN"

# 生成 JWT 密钥
JWT_SECRET=$(openssl rand -hex 64)
echo "JWT_SECRET: $JWT_SECRET"

# 保存这些密钥到安全的地方！
```

### 步骤 3: 配置 Cloudflare
```bash
# 安装 Wrangler
npm install -g wrangler

# 登录 Cloudflare
wrangler auth login

# 创建 KV 命名空间
wrangler kv:namespace create "SUB_STORE_KV"
wrangler kv:namespace create "SUB_STORE_KV" --preview

# 记录返回的 namespace ID
```

### 步骤 4: 设置 GitHub Secrets
在 GitHub 项目设置中添加：

| Secret 名称 | 值 | 说明 |
|------------|---|------|
| `CLOUDFLARE_API_TOKEN` | `your_api_token` | Cloudflare API 令牌 |
| `CLOUDFLARE_ACCOUNT_ID` | `your_account_id` | Cloudflare 账户 ID |
| `API_BASE_URL` | `https://sub-store-api.YOUR_USERNAME.workers.dev` | API 地址 |
| `FRONTEND_URL` | `https://YOUR_USERNAME.github.io/sub-store` | 前端地址 |

### 步骤 5: 更新配置文件
编辑 `workers/wrangler.toml`:
```toml
name = "sub-store-api"
main = "src/index.ts"
compatibility_date = "2023-12-18"

[[kv_namespaces]]
binding = "SUB_STORE_KV"
id = "YOUR_KV_NAMESPACE_ID"
preview_id = "YOUR_PREVIEW_KV_NAMESPACE_ID"

[vars]
ENVIRONMENT = "production"
APP_NAME = "Sub-Store"
CORS_ORIGINS = "https://YOUR_USERNAME.github.io"
```

### 步骤 6: 设置 Workers Secrets
```bash
cd workers

# 设置管理员密码
echo "YOUR_ADMIN_TOKEN" | wrangler secret put ADMIN_TOKEN

# 设置 JWT 密钥
echo "YOUR_JWT_SECRET" | wrangler secret put JWT_SECRET
```

### 步骤 7: 部署
```bash
# 提交更改
git add .
git commit -m "Configure for deployment"
git push origin main

# GitHub Actions 将自动部署
```

## 🔍 安全验证

### 1. 检查代码安全
```bash
# 搜索可能的敏感信息
grep -r "password\|secret\|token\|key" . --exclude-dir=node_modules --exclude-dir=.git

# 应该只找到变量名，没有实际值
```

### 2. 检查部署安全
```bash
# 测试 API 健康检查
curl https://sub-store-api.YOUR_USERNAME.workers.dev/health

# 测试前端访问
curl https://YOUR_USERNAME.github.io/sub-store
```

### 3. 检查认证安全
```bash
# 测试未授权访问（应该返回 401）
curl https://sub-store-api.YOUR_USERNAME.workers.dev/api/nodes

# 测试管理员登录
curl -X POST https://sub-store-api.YOUR_USERNAME.workers.dev/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"YOUR_ADMIN_TOKEN"}'
```

## ⚠️ 安全注意事项

### 1. 不要做的事情
- ❌ 不要在代码中硬编码密钥
- ❌ 不要在 commit 中包含敏感信息
- ❌ 不要使用弱密码
- ❌ 不要分享 GitHub Secrets
- ❌ 不要在公共场所讨论密钥

### 2. 应该做的事情
- ✅ 定期更换密钥
- ✅ 使用强密码
- ✅ 监控访问日志
- ✅ 及时更新依赖
- ✅ 备份重要配置

### 3. 应急响应
如果怀疑密钥泄露：
1. 立即更换所有相关密钥
2. 检查访问日志
3. 重新部署应用
4. 通知相关用户

## 📊 安全监控

### 1. 日志监控
- Cloudflare Workers 日志
- GitHub Actions 日志
- 访问统计和异常检测

### 2. 定期检查
- 每月检查 API Token 使用情况
- 每季度更换重要密钥
- 每年进行安全审计

### 3. 自动化监控
```bash
# 设置 Cloudflare 告警
# 监控异常访问模式
# 设置资源使用告警
```

## 🎯 总结

通过遵循本指南，您可以安全地部署 Sub-Store 系统，同时保持代码的开源透明性。关键是：

1. **分离关注点**: 代码和配置分离
2. **最小权限**: 只给予必要的权限
3. **多层防护**: 多重安全机制
4. **持续监控**: 定期检查和更新

这种架构确保了即使代码完全公开，系统仍然是安全的。
