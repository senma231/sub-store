#!/bin/bash

# Sub-Store 快速安装脚本
# 用于快速设置开发环境和部署配置

set -e

echo "🚀 Sub-Store 快速安装脚本"
echo "================================"

# 检查必要工具
check_requirements() {
    echo "📋 检查系统要求..."
    
    if ! command -v node &> /dev/null; then
        echo "❌ Node.js 未安装，请先安装 Node.js 18+"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo "❌ npm 未安装"
        exit 1
    fi
    
    echo "✅ 系统要求检查通过"
}

# 安装依赖
install_dependencies() {
    echo "📦 安装项目依赖..."
    
    # 安装根目录依赖
    npm install
    
    # 安装前端依赖
    echo "安装前端依赖..."
    cd frontend && npm install && cd ..
    
    # 安装 Workers 依赖
    echo "安装 Workers 依赖..."
    cd workers && npm install && cd ..
    
    echo "✅ 依赖安装完成"
}

# 设置环境变量
setup_environment() {
    echo "⚙️ 设置环境变量..."
    
    if [ ! -f .env ]; then
        cp .env.example .env
        echo "📝 已创建 .env 文件，请编辑其中的配置"
    fi
    
    # 生成随机密钥
    if command -v openssl &> /dev/null; then
        ADMIN_TOKEN=$(openssl rand -hex 16)
        JWT_SECRET=$(openssl rand -hex 32)
        
        echo "🔑 生成的密钥："
        echo "ADMIN_TOKEN=$ADMIN_TOKEN"
        echo "JWT_SECRET=$JWT_SECRET"
        echo ""
        echo "请将这些密钥保存到安全的地方！"
    else
        echo "⚠️ 未找到 openssl，请手动生成 ADMIN_TOKEN 和 JWT_SECRET"
    fi
}

# 检查 Wrangler
setup_wrangler() {
    echo "🔧 设置 Wrangler..."
    
    if ! command -v wrangler &> /dev/null; then
        echo "安装 Wrangler CLI..."
        npm install -g wrangler
    fi
    
    echo "请运行以下命令登录 Cloudflare："
    echo "wrangler auth login"
    echo ""
    echo "然后创建 KV 命名空间："
    echo "wrangler kv:namespace create \"SUB_STORE_KV\""
    echo "wrangler kv:namespace create \"SUB_STORE_KV\" --preview"
}

# 构建项目
build_project() {
    echo "🔨 构建项目..."
    
    # 构建前端
    echo "构建前端..."
    cd frontend && npm run build && cd ..
    
    # 构建 Workers
    echo "构建 Workers..."
    cd workers && npm run build && cd ..
    
    echo "✅ 项目构建完成"
}

# 本地开发
start_dev() {
    echo "🚀 启动开发服务器..."
    echo "前端: http://localhost:3000"
    echo "Workers: http://localhost:8787"
    echo ""
    echo "按 Ctrl+C 停止服务器"
    
    npm run dev
}

# 部署到生产环境
deploy_production() {
    echo "🚀 部署到生产环境..."
    
    read -p "确定要部署到生产环境吗？(y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "部署 Workers..."
        cd workers && npm run deploy && cd ..
        
        echo "构建前端..."
        cd frontend && npm run build && cd ..
        
        echo "✅ 部署完成"
        echo "请将 frontend/dist 目录的内容上传到 GitHub Pages"
    else
        echo "取消部署"
    fi
}

# 显示帮助信息
show_help() {
    echo "Sub-Store 安装脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  install     安装依赖和设置环境"
    echo "  dev         启动开发服务器"
    echo "  build       构建项目"
    echo "  deploy      部署到生产环境"
    echo "  help        显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 install   # 完整安装"
    echo "  $0 dev       # 启动开发服务器"
    echo "  $0 deploy    # 部署到生产环境"
}

# 主函数
main() {
    case "${1:-install}" in
        "install")
            check_requirements
            install_dependencies
            setup_environment
            setup_wrangler
            echo ""
            echo "🎉 安装完成！"
            echo ""
            echo "下一步："
            echo "1. 编辑 .env 文件配置"
            echo "2. 登录 Cloudflare: wrangler auth login"
            echo "3. 创建 KV 命名空间"
            echo "4. 运行 $0 dev 启动开发服务器"
            ;;
        "dev")
            start_dev
            ;;
        "build")
            build_project
            ;;
        "deploy")
            deploy_production
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            echo "❌ 未知选项: $1"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"
