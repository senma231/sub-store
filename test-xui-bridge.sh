#!/bin/bash

# X-UI Bridge 测试脚本

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 获取服务器IP
SERVER_IP=$(hostname -I | awk '{print $1}')
BRIDGE_URL="http://${SERVER_IP}:3002"

echo -e "${GREEN}X-UI Bridge 测试脚本${NC}"
echo "================================"
echo ""

# 测试健康检查
echo -e "${YELLOW}1. 测试健康检查...${NC}"
if curl -s "${BRIDGE_URL}/health" | grep -q "ok"; then
    echo -e "${GREEN}✓ 健康检查通过${NC}"
else
    echo -e "${RED}✗ 健康检查失败${NC}"
    exit 1
fi

echo ""

# 测试X-UI连接
echo -e "${YELLOW}2. 测试X-UI连接...${NC}"
echo "请输入X-UI面板信息："

read -p "X-UI面板地址 (例: http://8.211.175.95:65500/senma): " XUI_URL
read -p "用户名: " USERNAME
read -s -p "密码: " PASSWORD
echo ""

echo "正在测试连接..."

RESPONSE=$(curl -s -X POST "${BRIDGE_URL}/api/xui/test" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${XUI_URL}\",
    \"username\": \"${USERNAME}\",
    \"password\": \"${PASSWORD}\"
  }")

if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓ X-UI连接测试成功${NC}"
    echo "响应: $RESPONSE"
else
    echo -e "${RED}✗ X-UI连接测试失败${NC}"
    echo "响应: $RESPONSE"
fi

echo ""

# 显示服务状态
echo -e "${YELLOW}3. 检查服务状态...${NC}"
if systemctl is-active --quiet xui-bridge.service; then
    echo -e "${GREEN}✓ 系统服务运行正常${NC}"
    echo "服务状态: $(systemctl is-active xui-bridge.service)"
else
    echo -e "${RED}✗ 系统服务未运行${NC}"
    echo "请检查服务状态: systemctl status xui-bridge"
fi

echo ""
echo "================================"
echo -e "${GREEN}测试完成！${NC}"
echo ""
echo "桥接服务地址: ${BRIDGE_URL}"
echo "在Sub-Store中使用此地址作为bridgeUrl参数"
echo ""
echo -e "${BLUE}管理命令:${NC}"
echo "  查看状态: systemctl status xui-bridge"
echo "  查看日志: journalctl -u xui-bridge -f"
echo "  重启服务: systemctl restart xui-bridge"
