#!/bin/bash

# Sub-Store 一键部署脚本
# 用于快速部署到 Cloudflare + GitHub Pages

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_message() {
    echo -e "${2}${1}${NC}"
}

print_success() {
    print_message "✅ $1" $GREEN
}

print_warning() {
    print_message "⚠️  $1" $YELLOW
}

print_error() {
    print_message "❌ $1" $RED
}

print_info() {
    print_message "ℹ️  $1" $BLUE
}

# 检查必要工具
check_requirements() {
    print_info "检查系统要求..."
    
    local missing_tools=()
    
    if ! command -v node &> /dev/null; then
        missing_tools+=("Node.js")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_tools+=("npm")
    fi
    
    if ! command -v git &> /dev/null; then
        missing_tools+=("git")
    fi
    
    if ! command -v curl &> /dev/null; then
        missing_tools+=("curl")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "缺少必要工具: ${missing_tools[*]}"
        print_info "请安装缺少的工具后重试"
        exit 1
    fi
    
    print_success "系统要求检查通过"
}

# 生成安全密钥
generate_secrets() {
    print_info "生成安全密钥..."
    
    if command -v openssl &> /dev/null; then
        ADMIN_TOKEN=$(openssl rand -hex 32)
        JWT_SECRET=$(openssl rand -hex 64)
    else
        # 如果没有 openssl，使用 Node.js 生成
        ADMIN_TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
        JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    fi
    
    print_success "密钥生成完成"
    echo ""
    print_warning "请妥善保存以下密钥："
    echo "ADMIN_TOKEN: $ADMIN_TOKEN"
    echo "JWT_SECRET: $JWT_SECRET"
    echo ""
    read -p "按回车键继续..."
}

# 检查 Wrangler
setup_wrangler() {
    print_info "设置 Wrangler CLI..."
    
    if ! command -v wrangler &> /dev/null; then
        print_info "安装 Wrangler CLI..."
        npm install -g wrangler
    fi
    
    # 检查是否已登录
    if ! wrangler whoami &> /dev/null; then
        print_warning "需要登录 Cloudflare"
        print_info "即将打开浏览器进行登录..."
        wrangler auth login
    fi
    
    print_success "Wrangler 设置完成"
}

# 创建 D1 数据库
create_d1_database() {
    print_info "创建 D1 数据库..."

    # 创建生产环境 D1 数据库
    D1_OUTPUT=$(wrangler d1 create sub-store-db 2>&1)
    D1_ID=$(echo "$D1_OUTPUT" | grep -o 'database_id = "[^"]*"' | cut -d'"' -f2)

    if [ -z "$D1_ID" ]; then
        # 尝试从不同格式的输出中提取 ID
        D1_ID=$(echo "$D1_OUTPUT" | grep -o '[a-f0-9]\{8\}-[a-f0-9]\{4\}-[a-f0-9]\{4\}-[a-f0-9]\{4\}-[a-f0-9]\{12\}' | head -1)
    fi

    if [ -z "$D1_ID" ]; then
        print_error "D1 数据库创建失败"
        print_error "输出: $D1_OUTPUT"
        exit 1
    fi

    print_success "D1 数据库创建完成"
    print_info "数据库 ID: $D1_ID"

    # 初始化数据库结构
    print_info "初始化数据库结构..."
    cd workers
    if wrangler d1 execute sub-store-db --file=./schema.sql; then
        print_success "数据库结构初始化完成"
    else
        print_warning "数据库结构初始化失败，请手动执行"
    fi
    cd ..
}

# 获取 Cloudflare 信息
get_cloudflare_info() {
    print_info "获取 Cloudflare 账户信息..."
    
    # 获取账户 ID
    ACCOUNT_ID=$(wrangler whoami | grep "Account ID" | awk '{print $3}' || echo "")
    
    if [ -z "$ACCOUNT_ID" ]; then
        print_warning "无法自动获取账户 ID"
        read -p "请输入您的 Cloudflare Account ID: " ACCOUNT_ID
    fi
    
    print_success "Cloudflare 信息获取完成"
    print_info "账户 ID: $ACCOUNT_ID"
}

