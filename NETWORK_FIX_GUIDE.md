# 网络问题修复指南

## 🚨 问题症状
- Git push失败: `getaddrinfo() thread failed to start`
- 浏览器API请求失败: `net::ERR_NETWORK_ERROR`
- curl命令失败: 相同的getaddrinfo错误

## 🔍 根本原因
Windows系统网络栈问题，影响DNS解析和网络连接。

## 🛠️ 解决方案

### 方案1: 重置网络栈（推荐）
```cmd
# 以管理员身份运行命令提示符，然后执行：

# 1. 重置Winsock目录
netsh winsock reset

# 2. 重置TCP/IP栈
netsh int ip reset

# 3. 刷新DNS缓存
ipconfig /flushdns

# 4. 重新注册DNS
ipconfig /registerdns

# 5. 重启网络适配器
netsh interface set interface "以太网" disabled
netsh interface set interface "以太网" enabled

# 6. 重启计算机
shutdown /r /t 0
```

### 方案2: 修改DNS设置
```cmd
# 设置为公共DNS服务器
netsh interface ip set dns "以太网" static 8.8.8.8
netsh interface ip add dns "以太网" 8.8.4.4 index=2

# 或者使用Cloudflare DNS
netsh interface ip set dns "以太网" static 1.1.1.1
netsh interface ip add dns "以太网" 1.0.0.1 index=2
```

### 方案3: 临时使用本地开发
如果网络问题无法立即解决，可以：

1. **启动本地Workers开发服务器**:
```bash
cd workers
wrangler dev --port 8787
```

2. **修改前端API配置**:
```typescript
// frontend/src/services/api.ts
const API_BASE_URL = 'http://localhost:8787';
```

3. **启动前端开发服务器**:
```bash
cd frontend
npm run dev
```

## 🎯 验证修复
修复后执行以下命令验证：

```bash
# 1. 测试DNS解析
nslookup github.com

# 2. 测试网络连接
ping github.com

# 3. 测试API连接
curl -I https://sub-api.senma.io/health

# 4. 测试Git连接
git ls-remote origin
```

## 📞 如果问题持续
1. 检查防火墙设置
2. 检查代理设置
3. 联系网络管理员
4. 考虑使用移动热点测试
