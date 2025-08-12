# 🔧 更新 GitHub Secrets 以支持自定义域名

## 需要更新的 GitHub Secrets

请在 GitHub 仓库设置中更新以下 Secrets：

### 1. 访问 GitHub Secrets 设置
1. 进入你的 GitHub 仓库: https://github.com/senma231/sub-store
2. 点击 **Settings** 标签
3. 在左侧菜单中选择 **Secrets and variables** → **Actions**

### 2. 更新或添加以下 Secrets

#### CORS_ORIGINS (更新)
```
https://sub-store-frontend.pages.dev,https://senma231.github.io,https://sub.senma.io
```

#### API_BASE_URL (新增，如果不存在)
```
https://sub-api.senma.io
```

#### FRONTEND_URL (新增，如果不存在)
```
https://sub.senma.io
```

### 3. 验证现有 Secrets

确保以下 Secrets 已正确配置：

- ✅ `CLOUDFLARE_API_TOKEN` - Cloudflare API 令牌
- ✅ `CLOUDFLARE_ACCOUNT_ID` - Cloudflare 账户 ID
- ✅ `ADMIN_TOKEN` - 管理员登录密码 (Sz@2400104)
- ✅ `JWT_SECRET` - JWT 签名密钥
- ✅ `CF_D1_DATABASE_NAME` - D1 数据库名称
- ✅ `CF_D1_DATABASE_ID` - D1 数据库 ID

## 🚀 部署自定义域名配置

### 方法 1: 自动部署 (推荐)
```bash
# 提交更改并推送
git add .
git commit -m "🌐 配置自定义域名和跨域支持"
git push origin master
```

### 方法 2: 手动触发部署
1. 进入 GitHub 仓库的 **Actions** 标签
2. 选择 **Deploy Sub-Store** workflow
3. 点击 **Run workflow** 按钮
4. 选择 `master` 分支并运行

## 🔍 验证部署

### 1. 检查 GitHub Actions 状态
- 访问: https://github.com/senma231/sub-store/actions
- 确保最新的部署成功完成

### 2. 测试 API 端点
```bash
# 测试健康检查
curl https://sub-api.senma.io/health

# 测试 CORS 配置
curl -H "Origin: https://sub.senma.io" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://sub-api.senma.io/health
```

### 3. 测试前端访问
1. 访问 https://sub.senma.io
2. 打开浏览器开发者工具
3. 尝试登录 (用户名: admin, 密码: Sz@2400104)
4. 检查网络请求是否成功

## 🚨 常见问题解决

### CORS 错误
如果遇到跨域错误：
1. 确认 GitHub Secrets 中的 `CORS_ORIGINS` 已更新
2. 重新触发 GitHub Actions 部署
3. 等待部署完成后再次测试

### 域名解析问题
1. 确保在 Cloudflare 中正确配置了自定义域名
2. 检查 DNS 记录是否正确
3. 等待 DNS 传播完成 (通常 5-30 分钟)

### API 连接失败
1. 确认 Workers 自定义域名已在 Cloudflare 中配置
2. 检查前端的 `VITE_API_BASE_URL` 配置
3. 验证 SSL 证书是否已生效

## 📋 配置完成检查清单

- [ ] GitHub Secrets 已更新
- [ ] 代码已提交并推送
- [ ] GitHub Actions 部署成功
- [ ] Cloudflare Pages 自定义域名已配置
- [ ] Cloudflare Workers 自定义域名已配置
- [ ] DNS 记录已配置
- [ ] API 健康检查通过
- [ ] CORS 配置测试通过
- [ ] 前端访问正常
- [ ] 登录功能正常

## 🔄 下一步

配置完成后，你的 Sub-Store 系统将通过以下地址访问：

- **前端**: https://sub.senma.io
- **API**: https://sub-api.senma.io

所有跨域问题将得到解决，系统将正常工作。