# 更新配置文件
update_config() {
    print_info "更新配置文件..."
    
    # 获取 GitHub 用户名
    GITHUB_USERNAME=$(git config user.name || echo "")
    if [ -z "$GITHUB_USERNAME" ]; then
        read -p "请输入您的 GitHub 用户名: " GITHUB_USERNAME
    fi
    
    # 更新 wrangler.toml
    cat > workers/wrangler.toml << EOF
name = "sub-store-api"
main = "src/index.ts"
compatibility_date = "2023-12-18"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "sub-store-db"
database_id = "$D1_ID"

[vars]
ENVIRONMENT = "production"
APP_NAME = "Sub-Store"
CORS_ORIGINS = "https://sub-store-frontend.pages.dev,https://$GITHUB_USERNAME.github.io"
EOF
    
    print_success "配置文件更新完成"
}

# 设置 Workers Secrets
setup_workers_secrets() {
    print_info "设置 Workers Secrets..."
    
    cd workers
    
    # 设置管理员密码
    echo "$ADMIN_TOKEN" | wrangler secret put ADMIN_TOKEN
    
    # 设置 JWT 密钥
    echo "$JWT_SECRET" | wrangler secret put JWT_SECRET
    
    cd ..
    
    print_success "Workers Secrets 设置完成"
}

# 部署 Workers
deploy_workers() {
    print_info "部署 Cloudflare Workers..."
    
    cd workers
    npm install
    npm run deploy
    cd ..
    
    print_success "Workers 部署完成"
}

# 显示 GitHub Secrets 配置
show_github_secrets() {
    print_info "GitHub Secrets 配置信息："
    echo ""
    print_warning "请在 GitHub 项目设置中添加以下 Secrets："
    echo ""
    echo "CLOUDFLARE_API_TOKEN: (您的 Cloudflare API Token)"
    echo "CLOUDFLARE_ACCOUNT_ID: $ACCOUNT_ID"
    echo "API_BASE_URL: https://sub-store-api.$GITHUB_USERNAME.workers.dev"
    echo "FRONTEND_URL: https://sub-store-frontend.pages.dev"
    echo ""
    print_info "设置步骤："
    echo "1. 进入 GitHub 项目页面"
    echo "2. 点击 Settings → Secrets and variables → Actions"
    echo "3. 点击 New repository secret 添加上述 Secrets"
    echo ""
}

# 测试部署
test_deployment() {
    print_info "测试部署..."
    
    local api_url="https://sub-store-api.$GITHUB_USERNAME.workers.dev"
    
    # 测试健康检查
    if curl -s "$api_url/health" > /dev/null; then
        print_success "API 部署成功"
    else
        print_warning "API 可能需要几分钟才能生效"
    fi
    
    print_info "API 地址: $api_url"
    print_info "前端地址: https://sub-store-frontend.pages.dev"
    print_info "备用前端: https://$GITHUB_USERNAME.github.io/sub-store"
}

# 主函数
main() {
    echo "🚀 Sub-Store 新架构一键部署脚本"
    echo "===================================="
    echo ""
    print_info "🆕 新架构特性："
    echo "  🌐 Cloudflare Pages (前端) - 更快的中国访问"
    echo "  ⚡ Cloudflare Workers (API) - 全球边缘计算"
    echo "  🗄️ Cloudflare D1 (数据库) - SQLite 关系数据库"
    echo ""
    
    # 检查是否在项目根目录
    if [ ! -f "package.json" ] || [ ! -d "workers" ] || [ ! -d "frontend" ]; then
        print_error "请在项目根目录运行此脚本"
        exit 1
    fi
    
    check_requirements
    generate_secrets
    setup_wrangler
    get_cloudflare_info
    create_d1_database
    update_config
    setup_workers_secrets
    deploy_workers
    
    echo ""
    print_success "🎉 部署完成！"
    echo ""
    
    show_github_secrets
    test_deployment
    
    echo ""
    print_info "下一步："
    echo "1. 按照上面的说明设置 GitHub Secrets"
    echo "2. 推送代码到 GitHub 触发前端部署"
    echo "3. 等待 GitHub Actions 完成部署"
    echo "4. 访问前端地址开始使用"
    echo ""
    print_warning "请保存好生成的密钥，丢失后需要重新生成！"
}

# 运行主函数
main "$@"
