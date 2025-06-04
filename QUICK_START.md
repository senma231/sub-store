# Sub-Store 快速开始指南

## 🎉 项目已推送到 GitHub！

您的 Sub-Store 项目已成功推送到：
**https://github.com/senma231/sub-store**

## 🚀 下一步：部署到生产环境

### 1. 准备 Cloudflare 账户
1. 注册 [Cloudflare](https://cloudflare.com) 账户
2. 获取 API Token 和 Account ID

### 2. 运行一键部署脚本
```bash
# 克隆您的仓库
git clone https://github.com/senma231/sub-store.git
cd sub-store

# 运行部署脚本
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### 3. 设置 GitHub Secrets
在 GitHub 项目设置中添加以下 Secrets：

| Secret 名称 | 值 |
|------------|---|
| `CLOUDFLARE_API_TOKEN` | 您的 Cloudflare API Token |
| `CLOUDFLARE_ACCOUNT_ID` | 您的 Cloudflare Account ID |
| `API_BASE_URL` | `https://sub-store-api.senma231.workers.dev` |
| `FRONTEND_URL` | `https://senma231.github.io/sub-store` |

**设置步骤**：
1. 访问 https://github.com/senma231/sub-store/settings/secrets/actions
2. 点击 "New repository secret"
3. 添加上述 4 个 Secrets

### 4. 启用 GitHub Pages
1. 访问 https://github.com/senma231/sub-store/settings/pages
2. 在 "Source" 下选择 "GitHub Actions"
3. 保存设置

### 5. 触发部署
```bash
# 推送任何更改都会触发自动部署
git add .
git commit -m "Enable deployment"
git push origin master
```

## 📋 部署后的访问地址

- **前端管理界面**: https://senma231.github.io/sub-store
- **API 接口**: https://sub-store-api.senma231.workers.dev
- **健康检查**: https://sub-store-api.senma231.workers.dev/health

## 🔑 默认登录信息

- **用户名**: `admin`
- **密码**: 部署脚本生成的 `ADMIN_TOKEN`

## 📚 详细文档

- [安全部署指南](docs/security-deployment.md)
- [部署检查清单](docs/deployment-checklist.md)
- [API 文档](docs/api.md)
- [完整部署文档](docs/deployment.md)

## 🔧 本地开发

如果您想在本地开发：

```bash
# 安装依赖
npm run install:all

# 启动开发服务器
npm run dev

# 前端: http://localhost:3000
# Workers: http://localhost:8787
```

## 🆘 需要帮助？

1. 查看 [部署文档](docs/deployment.md)
2. 查看 [GitHub Issues](https://github.com/senma231/sub-store/issues)
3. 查看 [项目总结](PROJECT_SUMMARY.md)

## 🎯 功能特性

✅ **节点管理**: 支持 7 种代理协议  
✅ **订阅生成**: 支持 6 种客户端格式  
✅ **统计分析**: 访问统计和趋势分析  
✅ **安全部署**: 完全免费的 Cloudflare + GitHub 方案  
✅ **现代化**: React 18 + TypeScript + Cloudflare Workers  

## 🔒 安全提醒

- ✅ 项目代码不包含任何敏感信息，可以安全公开
- ✅ 所有密钥通过 GitHub Secrets 和 Cloudflare Secrets 管理
- ✅ 支持完全免费的部署方案
- ✅ 企业级安全标准

---

**恭喜！您的 Sub-Store 项目已经准备就绪！** 🎉

按照上述步骤完成部署后，您就可以开始使用这个强大的代理节点订阅管理系统了。
