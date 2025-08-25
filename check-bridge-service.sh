#!/bin/bash

# Bridge服务检查和修复脚本
# 用于诊断和修复X-UI Bridge服务问题

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

# 检查Bridge服务状态
check_bridge_service() {
    log_step "检查Bridge服务状态..."
    
    # 检查服务是否存在
    if ! systemctl list-unit-files | grep -q "xui-bridge.service"; then
        log_error "Bridge服务未安装"
        return 1
    fi
    
    # 检查服务状态
    if systemctl is-active --quiet xui-bridge.service; then
        log_info "✅ Bridge服务正在运行"
        
        # 检查端口监听
        if netstat -tlnp | grep -q ":3002"; then
            log_info "✅ 端口3002正在监听"
        else
            log_warn "⚠️ 端口3002未监听"
        fi
        
        # 测试健康检查
        if curl -s http://localhost:3002/health > /dev/null; then
            log_info "✅ 健康检查通过"
            curl -s http://localhost:3002/health | jq '.' 2>/dev/null || curl -s http://localhost:3002/health
        else
            log_error "❌ 健康检查失败"
        fi
        
    else
        log_error "❌ Bridge服务未运行"
        log_info "服务状态:"
        systemctl status xui-bridge.service --no-pager -l
        return 1
    fi
}

# 检查网络连接
check_network() {
    log_step "检查网络连接..."
    
    # 检查外网连接
    if curl -s --connect-timeout 5 https://www.google.com > /dev/null; then
        log_info "✅ 外网连接正常"
    else
        log_warn "⚠️ 外网连接可能有问题"
    fi
    
    # 检查DNS解析
    if nslookup google.com > /dev/null 2>&1; then
        log_info "✅ DNS解析正常"
    else
        log_warn "⚠️ DNS解析可能有问题"
    fi
}

# 检查防火墙
check_firewall() {
    log_step "检查防火墙设置..."
    
    if command -v ufw > /dev/null; then
        if ufw status | grep -q "Status: active"; then
            log_info "UFW防火墙状态:"
            ufw status | grep 3002 || log_warn "端口3002未在UFW中开放"
        else
            log_info "✅ UFW防火墙未启用"
        fi
    fi
    
    if command -v firewall-cmd > /dev/null; then
        if firewall-cmd --state 2>/dev/null | grep -q "running"; then
            log_info "Firewalld状态:"
            firewall-cmd --list-ports | grep 3002 || log_warn "端口3002未在firewalld中开放"
        else
            log_info "✅ Firewalld未运行"
        fi
    fi
}

# 检查日志
check_logs() {
    log_step "检查服务日志..."
    
    log_info "最近的服务日志:"
    journalctl -u xui-bridge.service --no-pager -n 20 --since "5 minutes ago"
}

# 测试Bridge API
test_bridge_api() {
    log_step "测试Bridge API..."
    
    # 测试健康检查
    echo "测试健康检查:"
    curl -s http://localhost:3002/health | jq '.' 2>/dev/null || curl -s http://localhost:3002/health
    echo ""
    
    # 测试API接口（需要用户输入）
    read -p "是否测试X-UI连接API？需要提供X-UI面板信息 (y/n): " test_api
    if [[ $test_api == "y" || $test_api == "Y" ]]; then
        read -p "X-UI面板地址 (如: https://example.com:54321): " xui_url
        read -p "用户名: " xui_username
        read -s -p "密码: " xui_password
        echo ""
        
        echo "测试X-UI连接..."
        curl -s -X POST http://localhost:3002/api/xui/test \
            -H "Content-Type: application/json" \
            -d "{\"url\":\"$xui_url\",\"username\":\"$xui_username\",\"password\":\"$xui_password\"}" \
            | jq '.' 2>/dev/null || echo "API测试完成"
    fi
}

# 修复Bridge服务
fix_bridge_service() {
    log_step "尝试修复Bridge服务..."
    
    # 重启服务
    log_info "重启Bridge服务..."
    systemctl restart xui-bridge.service
    sleep 3
    
    # 检查是否成功
    if systemctl is-active --quiet xui-bridge.service; then
        log_info "✅ 服务重启成功"
    else
        log_error "❌ 服务重启失败"
        log_info "查看错误日志:"
        journalctl -u xui-bridge.service --no-pager -n 10
        return 1
    fi
}

# 显示配置信息
show_config() {
    log_step "显示配置信息..."
    
    echo "Bridge服务配置:"
    echo "- 服务端口: 3002"
    echo "- 健康检查: http://localhost:3002/health"
    echo "- 测试接口: POST http://localhost:3002/api/xui/test"
    echo "- 同步接口: POST http://localhost:3002/api/xui/sync"
    echo ""
    
    echo "域名配置:"
    echo "- 前端域名: https://sub.senma.io"
    echo "- API域名: https://sub-api.senma.io"
    echo "- XUI_BRIDGE_URL: http://141.11.91.40:3002"
    echo ""
    
    echo "网络信息:"
    echo "- 服务器IP: $(hostname -I | awk '{print $1}')"
    echo "- 监听端口: $(netstat -tlnp | grep :3002 || echo '未监听')"
}

# 主菜单
show_menu() {
    echo ""
    echo "=== X-UI Bridge 服务诊断工具 ==="
    echo "1. 检查服务状态"
    echo "2. 检查网络连接"
    echo "3. 检查防火墙"
    echo "4. 查看服务日志"
    echo "5. 测试Bridge API"
    echo "6. 修复服务"
    echo "7. 显示配置信息"
    echo "8. 完整诊断"
    echo "0. 退出"
    echo ""
}

# 完整诊断
full_diagnosis() {
    log_info "开始完整诊断..."
    echo ""
    
    check_bridge_service
    echo ""
    check_network
    echo ""
    check_firewall
    echo ""
    check_logs
    echo ""
    show_config
    
    log_info "诊断完成！"
}

# 主函数
main() {
    if [[ $EUID -ne 0 ]]; then
        echo "需要root权限，请使用: sudo $0"
        exit 1
    fi
    
    # 如果有参数，直接执行对应功能
    case "$1" in
        "check")
            check_bridge_service
            ;;
        "fix")
            fix_bridge_service
            ;;
        "test")
            test_bridge_api
            ;;
        "full")
            full_diagnosis
            ;;
        *)
            # 交互式菜单
            while true; do
                show_menu
                read -p "请选择操作 (0-8): " choice
                
                case $choice in
                    1) check_bridge_service ;;
                    2) check_network ;;
                    3) check_firewall ;;
                    4) check_logs ;;
                    5) test_bridge_api ;;
                    6) fix_bridge_service ;;
                    7) show_config ;;
                    8) full_diagnosis ;;
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
