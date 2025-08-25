#!/bin/bash

# 简化测试脚本 - 逐步诊断问题

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

API_BASE="https://sub-api.senma.io"
BRIDGE_URL="http://141.11.91.40:3002"

# 1. 测试API基础连接
test_api_basic() {
    log_step "1. 测试API基础连接..."
    
    echo "测试API健康检查:"
    curl -v "$API_BASE/health" 2>&1 | head -20
    echo ""
}

# 2. 测试登录
test_login() {
    log_step "2. 测试登录功能..."
    
    read -p "请输入用户名: " username
    read -s -p "请输入密码: " password
    echo ""
    
    echo "发送登录请求:"
    local response=$(curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST "$API_BASE/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"password\":\"$password\"}")
    
    echo "$response"
    
    # 提取token
    local token=$(echo "$response" | grep -v "HTTP_CODE" | jq -r '.data.token' 2>/dev/null)
    if [ "$token" != "null" ] && [ -n "$token" ] && [ "$token" != "" ]; then
        log_info "✅ 登录成功，Token: ${token:0:20}..."
        echo "$token" > /tmp/token.txt
        return 0
    else
        log_error "❌ 登录失败"
        return 1
    fi
}

# 3. 测试获取X-UI面板列表
test_get_panels() {
    log_step "3. 测试获取X-UI面板列表..."
    
    if [ ! -f /tmp/token.txt ]; then
        log_error "需要先登录"
        return 1
    fi
    
    local token=$(cat /tmp/token.txt)
    
    echo "获取X-UI面板列表:"
    curl -s -w "\nHTTP_CODE:%{http_code}\n" "$API_BASE/api/xui-panels" \
        -H "Authorization: Bearer $token" | jq '.' 2>/dev/null || cat
    echo ""
}

# 4. 测试Bridge连接
test_bridge_direct() {
    log_step "4. 测试Bridge直接连接..."
    
    read -p "请输入X-UI面板地址 (如: https://example.com:54321): " xui_url
    read -p "请输入X-UI用户名: " xui_username
    read -s -p "请输入X-UI密码: " xui_password
    echo ""
    
    echo "直接测试Bridge服务:"
    curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST "$BRIDGE_URL/api/xui/test" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$xui_url\",\"username\":\"$xui_username\",\"password\":\"$xui_password\"}" \
        | jq '.' 2>/dev/null || cat
    echo ""
}

# 5. 测试通过API调用Bridge
test_api_to_bridge() {
    log_step "5. 测试通过API调用Bridge..."
    
    if [ ! -f /tmp/token.txt ]; then
        log_error "需要先登录"
        return 1
    fi
    
    local token=$(cat /tmp/token.txt)
    
    read -p "请输入X-UI面板地址 (如: https://example.com:54321): " xui_url
    read -p "请输入X-UI用户名: " xui_username
    read -s -p "请输入X-UI密码: " xui_password
    echo ""
    
    echo "通过API测试X-UI连接:"
    curl -s -w "\nHTTP_CODE:%{http_code}\n" -X POST "$API_BASE/api/xui-panels/test" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "{\"url\":\"$xui_url\",\"username\":\"$xui_username\",\"password\":\"$xui_password\",\"useProxy\":true,\"bridgeUrl\":\"$BRIDGE_URL\"}" \
        | jq '.' 2>/dev/null || cat
    echo ""
}

# 6. 测试CORS
test_cors() {
    log_step "6. 测试CORS配置..."
    
    echo "测试CORS预检请求:"
    curl -s -I -X OPTIONS "$API_BASE/api/xui-panels" \
        -H "Origin: https://sub.senma.io" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type,Authorization"
    echo ""
}

# 7. 检查网络连接
test_network() {
    log_step "7. 检查网络连接..."
    
    echo "检查DNS解析:"
    nslookup sub-api.senma.io
    echo ""
    
    echo "检查端口连接:"
    nc -zv sub-api.senma.io 443 2>&1 || echo "端口443连接测试"
    nc -zv 141.11.91.40 3002 2>&1 || echo "端口3002连接测试"
    echo ""
}

# 显示菜单
show_menu() {
    echo ""
    echo "=== Sub-Store 简化测试工具 ==="
    echo "1. 测试API基础连接"
    echo "2. 测试登录功能"
    echo "3. 测试获取X-UI面板列表"
    echo "4. 测试Bridge直接连接"
    echo "5. 测试通过API调用Bridge"
    echo "6. 测试CORS配置"
    echo "7. 检查网络连接"
    echo "8. 运行所有测试"
    echo "0. 退出"
    echo ""
}

# 运行所有测试
run_all_tests() {
    log_info "开始运行所有测试..."
    
    test_api_basic
    echo "按回车继续..." && read
    
    test_login
    echo "按回车继续..." && read
    
    test_get_panels
    echo "按回车继续..." && read
    
    test_cors
    echo "按回车继续..." && read
    
    test_network
    echo "按回车继续..." && read
    
    echo "是否测试X-UI连接？(y/n)"
    read test_xui
    if [[ $test_xui == "y" || $test_xui == "Y" ]]; then
        test_bridge_direct
        echo "按回车继续..." && read
        test_api_to_bridge
    fi
    
    log_info "所有测试完成！"
}

# 主函数
main() {
    case "$1" in
        "api") test_api_basic ;;
        "login") test_login ;;
        "panels") test_get_panels ;;
        "bridge") test_bridge_direct ;;
        "api-bridge") test_api_to_bridge ;;
        "cors") test_cors ;;
        "network") test_network ;;
        "all") run_all_tests ;;
        *)
            while true; do
                show_menu
                read -p "请选择操作 (0-8): " choice
                
                case $choice in
                    1) test_api_basic ;;
                    2) test_login ;;
                    3) test_get_panels ;;
                    4) test_bridge_direct ;;
                    5) test_api_to_bridge ;;
                    6) test_cors ;;
                    7) test_network ;;
                    8) run_all_tests ;;
                    0) echo "退出"; exit 0 ;;
                    *) echo "无效选择" ;;
                esac
                
                echo ""
                read -p "按回车键继续..."
            done
            ;;
    esac
}

# 清理临时文件
cleanup() {
    rm -f /tmp/token.txt
}

trap cleanup EXIT

# 执行主函数
main "$@"
