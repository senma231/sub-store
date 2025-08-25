#!/bin/bash

# X-UI Bridge 一键部署脚本
# 适用于 Debian 系统

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

# 检查系统版本
check_system() {
    log_step "检查系统版本..."
    
    if [[ -f /etc/debian_version ]]; then
        log_info "检测到 Debian 系统"
        DEBIAN_VERSION=$(cat /etc/debian_version)
        log_info "Debian 版本: $DEBIAN_VERSION"
    else
        log_error "此脚本仅支持 Debian 系统"
        exit 1
    fi
}

# 更新系统包
update_system() {
    log_step "更新系统包..."
    apt update -y
    apt upgrade -y
    log_info "系统包更新完成"
}

# 安装必要的依赖
install_dependencies() {
    log_step "安装必要的依赖..."
    apt install -y curl wget gnupg2 software-properties-common apt-transport-https ca-certificates lsb-release
    log_info "依赖安装完成"
}

# 安装 Node.js
install_nodejs() {
    log_step "安装 Node.js..."
    
    # 检查是否已安装 Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log_warn "Node.js 已安装，版本: $NODE_VERSION"
        
        # 检查版本是否满足要求 (需要 v16+)
        MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
        if [ "$MAJOR_VERSION" -ge 16 ]; then
            log_info "Node.js 版本满足要求，跳过安装"
            return
        else
            log_warn "Node.js 版本过低，将重新安装"
        fi
    fi
    
    # 添加 NodeSource 仓库
    log_info "添加 NodeSource 仓库..."
    curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
    
    # 安装 Node.js
    log_info "安装 Node.js LTS 版本..."
    apt install -y nodejs
    
    # 验证安装
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    log_info "Node.js 安装完成，版本: $NODE_VERSION"
    log_info "npm 版本: $NPM_VERSION"
}

# 创建系统服务
create_systemd_service() {
    log_step "创建systemd服务..."

    cat > /etc/systemd/system/xui-bridge.service << 'EOF'
[Unit]
Description=X-UI Bridge Service for Sub-Store
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/xui-bridge
ExecStart=/usr/bin/node xui-bridge.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3002

# 日志配置
StandardOutput=journal
StandardError=journal
SyslogIdentifier=xui-bridge

# 安全配置
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/xui-bridge

[Install]
WantedBy=multi-user.target
EOF

    log_info "systemd服务文件创建完成"
}

# 创建工作目录
create_work_directory() {
    log_step "创建工作目录..."
    
    WORK_DIR="/opt/xui-bridge"
    
    if [ -d "$WORK_DIR" ]; then
        log_warn "工作目录已存在，将清理旧文件"
        rm -rf "$WORK_DIR"
    fi
    
    mkdir -p "$WORK_DIR"
    cd "$WORK_DIR"
    log_info "工作目录创建完成: $WORK_DIR"
}

