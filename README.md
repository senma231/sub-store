# Sub-Store - 代理节点订阅管理系统

一个基于 GitHub + Cloudflare 的现代化代理节点订阅管理系统，支持多种代理协议和客户端格式，采用全数据库化架构，确保数据持久化和高可用性。

[![Deploy Status](https://github.com/senma231/sub-store/actions/workflows/deploy.yml/badge.svg)](https://github.com/senma231/sub-store/actions)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-green.svg)](https://github.com/senma231/sub-store/releases)

## 🎉 最新更新 (v2.0.0)

### ✨ 重大改进

- **🗄️ 完全数据库化**: 移除所有内存存储，确保数据持久化
- **👥 用户管理系统**: 基于数据库的用户认证和密码管理
- **🔐 安全性升级**: bcrypt密码加密、JWT认证、速率限制
- **🎨 UI优化**: 修复前端界面问题，提升用户体验
- **🧹 代码清理**: 移除临时文档和过时文件，项目结构更清晰

### 🔧 技术栈升级

- **后端**: Cloudflare Workers + Hono.js + D1 SQLite
- **前端**: React 18 + TypeScript + Ant Design
- **认证**: 数据库用户管理 + JWT + bcrypt
- **部署**: GitHub Actions 自动化 CI/CD

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

- 🔧 **节点管理**: 完整的CRUD操作，支持批量导入/导出
- 🔄 **订阅转换**: 支持V2Ray、Clash、Shadowrocket等多种格式
- 📊 **数据统计**: 实时访问统计和可视化报表
- 🔍 **智能解析**: 自动识别和解析各种节点链接
- 🌐 **Web界面**: 现代化的React管理界面
- 👥 **用户管理**: 基于数据库的用户认证和权限管理
- 🔐 **安全防护**: JWT认证、速率限制、数据加密
- 🚀 **自动部署**: GitHub Actions + Cloudflare 一键部署

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

- **前端**: React 18 + TypeScript + Ant Design + Vite
- **后端**: Cloudflare Workers + Hono.js + D1 数据库
- **存储**: Cloudflare D1 (SQLite) - 完全数据库化，支持复杂查询
- **认证**: 基于数据库的用户管理 + JWT + bcrypt密码加密
- **部署**: GitHub Actions 全自动化 CI/CD
- **网络**: Cloudflare 全球边缘网络 + 中国优化

### 🚀 性能与安全提升

- ⚡ **访问速度**: 中国用户访问速度提升 300%+
- 📊 **数据持久化**: 完全移除内存存储，确保数据不丢失
- 🔍 **搜索功能**: 数据库级全文搜索和复杂查询
- 📈 **统计分析**: 实时数据分析和可视化报表
- 🔐 **安全性**: 密码哈希存储、JWT认证、速率限制
- 👥 **用户管理**: 支持多用户、密码修改、权限控制

## 🚀 快速开始

### 🔒 安全须知

**本项目可以安全地公开发布**，因为：

- ✅ 代码中不包含任何敏感信息
- ✅ 所有密钥通过 GitHub Secrets 和 Cloudflare Secrets 安全管理
- ✅ 采用环境变量分离配置和代码
- ✅ 支持完全免费的部署方案

### 方式一：一键部署脚本（推荐）

> 适用于生产环境部署

```bash
# 1. Fork 本项目到您的 GitHub 账户
# 2. 克隆您的 Fork
git clone https://github.com/YOUR_USERNAME/sub-store.git
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

### 🔐 首次登录

1. 访问前端管理界面：`https://your-frontend.pages.dev`
2. 使用默认管理员账户登录：
   - 用户名：`admin`
   - 密码：您设置的 `ADMIN_TOKEN` 值
3. 登录后建议立即修改密码

### 📝 节点管理

#### 添加节点
1. 点击"节点管理" → "添加节点"
2. 填写节点信息（支持手动输入或链接解析）
3. 保存配置

#### 批量导入
1. 点击"导入节点"
2. 粘贴节点链接（支持多行）
3. 系统自动解析并导入

#### 节点操作
- **启用/禁用**: 批量控制节点状态
- **编辑**: 修改节点配置
- **删除**: 移除不需要的节点
- **导出**: 导出节点配置

### 🔗 订阅管理

#### 标准订阅
```bash
# V2Ray 格式
https://your-domain.workers.dev/sub/v2ray

# Clash 格式
https://your-domain.workers.dev/sub/clash

# Shadowrocket 格式
https://your-domain.workers.dev/sub/shadowrocket
```

#### 自定义订阅
1. 选择特定节点
2. 创建自定义订阅
3. 设置有效期（可选）
4. 获取专用订阅链接

### 👥 用户管理

#### 修改密码
1. 点击右上角用户菜单
2. 选择"个人资料"
3. 输入当前密码和新密码
4. 确认修改

### 📊 API 接口

```bash
# 认证
POST /api/auth/login           # 用户登录
POST /api/auth/change-password # 修改密码

# 节点管理
GET  /api/nodes               # 获取节点列表
POST /api/nodes               # 添加节点
PUT  /api/nodes/:id           # 更新节点
DELETE /api/nodes/:id         # 删除节点
POST /api/nodes/batch         # 批量操作
POST /api/nodes/import        # 导入节点

# 订阅管理
GET  /sub/:format             # 获取标准订阅
GET  /sub/custom/:uuid        # 获取自定义订阅
POST /api/subscriptions       # 创建自定义订阅
GET  /api/subscriptions       # 获取订阅列表

# 统计信息
GET  /api/stats               # 获取统计信息
GET  /health                  # 健康检查
```

## 🔧 配置说明

### 环境变量

```env
# Cloudflare 配置
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id

# 数据库配置
D1_DATABASE_ID=your_d1_database_id

# 认证配置
ADMIN_TOKEN=your_admin_token    # 默认管理员密码
JWT_SECRET=your_jwt_secret      # JWT签名密钥

# 应用配置
APP_NAME=Sub-Store
ENVIRONMENT=production
CORS_ORIGINS=*
```

### 数据库表结构

系统使用以下主要数据表：

- **users**: 用户管理（用户名、密码哈希、角色等）
- **nodes**: 节点配置（支持所有代理协议）
- **custom_subscriptions**: 自定义订阅
- **access_logs**: 访问统计
- **settings**: 系统配置

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
  "sni": "example.com",
  "enabled": true,
  "tags": ["tag1", "tag2"],
  "remark": "备注信息"
}
```

## 🚀 部署指南

### 生产环境部署

1. **Fork 项目** → 获得自己的代码副本
2. **配置 Cloudflare**：
   - 创建 Workers 应用
   - 创建 D1 数据库
   - 配置 Pages 项目
3. **设置 GitHub Secrets**：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
   - 其他必要配置
4. **推送代码** → 自动部署

详细部署文档请参考：

- [部署指南](./docs/deployment.md)
- [安全部署](./docs/security-deployment.md)
- [GitHub Secrets 设置](./docs/GITHUB_SECRETS_SETUP.md)

### 开发环境

```bash
# 克隆项目
git clone https://github.com/senma231/sub-store.git
cd sub-store

# 安装依赖
npm run install:all

# 启动开发服务器
npm run dev
```

## 📝 文档

- [API 文档](./docs/api.md) - 完整的API接口说明
- [部署检查清单](./docs/deployment-checklist.md) - 部署前检查
- [自定义域名设置](./docs/custom-domain-setup.md) - 域名配置指南

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

感谢所有贡献者和开源社区的支持！

---

**⭐ 如果这个项目对您有帮助，请给个 Star 支持一下！**
