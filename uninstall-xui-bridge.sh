#!/bin/bash

# X-UI Bridge 卸载脚本

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

# 检查是否为root用户
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "此脚本需要root权限运行"
        log_info "请使用: sudo $0"
        exit 1
    fi
}

# 停止并删除服务
remove_service() {
    log_step "停止并删除系统服务..."
    
    if systemctl is-active --quiet xui-bridge.service 2>/dev/null; then
        log_info "停止xui-bridge服务..."
        systemctl stop xui-bridge.service
    fi
    
    if systemctl is-enabled --quiet xui-bridge.service 2>/dev/null; then
        log_info "禁用xui-bridge服务..."
        systemctl disable xui-bridge.service
    fi
    
    if [ -f "/etc/systemd/system/xui-bridge.service" ]; then
        log_info "删除服务文件..."
        rm -f /etc/systemd/system/xui-bridge.service
        systemctl daemon-reload
    fi
    
    log_info "系统服务清理完成"
}

# 删除工作目录
remove_work_directory() {
    log_step "删除工作目录..."
    
    WORK_DIR="/opt/xui-bridge"
    
    if [ -d "$WORK_DIR" ]; then
        log_info "删除工作目录: $WORK_DIR"
        rm -rf "$WORK_DIR"
    else
        log_warn "工作目录不存在，跳过"
    fi
}

# 询问是否删除Node.js
ask_remove_nodejs() {
    log_step "检查Node.js..."
    
    if command -v node &> /dev/null; then
        echo ""
        log_warn "检测到系统中安装了Node.js"
        echo -e "${YELLOW}是否要删除Node.js? (y/N):${NC} \c"
        read -r response
        
        if [[ "$response" =~ ^[Yy]$ ]]; then
            log_info "删除Node.js..."
            apt remove -y nodejs npm
            apt autoremove -y
            
            # 删除NodeSource仓库
            if [ -f "/etc/apt/sources.list.d/nodesource.list" ]; then
                rm -f /etc/apt/sources.list.d/nodesource.list
            fi
            
            log_info "Node.js删除完成"
        else
            log_info "保留Node.js"
        fi
    else
        log_info "系统中未安装Node.js"
    fi
}

# 显示卸载完成信息
show_completion() {
    log_step "卸载完成！"
    
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  X-UI Bridge 卸载完成！${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    echo -e "${BLUE}已删除的内容:${NC}"
    echo -e "  ✓ systemd服务文件"
    echo -e "  ✓ 工作目录 /opt/xui-bridge"
    echo -e "  ✓ 所有相关配置文件"
    echo ""
    echo -e "${YELLOW}注意: Node.js根据您的选择可能已保留或删除${NC}"
}

# 主函数
main() {
    log_info "开始卸载 X-UI Bridge 桥接服务..."
    
    check_root
    remove_service
    remove_work_directory
    ask_remove_nodejs
    show_completion
    
    log_info "卸载完成！"
}

# 执行主函数
main "$@"
