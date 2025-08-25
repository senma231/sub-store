#!/bin/bash

# 前端API地址修复脚本
# 用于修复前端API配置问题

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# 检查当前API配置
check_current_config() {
    log_step "检查当前API配置..."
    
    if [ -f "frontend/src/services/api.ts" ]; then
        log_info "当前API配置:"
        grep -n "API_BASE_URL\|sub-api\|localhost" frontend/src/services/api.ts || true
    else
        log_error "未找到API配置文件"
        return 1
    fi
    
    if [ -f "frontend/src/services/authService.ts" ]; then
        log_info "当前认证服务配置:"
        grep -n "sub-api\|localhost" frontend/src/services/authService.ts || true
    fi
}

# 测试API连接
test_api_connection() {
    local api_url="$1"
    log_step "测试API连接: $api_url"
    
    # 测试健康检查
    if curl -s --connect-timeout 10 "$api_url/health" > /dev/null; then
        log_info "✅ API连接正常"
        curl -s "$api_url/health" | jq '.' 2>/dev/null || curl -s "$api_url/health"
        return 0
    else
        log_error "❌ API连接失败"
        return 1
    fi
}

# 获取正确的API地址
get_correct_api_url() {
    log_step "检测正确的API地址..."
    
    # 可能的API地址列表
    local api_urls=(
        "https://sub-api.senma.io"
        "https://substore-api.senmago231.workers.dev"
        "https://sub-store-api.senmago231.workers.dev"
        "https://sub-store.senmago231.workers.dev"
    )
    
    for url in "${api_urls[@]}"; do
        log_info "测试: $url"
        if test_api_connection "$url"; then
            echo "$url"
            return 0
        fi
    done
    
    log_error "未找到可用的API地址"
    return 1
}

# 更新API配置
update_api_config() {
    local new_api_url="$1"
    log_step "更新API配置为: $new_api_url"
    
    # 备份原文件
    cp frontend/src/services/api.ts frontend/src/services/api.ts.backup
    log_info "已备份原配置文件"
    
    # 更新API配置
    sed -i "s|https://sub-api\.senma\.io|$new_api_url|g" frontend/src/services/api.ts
    
    # 更新认证服务配置
    if [ -f "frontend/src/services/authService.ts" ]; then
        cp frontend/src/services/authService.ts frontend/src/services/authService.ts.backup
        sed -i "s|https://sub-api\.senma\.io|$new_api_url|g" frontend/src/services/authService.ts
    fi
    
    log_info "✅ API配置已更新"
}

# 更新订阅服务配置
update_subscription_config() {
    local new_api_url="$1"
    log_step "更新订阅服务配置..."
    
    if [ -f "frontend/src/services/subscriptionService.ts" ]; then
        cp frontend/src/services/subscriptionService.ts frontend/src/services/subscriptionService.ts.backup
        
        # 提取域名部分
        local domain=$(echo "$new_api_url" | sed 's|https://||' | sed 's|http://||')
        
        # 更新订阅服务配置
        sed -i "s|substore-api\.senmago231\.workers\.dev|$domain|g" frontend/src/services/subscriptionService.ts
        
        log_info "✅ 订阅服务配置已更新"
    fi
}

# 创建环境变量文件
create_env_file() {
    local api_url="$1"
    log_step "创建环境变量文件..."
    
    cat > frontend/.env << EOF
# API配置
VITE_API_BASE_URL=$api_url

# 应用配置
VITE_APP_TITLE=Sub-Store
VITE_APP_VERSION=2.0.0
EOF
    
    log_info "✅ 环境变量文件已创建"
}

# 重新构建前端
rebuild_frontend() {
    log_step "重新构建前端..."
    
    cd frontend
    
    # 安装依赖
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    
    # 构建
    npm run build
    
    log_info "✅ 前端构建完成"
    cd ..
}

