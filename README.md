# Sub-Store - 代理节点订阅系统

一个基于 GitHub + Cloudflare 的免费代理节点订阅管理系统，支持多种代理协议和客户端格式。

## 🚀 特性

### 支持的代理协议
- ✅ VLESS
- ✅ VMess  
- ✅ Trojan
- ✅ Shadowsocks (SS)
- ✅ SOCKS5
- ✅ Hysteria2 (HY2)
- ✅ Hysteria (HY)

### 支持的客户端格式
- ✅ V2Ray/V2RayN (JSON & Base64)
- ✅ Clash/ClashX (YAML)
- ✅ Shadowrocket (Base64)
- ✅ Quantumult X
- ✅ Surge

### 核心功能
- 🔧 节点配置管理 (增删改查)
- 🔄 多格式订阅转换
- 📊 订阅访问统计
- 🔍 节点可用性检测
- 🌐 Web 管理界面
- 🚀 自动化部署

## 🏗️ 新一代架构设计

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Cloudflare Pages│    │ Cloudflare Workers│    │ Cloudflare D1   │
│   (前端界面)     │◄──►│   (API 后端)      │◄──►│ (SQLite数据库)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         ▲                        ▲                        ▲
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  GitHub Actions │    │  全球边缘计算     │    │  实时数据同步    │
│   (CI/CD部署)    │    │   (零延迟响应)    │    │   (多区域备份)   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   订阅客户端      │
                       │ (V2Ray/Clash等)  │
                       └──────────────────┘
```

### 🆕 架构升级亮点

- **前端**: React 18 + TypeScript + Ant Design
- **后端**: Cloudflare Workers + Hono.js + D1 数据库
- **存储**: Cloudflare D1 (SQLite) - 支持复杂查询和关系数据
- **部署**: GitHub Actions 全自动化 CI/CD
- **网络**: Cloudflare 全球边缘网络 + 中国优化

### 🚀 性能提升

- ⚡ **访问速度**: 中国用户访问速度提升 300%+
- 📊 **数据查询**: 支持复杂 SQL 查询，性能提升 10x
- 🔍 **搜索功能**: 数据库级全文搜索
- 📈 **统计分析**: 实时数据分析和可视化报表

## 🚀 快速开始

### 🔒 安全须知

**本项目可以安全地公开发布**，因为：
- ✅ 代码中不包含任何敏感信息
- ✅ 所有密钥通过 GitHub Secrets 和 Cloudflare Secrets 安全管理
- ✅ 采用环境变量分离配置和代码
- ✅ 支持完全免费的部署方案

### 方式一：一键部署脚本（推荐）

**适用于生产环境部署**

```bash
# 1. Fork 本项目到您的 GitHub 账户
# 2. 克隆您的 Fork
git clone https://github.com/senma231/sub-store.git
cd sub-store

# 3. 运行一键部署脚本
chmod +x scripts/deploy.sh  # Linux/macOS
./scripts/deploy.sh

# Windows 用户请使用 Git Bash 或 WSL
```

脚本会自动：
- ✅ 生成安全密钥
- ✅ 配置 Cloudflare Workers
- ✅ 创建 D1 数据库
- ✅ 部署后端 API
- ✅ 配置 Cloudflare Pages
- ✅ 提供 GitHub Secrets 配置指南

### 方式二：开发环境安装
```bash
# 克隆项目
git clone https://github.com/senma231/sub-store.git
cd sub-store

# 运行安装脚本
chmod +x scripts/setup.sh
./scripts/setup.sh install

# 启动开发服务器
./scripts/setup.sh dev
```

### 方式二：手动安装

#### 1. 克隆项目
```bash
git clone https://github.com/senma231/sub-store.git
cd sub-store
```

#### 2. 安装依赖
```bash
# 安装所有依赖
npm run install:all

# 或者分别安装
cd frontend && npm install && cd ..
cd workers && npm install && cd ..
```

#### 3. 配置环境
```bash
# 复制配置文件
cp .env.example .env

