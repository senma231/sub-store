#!/bin/bash

# X-UI Bridge 测试脚本
# 用于测试更新后的Bridge服务功能

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 获取服务器IP
SERVER_IP=$(hostname -I | awk '{print $1}')
BRIDGE_URL="http://localhost:3002"

# 测试健康检查
test_health() {
    log_step "测试健康检查..."
    
    RESPONSE=$(curl -s -w "%{http_code}" $BRIDGE_URL/health)
    HTTP_CODE="${RESPONSE: -3}"
    BODY="${RESPONSE%???}"
    
    if [ "$HTTP_CODE" = "200" ]; then
        log_info "✅ 健康检查通过"
        echo "响应: $BODY"
    else
        log_error "❌ 健康检查失败 (HTTP $HTTP_CODE)"
        echo "响应: $BODY"
        return 1
    fi
}

# 测试连接接口
test_connection() {
    log_step "测试连接接口..."
    
    RESPONSE=$(curl -s -w "%{http_code}" -X POST $BRIDGE_URL/api/xui/test \
        -H "Content-Type: application/json" \
        -d '{"url":"https://test.com","username":"test","password":"test"}')
    
    HTTP_CODE="${RESPONSE: -3}"
    BODY="${RESPONSE%???}"
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "500" ]; then
        log_info "✅ 连接接口可访问"
        echo "HTTP状态码: $HTTP_CODE"
        echo "响应: $BODY"
    else
        log_error "❌ 连接接口测试失败 (HTTP $HTTP_CODE)"
        echo "响应: $BODY"
        return 1
    fi
}

# 测试同步接口
test_sync() {
    log_step "测试同步接口..."
    
    RESPONSE=$(curl -s -w "%{http_code}" -X POST $BRIDGE_URL/api/xui/sync \
        -H "Content-Type: application/json" \
        -d '{"url":"https://test.com","username":"test","password":"test"}')
    
    HTTP_CODE="${RESPONSE: -3}"
    BODY="${RESPONSE%???}"
    
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "500" ]; then
        log_info "✅ 同步接口可访问"
        echo "HTTP状态码: $HTTP_CODE"
        echo "响应: $BODY"
    else
        log_error "❌ 同步接口测试失败 (HTTP $HTTP_CODE)"
        echo "响应: $BODY"
        return 1
    fi
}

# 检查服务状态
check_service_status() {
    log_step "检查服务状态..."
    
    if systemctl is-active --quiet xui-bridge.service; then
        log_info "✅ xui-bridge服务正在运行"
        
        # 显示服务信息
        echo "服务状态:"
        systemctl status xui-bridge.service --no-pager -l
    else
        log_error "❌ xui-bridge服务未运行"
        echo "服务状态:"
        systemctl status xui-bridge.service --no-pager -l
        return 1
    fi
}

# 显示服务日志
show_logs() {
    log_step "显示最近的服务日志..."
    
    echo "最近10条日志:"
    journalctl -u xui-bridge -n 10 --no-pager
}

# 显示测试结果
show_test_result() {
    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  X-UI Bridge 测试完成${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    echo -e "${BLUE}服务信息:${NC}"
    echo -e "  服务器IP: $SERVER_IP"
    echo -e "  本地地址: http://localhost:3002"
    echo -e "  外部地址: http://$SERVER_IP:3002"
    echo ""
    echo -e "${BLUE}可用接口:${NC}"
    echo -e "  健康检查: GET  /health"
    echo -e "  测试连接: POST /api/xui/test"
    echo -e "  同步节点: POST /api/xui/sync"
    echo ""
    echo -e "${BLUE}管理命令:${NC}"
    echo -e "  查看状态: systemctl status xui-bridge"
    echo -e "  查看日志: journalctl -u xui-bridge -f"
    echo -e "  重启服务: systemctl restart xui-bridge"
    echo ""
}

# 主函数
main() {
    log_info "开始测试X-UI Bridge服务..."
    echo ""
    
    # 检查服务状态
    if ! check_service_status; then
        log_error "服务状态检查失败，退出测试"
        exit 1
    fi
    
    echo ""
    
    # 测试各个接口
    test_health
    echo ""
    
    test_connection
    echo ""
    
    test_sync
    echo ""
    
    # 显示日志
    show_logs
    
    # 显示测试结果
    show_test_result
    
    log_info "测试完成！"
}

# 检查是否为root用户
if [[ $EUID -ne 0 ]]; then
    log_error "此脚本需要root权限运行"
    log_info "请使用: sudo $0"
    exit 1
fi

# 执行主函数
main "$@"