# 显示修复结果
show_result() {
    local api_url="$1"
    
    echo ""
    echo -e "${GREEN}🎉 API配置修复完成！${NC}"
    echo ""
    echo -e "${BLUE}新的API配置:${NC}"
    echo "- API地址: $api_url"
    echo "- 健康检查: $api_url/health"
    echo "- 认证接口: $api_url/api/auth/login"
    echo ""
    echo -e "${BLUE}下一步操作:${NC}"
    echo "1. 重新部署前端应用"
    echo "2. 清除浏览器缓存"
    echo "3. 重新登录系统"
    echo ""
    echo -e "${BLUE}验证步骤:${NC}"
    echo "1. 打开浏览器开发者工具"
    echo "2. 查看Network标签页"
    echo "3. 确认API请求指向正确地址"
}

# 恢复备份
restore_backup() {
    log_step "恢复备份配置..."
    
    if [ -f "frontend/src/services/api.ts.backup" ]; then
        mv frontend/src/services/api.ts.backup frontend/src/services/api.ts
        log_info "✅ API配置已恢复"
    fi
    
    if [ -f "frontend/src/services/authService.ts.backup" ]; then
        mv frontend/src/services/authService.ts.backup frontend/src/services/authService.ts
        log_info "✅ 认证服务配置已恢复"
    fi
    
    if [ -f "frontend/src/services/subscriptionService.ts.backup" ]; then
        mv frontend/src/services/subscriptionService.ts.backup frontend/src/services/subscriptionService.ts
        log_info "✅ 订阅服务配置已恢复"
    fi
}

# 主菜单
show_menu() {
    echo ""
    echo "=== 前端API配置修复工具 ==="
    echo "1. 检查当前配置"
    echo "2. 自动检测并修复API地址"
    echo "3. 手动指定API地址"
    echo "4. 重新构建前端"
    echo "5. 恢复备份配置"
    echo "0. 退出"
    echo ""
}

# 自动修复
auto_fix() {
    log_info "开始自动修复API配置..."
    
    check_current_config
    
    local correct_url
    if correct_url=$(get_correct_api_url); then
        update_api_config "$correct_url"
        update_subscription_config "$correct_url"
        create_env_file "$correct_url"
        show_result "$correct_url"
        
        read -p "是否重新构建前端？(y/n): " rebuild
        if [[ $rebuild == "y" || $rebuild == "Y" ]]; then
            rebuild_frontend
        fi
    else
        log_error "自动修复失败，请手动指定API地址"
    fi
}

# 手动修复
manual_fix() {
    read -p "请输入正确的API地址 (如: https://your-api.workers.dev): " api_url
    
    if [ -z "$api_url" ]; then
        log_error "API地址不能为空"
        return 1
    fi
    
    log_info "测试指定的API地址..."
    if test_api_connection "$api_url"; then
        update_api_config "$api_url"
        update_subscription_config "$api_url"
        create_env_file "$api_url"
        show_result "$api_url"
        
        read -p "是否重新构建前端？(y/n): " rebuild
        if [[ $rebuild == "y" || $rebuild == "Y" ]]; then
            rebuild_frontend
        fi
    else
        log_error "指定的API地址无法连接"
    fi
}

# 主函数
main() {
    # 检查是否在项目根目录
    if [ ! -d "frontend" ] || [ ! -f "frontend/src/services/api.ts" ]; then
        log_error "请在项目根目录运行此脚本"
        exit 1
    fi
    
    # 如果有参数，直接执行对应功能
    case "$1" in
        "check")
            check_current_config
            ;;
        "auto")
            auto_fix
            ;;
        "manual")
            manual_fix
            ;;
        "restore")
            restore_backup
            ;;
        *)
            # 交互式菜单
            while true; do
                show_menu
                read -p "请选择操作 (0-5): " choice
                
                case $choice in
                    1) check_current_config ;;
                    2) auto_fix ;;
                    3) manual_fix ;;
                    4) rebuild_frontend ;;
                    5) restore_backup ;;
                    0) echo "退出"; exit 0 ;;
                    *) echo "无效选择" ;;
                esac
                
                echo ""
                read -p "按回车键继续..."
            done
            ;;
    esac
}

# 执行主函数
main "$@"
