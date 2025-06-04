# Sub-Store 部署检查清单

## 📋 部署前准备

### 账户准备
- [ ] 已注册 GitHub 账户
- [ ] 已注册 Cloudflare 账户
- [ ] 已 Fork Sub-Store 项目到个人账户

### 工具准备
- [ ] 已安装 Node.js 18+
- [ ] 已安装 Git
- [ ] 已安装 npm 或 yarn
- [ ] 已安装 Wrangler CLI (`npm install -g wrangler`)

## 🔧 Cloudflare 配置

### API Token 创建
- [ ] 登录 Cloudflare Dashboard
- [ ] 创建 API Token (Workers:Edit 权限)
- [ ] 记录 API Token
- [ ] 记录 Account ID

### KV 存储创建
- [ ] 运行 `wrangler auth login` 登录
- [ ] 创建生产环境 KV: `wrangler kv:namespace create "SUB_STORE_KV"`
- [ ] 创建预览环境 KV: `wrangler kv:namespace create "SUB_STORE_KV" --preview`
- [ ] 记录两个 KV Namespace ID

### Workers 配置
- [ ] 更新 `workers/wrangler.toml` 中的 KV ID
- [ ] 设置 Workers Secrets:
  - [ ] `wrangler secret put ADMIN_TOKEN`
  - [ ] `wrangler secret put JWT_SECRET`

## 🔐 GitHub 配置

### Secrets 设置
在 GitHub 项目 Settings → Secrets and variables → Actions 中添加：

- [ ] `CLOUDFLARE_API_TOKEN` - Cloudflare API 令牌
- [ ] `CLOUDFLARE_ACCOUNT_ID` - Cloudflare 账户 ID
- [ ] `API_BASE_URL` - Workers API 地址
- [ ] `FRONTEND_URL` - GitHub Pages 地址

### Pages 设置
- [ ] 启用 GitHub Pages
- [ ] 设置 Source 为 "GitHub Actions"
- [ ] 确认 Pages 权限已启用

## 🚀 部署执行

### 自动部署
- [ ] 推送代码到 main 分支
- [ ] 检查 GitHub Actions 执行状态
- [ ] 确认 Workers 部署成功
- [ ] 确认 Pages 部署成功

### 手动部署 (可选)
- [ ] 本地构建前端: `cd frontend && npm run build`
- [ ] 部署 Workers: `cd workers && npm run deploy`
- [ ] 上传前端到 Pages

## ✅ 部署验证

### API 测试
- [ ] 访问健康检查: `https://your-api.workers.dev/health`
- [ ] 测试管理员登录
- [ ] 测试节点 API 接口
- [ ] 测试订阅生成

### 前端测试
- [ ] 访问前端地址
- [ ] 测试登录功能
- [ ] 测试节点管理
- [ ] 测试订阅生成
- [ ] 测试统计页面

### 功能测试
- [ ] 创建测试节点
- [ ] 生成订阅链接
- [ ] 测试不同格式订阅
- [ ] 验证客户端兼容性

## 🔒 安全检查

### 密钥安全
- [ ] 确认代码中无硬编码密钥
- [ ] 确认 GitHub Secrets 设置正确
- [ ] 确认 Workers Secrets 设置正确
- [ ] 使用强密码作为 ADMIN_TOKEN

### 访问控制
- [ ] 测试未授权访问被拒绝
- [ ] 测试管理员权限正常
- [ ] 测试速率限制生效
- [ ] 确认 CORS 配置正确

### 数据安全
- [ ] 确认 KV 数据加密
- [ ] 确认传输使用 HTTPS
- [ ] 确认敏感信息不在日志中
- [ ] 设置适当的缓存策略

## 📊 监控设置

### 基础监控
- [ ] 设置 Cloudflare 告警
- [ ] 监控 Workers 使用量
- [ ] 监控 KV 存储使用量
- [ ] 监控 Pages 流量

### 日志监控
- [ ] 检查 Workers 日志
- [ ] 检查 GitHub Actions 日志
- [ ] 设置错误告警
- [ ] 定期检查访问日志

## 🔄 维护计划

### 定期任务
- [ ] 每月检查依赖更新
- [ ] 每季度更换 JWT_SECRET
- [ ] 每半年更换 ADMIN_TOKEN
- [ ] 年度安全审计

### 备份策略
- [ ] 定期导出节点配置
- [ ] 备份重要设置
- [ ] 记录配置变更
- [ ] 准备灾难恢复计划

## 🐛 故障排除

### 常见问题
- [ ] Workers 部署失败 → 检查 wrangler.toml 配置
- [ ] Pages 部署失败 → 检查 GitHub Actions 日志
- [ ] API 无法访问 → 检查 CORS 和域名配置
- [ ] 登录失败 → 检查 ADMIN_TOKEN 设置

### 调试工具
- [ ] 使用 `wrangler tail` 查看实时日志
- [ ] 使用浏览器开发者工具检查网络请求
- [ ] 检查 Cloudflare Dashboard 中的分析数据
- [ ] 使用 `curl` 测试 API 接口

## 📈 性能优化

### 前端优化
- [ ] 启用 PWA 缓存
- [ ] 优化图片和资源
- [ ] 使用 CDN 加速
- [ ] 启用 Gzip 压缩

### 后端优化
- [ ] 优化 KV 读写操作
- [ ] 设置适当的缓存策略
- [ ] 优化 API 响应时间
- [ ] 监控内存使用

## 🎯 部署完成确认

### 最终检查
- [ ] 所有功能正常工作
- [ ] 性能满足要求
- [ ] 安全配置正确
- [ ] 监控告警设置完成
- [ ] 文档更新完整
- [ ] 团队成员已培训

### 上线准备
- [ ] 准备上线公告
- [ ] 通知相关用户
- [ ] 准备技术支持
- [ ] 制定回滚计划

---

## 📞 获取帮助

如果在部署过程中遇到问题，可以：

1. 查看 [详细部署文档](./deployment.md)
2. 查看 [安全部署指南](./security-deployment.md)
3. 查看 [API 文档](./api.md)
4. 在 GitHub Issues 中提问
5. 查看 Cloudflare Workers 文档

## 🎉 部署成功！

恭喜您成功部署了 Sub-Store 系统！现在您可以：

- 🔧 管理代理节点
- 🔗 生成订阅链接
- 📊 查看使用统计
- ⚙️ 配置系统设置

享受您的代理订阅管理系统吧！
