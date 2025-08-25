#!/bin/bash

# X-UI Bridge HTTPS 配置脚本 (Caddy版本)
# 使用Caddy自动配置HTTPS，比Nginx更简单！

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

# 检查root权限
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "需要root权限运行此脚本"
        exit 1
    fi
}

# 获取域名信息
get_domain_info() {
    log_step "配置域名信息..."

    echo "请选择配置方式："
    echo "1. 使用现有域名 (推荐) - Caddy自动HTTPS"
    echo "2. 使用免费域名服务 - Caddy自动HTTPS"
    echo "3. 仅HTTP (测试用)"

    read -p "请选择 (1-3): " choice

    case $choice in
        1)
            read -p "请输入您的域名 (例: bridge.yourdomain.com): " DOMAIN
            USE_HTTPS=true
            ;;
        2)
            log_info "推荐使用 freenom.com、noip.com 或 duckdns.org 获取免费域名"
            read -p "请输入免费域名: " DOMAIN
            USE_HTTPS=true
            ;;
        3)
            DOMAIN="localhost"
            USE_HTTPS=false
            log_warn "仅HTTP模式，生产环境请使用真实域名"
            ;;
        *)
            log_error "无效选择"
            exit 1
            ;;
    esac

    log_info "域名: $DOMAIN"
    log_info "HTTPS: $USE_HTTPS"
}

# 安装Caddy
install_caddy() {
    log_step "安装Caddy..."

    # 更新包列表
    apt update

    # 安装必要的依赖
    apt install -y debian-keyring debian-archive-keyring apt-transport-https curl

    # 添加Caddy官方仓库
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list

    # 安装Caddy
    apt update
    apt install -y caddy

    log_info "Caddy安装完成"
}

# 配置Caddy
configure_caddy() {
    log_step "配置Caddy..."

    # 创建Caddy配置文件
    if [ "$USE_HTTPS" = true ]; then
        # HTTPS配置 - Caddy自动处理SSL证书
        cat > /etc/caddy/Caddyfile << EOF
# X-UI Bridge HTTPS配置
$DOMAIN {
    # 反向代理到Bridge服务
    reverse_proxy localhost:3002

    # CORS支持
    header {
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, POST, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, Authorization"
    }

    # 处理OPTIONS请求
    @options method OPTIONS
    respond @options 204

    # 日志
    log {
        output file /var/log/caddy/xui-bridge.log
        format json
    }
}
EOF
    else
        # HTTP配置 (仅测试用)
        cat > /etc/caddy/Caddyfile << EOF
# X-UI Bridge HTTP配置 (仅测试用)
:80 {
    # 反向代理到Bridge服务
    reverse_proxy localhost:3002

    # CORS支持
    header {
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, POST, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, Authorization"
    }

    # 处理OPTIONS请求
    @options method OPTIONS
    respond @options 204

    # 日志
    log {
        output file /var/log/caddy/xui-bridge.log
        format json
    }
}
EOF
    fi

    # 创建日志目录
    mkdir -p /var/log/caddy
    chown caddy:caddy /var/log/caddy

    # 验证配置
    caddy validate --config /etc/caddy/Caddyfile

    log_info "Caddy配置完成"
}

# Caddy自动处理SSL，无需手动配置
# 这就是Caddy的魅力所在！

# 启动服务
start_services() {
    log_step "启动服务..."

    # 确保Bridge服务运行
    systemctl start xui-bridge
    systemctl enable xui-bridge

    # 启动Caddy
    systemctl start caddy
    systemctl enable caddy

    # 等待服务启动
    sleep 3

    log_info "服务启动完成"
}

# 测试服务
test_service() {
    log_step "测试服务连接..."

    sleep 5  # 等待Caddy完全启动和获取证书

    if [ "$USE_HTTPS" = true ]; then
        PROTOCOL="https"
        TEST_URL="https://$DOMAIN"
    else
        PROTOCOL="http"
        TEST_URL="http://$DOMAIN"
    fi

    # 测试健康检查
    if curl -k -s $TEST_URL/health | grep -q "ok"; then
        log_info "✅ ${PROTOCOL^^}健康检查通过"
    else
        log_warn "⚠️ ${PROTOCOL^^}健康检查失败，请检查配置"
    fi

    # 测试API接口
    RESPONSE=$(curl -k -s -w "%{http_code}" $TEST_URL/api/xui/test \
        -X POST -H "Content-Type: application/json" \
        -d '{"url":"https://httpbin.org/get","username":"test","password":"test"}')

    HTTP_CODE="${RESPONSE: -3}"
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "500" ]; then
        log_info "✅ ${PROTOCOL^^} API接口可访问"
    else
        log_warn "⚠️ ${PROTOCOL^^} API接口测试失败 (HTTP $HTTP_CODE)"
    fi
}

# 显示结果
show_result() {
    log_step "配置完成！"

    SERVER_IP=$(hostname -I | awk '{print $1}')

    if [ "$USE_HTTPS" = true ]; then
        PROTOCOL="HTTPS"
        URL_PREFIX="https://$DOMAIN"
        BRIDGE_URL="https://$DOMAIN"
    else
        PROTOCOL="HTTP"
        URL_PREFIX="http://$DOMAIN"
        BRIDGE_URL="http://$DOMAIN"
    fi

    echo ""
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  Caddy Bridge 配置完成！${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    echo -e "${BLUE}访问地址:${NC}"
    echo -e "  $URL_PREFIX"
    echo ""
    echo -e "${BLUE}API接口:${NC}"
    echo -e "  健康检查: $URL_PREFIX/health"
    echo -e "  测试接口: $URL_PREFIX/api/xui/test"
    echo -e "  同步接口: $URL_PREFIX/api/xui/sync"
    echo ""
    echo -e "${BLUE}Sub-Store配置:${NC}"
    echo -e "  在wrangler.toml中修改:"
    echo -e "  XUI_BRIDGE_URL = \"$BRIDGE_URL\""
    echo ""
    echo -e "${BLUE}Caddy特性:${NC}"
    if [ "$USE_HTTPS" = true ]; then
        echo -e "  ✅ 自动HTTPS (Let's Encrypt)"
        echo -e "  ✅ 自动证书续期"
        echo -e "  ✅ HTTP/2 支持"
    fi
    echo -e "  ✅ 自动CORS配置"
    echo -e "  ✅ 零配置反向代理"
    echo ""
    echo -e "${BLUE}DNS配置:${NC}"
    if [ "$USE_HTTPS" = true ]; then
        echo -e "  请确保域名 $DOMAIN 解析到 $SERVER_IP"
        echo -e "  Caddy将自动获取Let's Encrypt证书"
    else
        echo -e "  HTTP模式，无需DNS配置"
    fi
    echo ""
    echo -e "${BLUE}管理命令:${NC}"
    echo -e "  查看状态: systemctl status caddy"
    echo -e "  查看日志: journalctl -u caddy -f"
    echo -e "  重启服务: systemctl restart caddy"
    echo -e "  验证配置: caddy validate --config /etc/caddy/Caddyfile"
}

# 主函数
main() {
    log_info "开始配置Caddy Bridge服务..."

    check_root
    get_domain_info
    install_caddy
    configure_caddy
    start_services
    test_service
    show_result

    log_info "Caddy Bridge配置完成！"
}

# 执行主函数
main "$@"
