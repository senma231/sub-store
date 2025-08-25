#!/bin/bash

# X-UI桥接服务部署脚本
echo "开始部署X-UI桥接服务..."

# 创建应用目录
mkdir -p /opt/xui-bridge
cd /opt/xui-bridge

# 创建日志目录
mkdir -p logs

# 安装Node.js (如果未安装)
if ! command -v node &> /dev/null; then
    echo "安装Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    apt-get install -y nodejs
fi

# 安装PM2 (如果未安装)
if ! command -v pm2 &> /dev/null; then
    echo "安装PM2..."
    npm install -g pm2
fi

# 安装依赖
echo "安装依赖..."
npm install

# 停止旧服务
pm2 stop xui-bridge 2>/dev/null || true
pm2 delete xui-bridge 2>/dev/null || true

# 启动服务
echo "启动桥接服务..."
pm2 start ecosystem.config.js

# 保存PM2配置
pm2 save

# 设置开机自启
pm2 startup

echo "桥接服务部署完成！"
echo "服务状态: pm2 status"
echo "查看日志: pm2 logs xui-bridge"
echo "健康检查: curl http://localhost:3000/health"