# 编辑 .env 文件，填入必要配置
# CLOUDFLARE_API_TOKEN=your_token
# CLOUDFLARE_ACCOUNT_ID=your_account_id
# 等等...
```

#### 4. 设置 Cloudflare
```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler auth login

# 创建 D1 数据库
wrangler d1 create sub-store-db

# 初始化数据库结构
cd workers
wrangler d1 execute sub-store-db --file=./schema.sql
```

#### 5. 本地开发
```bash
# 启动开发服务器 (前端 + Workers)
npm run dev

# 或者分别启动
npm run dev:frontend  # http://localhost:3000
npm run dev:workers   # http://localhost:8787
```

#### 6. 部署到生产环境
```bash
# 构建并部署
npm run build
npm run deploy

# 或者通过 GitHub Actions 自动部署
git add .
git commit -m "Deploy to production"
git push origin master
```

## 🔐 安全部署详解

### GitHub Secrets 配置

部署完成后，您需要在 GitHub 项目中配置以下 Secrets：

1. **进入项目设置**
   - 访问您 Fork 的项目页面
   - 点击 `Settings` → `Secrets and variables` → `Actions`

2. **添加必要的 Secrets**

| Secret 名称 | 说明 | 获取方式 |
|------------|------|----------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 令牌 | [获取教程](#获取-cloudflare-api-token) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID | Dashboard 右侧边栏 |
| `API_BASE_URL` | Workers API 地址 | `https://sub-store-api.senma231.workers.dev` |
| `FRONTEND_URL` | 前端访问地址 | `https://sub-store-frontend.pages.dev` |

### 获取 Cloudflare API Token

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击右上角头像 → `My Profile`
3. 选择 `API Tokens` 标签
4. 点击 `Create Token`
5. 选择 `Custom token` 模板
6. 设置权限：
   - `Account` - `Cloudflare Workers:Edit`
   - `Zone` - `Zone:Read` (如果使用自定义域名)
7. 复制生成的 Token

### 部署流程

1. **Fork 项目** → 获得自己的代码副本
2. **运行部署脚本** → 自动配置 Cloudflare
3. **设置 GitHub Secrets** → 配置部署密钥
4. **推送代码** → 触发自动部署
5. **访问应用** → 开始使用

### 安全特性

- 🔒 **零硬编码密钥**: 代码中不包含任何敏感信息
- 🔐 **多层加密**: JWT + TLS + Cloudflare 安全防护
- 🛡️ **访问控制**: 管理员认证 + 速率限制
- 📊 **审计日志**: 完整的操作记录
- 🔄 **密钥轮换**: 支持定期更换密钥

## 📖 使用指南

### 添加节点
1. 访问管理界面
2. 点击"添加节点"
3. 填写节点信息
4. 保存配置

### 获取订阅链接
```
# V2Ray 格式
https://your-domain.workers.dev/sub/v2ray?token=your-token

# Clash 格式  
https://your-domain.workers.dev/sub/clash?token=your-token

# Shadowrocket 格式
https://your-domain.workers.dev/sub/shadowrocket?token=your-token
```

### API 接口
```
GET  /api/nodes          # 获取节点列表
POST /api/nodes          # 添加节点
PUT  /api/nodes/:id      # 更新节点
DELETE /api/nodes/:id    # 删除节点
GET  /sub/:format        # 获取订阅内容
GET  /api/stats          # 获取统计信息
```

## 🔧 配置说明

### 环境变量
```env
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
D1_DATABASE_ID=your_d1_database_id
ADMIN_TOKEN=your_admin_token
JWT_SECRET=your_jwt_secret
```

### 节点配置格式
```json
{
  "id": "node-1",
  "name": "节点名称",
  "type": "vless",
  "server": "example.com",
  "port": 443,
  "uuid": "uuid-string",
  "encryption": "none",
  "flow": "xtls-rprx-vision",
  "network": "tcp",
  "security": "tls",
  "sni": "example.com"
}
```

## 🚀 部署指南

详细部署文档请参考 [部署指南](./docs/deployment.md)

## 📝 开发文档

- [API 文档](./docs/api.md)
- [格式转换](./docs/converters.md)
- [开发指南](./docs/development.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
