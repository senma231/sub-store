#!/bin/bash

# 完整流程测试脚本
# 测试API -> Bridge -> X-UI的完整连接

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

# 配置
API_BASE="https://sub-api.senma.io"
BRIDGE_URL="http://141.11.91.40:3002"

# 测试API健康检查
test_api_health() {
    log_step "测试API健康检查..."
    
    local response=$(curl -s "$API_BASE/health")
    if echo "$response" | grep -q '"status":"ok"'; then
        log_info "✅ API健康检查通过"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
    else
        log_error "❌ API健康检查失败"
        echo "$response"
        return 1
    fi
}

# 测试Bridge健康检查
test_bridge_health() {
    log_step "测试Bridge健康检查..."
    
    local response=$(curl -s "$BRIDGE_URL/health")
    if echo "$response" | grep -q '"status":"ok"'; then
        log_info "✅ Bridge健康检查通过"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
    else
        log_error "❌ Bridge健康检查失败"
        echo "$response"
        return 1
    fi
}

# 登录获取token
login_and_get_token() {
    log_step "登录获取认证token..."
    
    read -p "请输入用户名: " username
    read -s -p "请输入密码: " password
    echo ""
    
    local response=$(curl -s -X POST "$API_BASE/api/auth/login" \
        -H "Content-Type: application/json" \
        -d "{\"username\":\"$username\",\"password\":\"$password\"}")
    
    if echo "$response" | grep -q '"success":true'; then
        local token=$(echo "$response" | jq -r '.data.token' 2>/dev/null)
        if [ "$token" != "null" ] && [ -n "$token" ]; then
            log_info "✅ 登录成功"
            echo "$token"
            return 0
        fi
    fi
    
    log_error "❌ 登录失败"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    return 1
}

# 测试X-UI连接（通过API）
test_xui_connection_via_api() {
    local token="$1"
    log_step "测试X-UI连接（通过API）..."
    
    read -p "请输入X-UI面板地址 (如: https://example.com:54321): " xui_url
    read -p "请输入X-UI用户名: " xui_username
    read -s -p "请输入X-UI密码: " xui_password
    echo ""
    
    local response=$(curl -s -X POST "$API_BASE/api/xui-panels/test" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "{\"url\":\"$xui_url\",\"username\":\"$xui_username\",\"password\":\"$xui_password\",\"useProxy\":true,\"bridgeUrl\":\"$BRIDGE_URL\"}")
    
    log_info "API响应:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    
    if echo "$response" | grep -q '"success":true'; then
        log_info "✅ API调用成功"
        
        # 检查实际连接状态
        if echo "$response" | grep -q '"status":"error"'; then
            log_error "❌ X-UI连接失败"
            local error=$(echo "$response" | jq -r '.data.error' 2>/dev/null)
            log_error "错误: $error"
        else
            log_info "✅ X-UI连接成功"
        fi
    else
        log_error "❌ API调用失败"
    fi
}

# 测试X-UI连接（直接通过Bridge）
test_xui_connection_via_bridge() {
    log_step "测试X-UI连接（直接通过Bridge）..."
    
    read -p "请输入X-UI面板地址 (如: https://example.com:54321): " xui_url
    read -p "请输入X-UI用户名: " xui_username
    read -s -p "请输入X-UI密码: " xui_password
    echo ""
    
    local response=$(curl -s -X POST "$BRIDGE_URL/api/xui/test" \
        -H "Content-Type: application/json" \
        -d "{\"url\":\"$xui_url\",\"username\":\"$xui_username\",\"password\":\"$xui_password\"}")
    
    log_info "Bridge响应:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    
    if echo "$response" | grep -q '"success":true'; then
        log_info "✅ Bridge连接测试成功"
    else
        log_error "❌ Bridge连接测试失败"
    fi
}

# 检查网络连通性
check_network_connectivity() {
    log_step "检查网络连通性..."
    
    # 检查API到Bridge的连接
    log_info "从API服务器测试Bridge连接..."
    local bridge_test=$(curl -s --connect-timeout 10 "$BRIDGE_URL/health" || echo "failed")
    
    if echo "$bridge_test" | grep -q '"status":"ok"'; then
        log_info "✅ API可以访问Bridge服务"
    else
        log_error "❌ API无法访问Bridge服务"
        log_error "这可能是网络问题或防火墙阻止"
    fi
    
    # 检查CORS设置
    log_info "检查CORS设置..."
    local cors_test=$(curl -s -I -X OPTIONS "$API_BASE/api/xui-panels" \
        -H "Origin: https://sub.senma.io" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type,Authorization")
    
    if echo "$cors_test" | grep -q "Access-Control-Allow-Origin"; then
        log_info "✅ CORS配置正常"
    else
        log_warn "⚠️ CORS配置可能有问题"
    fi
}

# 显示诊断信息
show_diagnosis() {
    log_step "显示诊断信息..."
    
    echo ""
    echo "=== 系统配置 ==="
    echo "前端域名: https://sub.senma.io"
    echo "API域名: $API_BASE"
    echo "Bridge地址: $BRIDGE_URL"
    echo ""
    
    echo "=== 服务状态 ==="
    echo "API状态: $(curl -s $API_BASE/health | jq -r '.status' 2>/dev/null || echo '未知')"
    echo "Bridge状态: $(curl -s $BRIDGE_URL/health | jq -r '.status' 2>/dev/null || echo '未知')"
    echo ""
    
    echo "=== 数据库统计 ==="
    curl -s "$API_BASE/health" | jq '.database.stats' 2>/dev/null || echo "无法获取"
    echo ""
}

# 主菜单
show_menu() {
    echo ""
    echo "=== Sub-Store 完整流程测试 ==="
    echo "1. 测试API健康检查"
    echo "2. 测试Bridge健康检查"
    echo "3. 测试完整登录流程"
    echo "4. 测试X-UI连接（通过API）"
    echo "5. 测试X-UI连接（直接Bridge）"
    echo "6. 检查网络连通性"
    echo "7. 显示诊断信息"
    echo "8. 运行完整测试"
    echo "0. 退出"
    echo ""
}

# 完整测试
run_full_test() {
    log_info "开始完整测试流程..."
    
    # 1. 测试基础服务
    test_api_health || return 1
    echo ""
    test_bridge_health || return 1
    echo ""
    
    # 2. 检查网络连通性
    check_network_connectivity
    echo ""
    
    # 3. 登录测试
    local token
    if token=$(login_and_get_token); then
        echo ""
        # 4. 测试X-UI连接
        test_xui_connection_via_api "$token"
    fi
    
    echo ""
    show_diagnosis
    
    log_info "完整测试完成！"
}

# 主函数
main() {
    case "$1" in
        "api")
            test_api_health
            ;;
        "bridge")
            test_bridge_health
            ;;
        "full")
            run_full_test
            ;;
        *)
            # 交互式菜单
            while true; do
                show_menu
                read -p "请选择操作 (0-8): " choice
                
                case $choice in
                    1) test_api_health ;;
                    2) test_bridge_health ;;
                    3) 
                        if token=$(login_and_get_token); then
                            log_info "Token: ${token:0:20}..."
                        fi
                        ;;
                    4) 
                        if token=$(login_and_get_token); then
                            test_xui_connection_via_api "$token"
                        fi
                        ;;
                    5) test_xui_connection_via_bridge ;;
                    6) check_network_connectivity ;;
                    7) show_diagnosis ;;
                    8) run_full_test ;;
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
