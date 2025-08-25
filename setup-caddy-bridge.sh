#!/bin/bash

# 超简单的Caddy X-UI Bridge HTTPS配置脚本
# 一键配置，自动HTTPS！

set -e

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_step() { echo -e "${BLUE}[STEP]${NC} $1"; }

# 检查root权限
if [[ $EUID -ne 0 ]]; then
    echo "需要root权限，请使用: sudo $0"
    exit 1
fi

# 获取域名
log_step "请输入您的域名"
echo "例如: bridge.yourdomain.com"
echo "如果没有域名，可以使用免费服务："
echo "- freenom.com (免费.tk/.ml域名)"
echo "- duckdns.org (免费子域名)"
echo "- noip.com (免费动态DNS)"
echo ""
read -p "请输入域名: " DOMAIN

if [ -z "$DOMAIN" ]; then
    echo "域名不能为空"
    exit 1
fi

log_info "域名: $DOMAIN"

# 安装Caddy
log_step "安装Caddy..."
apt update
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl

# 添加Caddy仓库
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list

apt update
apt install -y caddy

# 创建超简单的Caddy配置
log_step "配置Caddy..."
cat > /etc/caddy/Caddyfile << EOF
# X-UI Bridge 自动HTTPS配置
$DOMAIN {
    reverse_proxy localhost:3002
    
    header {
        Access-Control-Allow-Origin *
        Access-Control-Allow-Methods "GET, POST, OPTIONS"
        Access-Control-Allow-Headers "Content-Type, Authorization"
    }
    
    @options method OPTIONS
    respond @options 204
}
EOF

# 验证配置
caddy validate --config /etc/caddy/Caddyfile

# 启动服务
log_step "启动服务..."
systemctl enable xui-bridge
systemctl start xui-bridge
systemctl enable caddy
systemctl start caddy

# 等待启动
sleep 5

# 测试
log_step "测试服务..."
if curl -s https://$DOMAIN/health | grep -q "ok"; then
    log_info "✅ HTTPS服务正常"
else
    log_warn "⚠️ 服务可能还在启动中，请稍后测试"
fi

# 显示结果
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}🎉 Caddy Bridge 配置完成！${NC}"
echo ""
echo -e "${BLUE}访问地址:${NC} https://$DOMAIN"
echo -e "${BLUE}健康检查:${NC} https://$DOMAIN/health"
echo -e "${BLUE}测试接口:${NC} https://$DOMAIN/api/xui/test"
echo -e "${BLUE}同步接口:${NC} https://$DOMAIN/api/xui/sync"
echo ""
echo -e "${BLUE}Sub-Store配置:${NC}"
echo "在 workers/wrangler.toml 中修改:"
echo "XUI_BRIDGE_URL = \"https://$DOMAIN\""
echo ""
echo -e "${BLUE}DNS配置:${NC}"
echo "请确保域名 $DOMAIN 解析到 $SERVER_IP"
echo ""
echo -e "${BLUE}Caddy特性:${NC}"
echo "✅ 自动获取Let's Encrypt证书"
echo "✅ 自动证书续期 (无需维护)"
echo "✅ HTTP/2 和 HTTP/3 支持"
echo "✅ 自动CORS配置"
echo ""
echo -e "${BLUE}管理命令:${NC}"
echo "查看状态: systemctl status caddy"
echo "查看日志: journalctl -u caddy -f"
echo "重启服务: systemctl restart caddy"
echo ""
echo -e "${GREEN}现在可以在Sub-Store中使用 https://$DOMAIN 作为Bridge地址！${NC}"
