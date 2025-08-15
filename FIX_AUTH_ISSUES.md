# Sub-Store 认证问题修复方案

## 🚨 问题诊断

### 症状
1. ✅ 页面刚加载完可以登录
2. ❌ 登录进去后报网络错误
3. ❌ 所有功能不可用
4. ❌ 退出后无法重新登录

### 根本原因
1. **JWT_SECRET 环境变量缺失** - 导致token验证失败
2. **CORS配置不完整** - 缺少最新Pages域名
3. **认证状态管理问题** - token验证失败后自动登出

## 🔧 修复步骤

### 步骤1: 设置JWT_SECRET环境变量

```bash
# 方法1: 通过wrangler命令设置
cd workers
wrangler secret put JWT_SECRET

# 当提示输入时，输入一个强密码，例如：
# SubStore2024SecretKey!@#$%^&*()

# 方法2: 通过Cloudflare Dashboard设置
# 1. 访问 https://dash.cloudflare.com
# 2. 进入 Workers & Pages > substore-api > Settings > Variables
# 3. 添加环境变量：
#    Name: JWT_SECRET
#    Value: SubStore2024SecretKey!@#$%^&*()
#    Type: Secret
```

### 步骤2: 更新CORS配置

需要在workers/src/index.ts中添加最新的Pages域名：

```typescript
// 在CORS配置中添加最新域名
origin: [
  'https://sub.senma.io',
  'https://sub-store-frontend.pages.dev',
  'https://1470b94d.sub-store-frontend.pages.dev', // 最新部署域名
  'https://2265c2d9.sub-store-frontend.pages.dev',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://localhost:3000'
],
```

### 步骤3: 重新部署Workers

```bash
cd workers
wrangler deploy
```

### 步骤4: 验证修复

1. **清除浏览器缓存和localStorage**
   ```javascript
   // 在浏览器控制台执行
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

2. **测试登录流程**
   - 访问 https://sub.senma.io
   - 使用 admin / Sz@2400104 登录
   - 检查是否能正常访问功能

## 🔍 调试方法

### 检查JWT_SECRET是否设置成功
```bash
cd workers
wrangler secret list
```

### 查看Workers日志
```bash
cd workers
wrangler tail --format=pretty
```

### 浏览器控制台检查
1. 打开开发者工具 (F12)
2. 查看Network标签页的API请求
3. 查看Console标签页的错误信息

## 🎯 预期结果

修复后应该实现：
- ✅ 正常登录不报错
- ✅ 登录后所有功能可用
- ✅ 退出后可以重新登录
- ✅ Token自动刷新机制正常工作

## 📞 如果问题持续

1. 检查Cloudflare Workers的环境变量配置
2. 确认ADMIN_TOKEN环境变量正确设置
3. 检查网络连接和DNS解析
4. 联系技术支持获取进一步帮助