# 创建 package.json
create_package_json() {
    log_step "创建 package.json..."
    
    cat > package.json << 'EOF'
{
  "name": "xui-bridge",
  "version": "1.0.0",
  "description": "X-UI Bridge Service for Sub-Store",
  "main": "xui-bridge.js",
  "scripts": {
    "start": "node xui-bridge.js",
    "dev": "nodemon xui-bridge.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "axios": "^1.6.0",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "keywords": ["xui", "bridge", "proxy", "sub-store"],
  "author": "Sub-Store",
  "license": "MIT"
}
EOF
    
    log_info "package.json 创建完成"
}

# 创建 xui-bridge.js
create_bridge_service() {
    log_step "创建桥接服务文件..."
    
    cat > xui-bridge.js << 'EOF'
#!/usr/bin/env node

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;

// 中间件
app.use(cors());
app.use(express.json());

// X-UI桥接服务
class XUIBridge {
  constructor() {
    this.sessions = new Map(); // 存储session
  }

  // 登录X-UI面板
  async login(xuiUrl, username, password) {
    try {
      console.log('尝试登录X-UI: ' + xuiUrl);

      const postData = 'username=' + encodeURIComponent(username) + '&password=' + encodeURIComponent(password);

      const config = {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        maxRedirects: 0,
        validateStatus: function(status) {
          return status < 400 || status === 302;
        }
      };

      const response = await axios.post(xuiUrl + '/login', postData, config);

      // 提取session cookie
      const setCookie = response.headers['set-cookie'];
      if (!setCookie) {
        throw new Error('未获取到session cookie');
      }

      const sessionMatch = setCookie.find(cookie => cookie.includes('session='));
      if (!sessionMatch) {
        throw new Error('未找到session cookie');
      }

      const sessionId = sessionMatch.split('session=')[1].split(';')[0];
      console.log('登录成功，获取到session');
      
      return sessionId;
    } catch (error) {
      console.error('登录失败:', error.message);
      throw error;
    }
  }

  // 获取入站配置
  async getInbounds(xuiUrl, sessionId) {
    try {
      console.log('获取入站配置: ' + xuiUrl + '/xui/inbound/list');

      const config = {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'session=' + sessionId,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      const response = await axios.post(xuiUrl + '/xui/inbound/list', {}, config);

      console.log('获取入站配置成功');
      return response.data;
    } catch (error) {
      console.error('获取入站配置失败:', error.message);
      throw error;
    }
  }
}

const bridge = new XUIBridge();

// API路由
app.post('/api/xui/test', async (req, res) => {
  try {
    const { url, username, password } = req.body;
    
    if (!url || !username || !password) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    console.log(`收到测试请求: ${url}`);

    // 登录
    const sessionId = await bridge.login(url, username, password);
    
    // 获取入站配置
    const inbounds = await bridge.getInbounds(url, sessionId);
    
    res.json({
      success: true,
      message: '连接测试成功',
      data: {
        sessionId: sessionId.substring(0, 10) + '...',
        inboundCount: Array.isArray(inbounds) ? inbounds.length : (inbounds.obj ? inbounds.obj.length : 0),
        sampleInbound: Array.isArray(inbounds) ? inbounds[0] : (inbounds.obj ? inbounds.obj[0] : null)
      }
    });

  } catch (error) {
    console.error('测试失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 同步节点
app.post('/api/xui/sync', async (req, res) => {
  try {
    const { url, username, password } = req.body;
    
    if (!url || !username || !password) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    console.log(`收到同步请求: ${url}`);

    // 登录
    const sessionId = await bridge.login(url, username, password);
    
    // 获取入站配置
    const inbounds = await bridge.getInbounds(url, sessionId);
    
    // 解析入站配置为节点
    const nodes = [];
    const inboundList = Array.isArray(inbounds) ? inbounds : (inbounds.obj || []);
    
    for (const inbound of inboundList) {
      if (inbound.enable && inbound.settings) {
        try {
          const settings = typeof inbound.settings === 'string' 
            ? JSON.parse(inbound.settings) 
            : inbound.settings;
          
          if (settings.clients) {
            for (const client of settings.clients) {
              nodes.push({
                id: `${inbound.id}_${client.id}`,
                name: client.email || `${inbound.protocol}_${inbound.port}`,
                type: inbound.protocol,
                server: url.replace(/^https?:\/\//, '').split(':')[0],
                port: inbound.port,
                uuid: client.id,
                enabled: client.enable !== false,
                settings: {
                  protocol: inbound.protocol,
                  port: inbound.port,
                  ...client
                }
              });
            }
          }
        } catch (parseError) {
          console.error('解析入站配置失败:', parseError);
        }
      }
    }

    res.json({
      success: true,
      message: `成功同步 ${nodes.length} 个节点`,
      data: {
        nodes,
        totalInbounds: inboundList.length,
        totalNodes: nodes.length
      }
    });

  } catch (error) {
    console.error('同步失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'X-UI Bridge',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`X-UI桥接服务运行在端口 ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`测试接口: POST http://localhost:${PORT}/api/xui/test`);
  console.log(`同步接口: POST http://localhost:${PORT}/api/xui/sync`);
});
EOF
    
    chmod +x xui-bridge.js
    log_info "桥接服务文件创建完成"
}

# 安装 npm 依赖
install_npm_dependencies() {
    log_step "安装 npm 依赖..."
    npm install
    log_info "npm 依赖安装完成"
}

# 启动服务
start_service() {
    log_step "启动桥接服务..."

    # 重新加载systemd配置
    systemctl daemon-reload

    # 启用服务（开机自启）
    systemctl enable xui-bridge.service

    # 启动服务
    systemctl start xui-bridge.service

    # 等待服务启动
    sleep 3

    # 检查服务状态
    if systemctl is-active --quiet xui-bridge.service; then
        log_info "桥接服务启动成功"
    else
        log_error "桥接服务启动失败"
        systemctl status xui-bridge.service
        exit 1
    fi
}

# 测试服务
test_service() {
    log_step "测试桥接服务..."
    
    sleep 3
    
    # 测试健康检查
    if curl -s http://localhost:3002/health > /dev/null; then
        log_info "桥接服务运行正常"
        log_info "健康检查地址: http://$(hostname -I | awk '{print $1}'):3002/health"
        log_info "测试接口地址: http://$(hostname -I | awk '{print $1}'):3002/api/xui/test"
    else
        log_error "桥接服务启动失败"
        pm2 logs xui-bridge --lines 20
        exit 1
    fi
}

# 显示使用说明
show_usage() {
    log_step "安装完成！"
    
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  X-UI Bridge 安装完成！${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    echo -e "${BLUE}服务信息:${NC}"
    echo -e "  服务名称: xui-bridge"
    echo -e "  运行端口: 3002"
    echo -e "  工作目录: /opt/xui-bridge"
    echo ""
    echo -e "${BLUE}访问地址:${NC}"
    echo -e "  健康检查: http://${SERVER_IP}:3002/health"
    echo -e "  测试接口: http://${SERVER_IP}:3002/api/xui/test"
    echo -e "  同步接口: http://${SERVER_IP}:3002/api/xui/sync"
    echo ""
    echo -e "${BLUE}管理命令:${NC}"
    echo -e "  查看状态: systemctl status xui-bridge"
    echo -e "  查看日志: journalctl -u xui-bridge -f"
    echo -e "  重启服务: systemctl restart xui-bridge"
    echo -e "  停止服务: systemctl stop xui-bridge"
    echo -e "  启动服务: systemctl start xui-bridge"
    echo -e "  禁用服务: systemctl disable xui-bridge"
    echo ""
    echo -e "${BLUE}测试命令:${NC}"
    echo -e "  curl http://localhost:3002/health"
    echo ""
    echo -e "${YELLOW}注意: 请确保端口 3002 可以被外部访问${NC}"
}

# 主函数
main() {
    log_info "开始安装 X-UI Bridge 桥接服务..."
    
    check_root
    check_system
    update_system
    install_dependencies
    install_nodejs
    create_systemd_service
    create_work_directory
    create_package_json
    create_bridge_service
    install_npm_dependencies
    start_service
    test_service
    show_usage
    
    log_info "安装完成！"
}

# 执行主函数
main "$@"
