#!/bin/bash

# X-UI Bridge 更新脚本
# 用于修复和更新VPS上的X-UI Bridge服务

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

# 停止现有服务
stop_existing_service() {
    log_step "停止现有的X-UI Bridge服务..."
    
    if systemctl is-active --quiet xui-bridge.service; then
        systemctl stop xui-bridge.service
        log_info "已停止xui-bridge服务"
    else
        log_warn "xui-bridge服务未运行"
    fi
}

# 备份现有配置
backup_existing_config() {
    log_step "备份现有配置..."
    
    WORK_DIR="/opt/xui-bridge"
    BACKUP_DIR="/opt/xui-bridge-backup-$(date +%Y%m%d_%H%M%S)"
    
    if [ -d "$WORK_DIR" ]; then
        cp -r "$WORK_DIR" "$BACKUP_DIR"
        log_info "已备份到: $BACKUP_DIR"
    else
        log_warn "未找到现有配置目录"
    fi
}

# 更新Bridge服务代码
update_bridge_service() {
    log_step "更新Bridge服务代码..."
    
    WORK_DIR="/opt/xui-bridge"
    cd "$WORK_DIR"
    
    # 创建更新后的xui-bridge.js
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
      console.log(`尝试登录X-UI: ${xuiUrl}`);
      
      const response = await axios.post(`${xuiUrl}/login`, 
        `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, 
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          maxRedirects: 0,
          validateStatus: (status) => status < 400 || status === 302
        }
      );

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
      console.log(`获取入站配置: ${xuiUrl}/xui/inbound/list`);
      
      const response = await axios.post(`${xuiUrl}/xui/inbound/list`, {}, {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${sessionId}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      console.log('获取入站配置成功');
      return response.data;
    } catch (error) {
      console.error('获取入站配置失败:', error.message);
      throw error;
    }
  }

  // 解析入站配置为节点
  parseInboundToNodes(inbound, serverHost) {
    const nodes = [];
    
    try {
      const settings = typeof inbound.settings === 'string' 
        ? JSON.parse(inbound.settings) 
        : inbound.settings;
      
      if (!settings || !settings.clients) {
        return nodes;
      }

      settings.clients.forEach((client, index) => {
        const node = {
          id: `${inbound.id}_${client.id || client.password || index}`,
          name: client.email || `${inbound.protocol}_${inbound.port}_${index + 1}`,
          type: inbound.protocol,
          server: serverHost,
          port: inbound.port,
          enabled: client.enable !== false && inbound.enable,
          settings: {
            protocol: inbound.protocol,
            port: inbound.port,
            ...client
          }
        };

        // 根据协议添加特定字段
        switch (inbound.protocol) {
          case 'vless':
          case 'vmess':
            node.uuid = client.id;
            if (client.security) node.encryption = client.security;
            if (client.alterId !== undefined) node.alterId = client.alterId;
            break;
          case 'trojan':
            node.password = client.password;
            break;
          case 'shadowsocks':
            node.method = settings.method || 'aes-256-gcm';
            node.password = settings.password;
            break;
        }

        nodes.push(node);
      });
    } catch (parseError) {
      console.error('解析入站配置失败:', parseError);
    }

    return nodes;
  }
}

const bridge = new XUIBridge();

// API路由 - 测试连接
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

// API路由 - 同步节点
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
    
    // 从URL提取服务器地址
    const serverHost = url.replace(/^https?:\/\//, '').split(':')[0];
    
    for (const inbound of inboundList) {
      if (inbound.enable) {
        const parsedNodes = bridge.parseInboundToNodes(inbound, serverHost);
        nodes.push(...parsedNodes);
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
    timestamp: new Date().toISOString(),
    version: '2.0.0'
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
    log_info "Bridge服务代码更新完成"
}

# 重启服务
restart_service() {
    log_step "重启Bridge服务..."

    # 重新加载systemd配置
    systemctl daemon-reload

    # 启动服务
    systemctl start xui-bridge.service

    # 等待服务启动
    sleep 3

    # 检查服务状态
    if systemctl is-active --quiet xui-bridge.service; then
        log_info "Bridge服务重启成功"
    else
        log_error "Bridge服务重启失败"
        systemctl status xui-bridge.service
        exit 1
    fi
}

# 测试更新后的服务
test_updated_service() {
    log_step "测试更新后的服务..."
    
    sleep 3
    
    # 测试健康检查
    if curl -s http://localhost:3002/health > /dev/null; then
        log_info "健康检查通过"
    else
        log_error "健康检查失败"
        exit 1
    fi
    
    # 测试同步接口
    SYNC_RESPONSE=$(curl -s -X POST http://localhost:3002/api/xui/sync \
        -H "Content-Type: application/json" \
        -d '{"url":"https://test.com","username":"test","password":"test"}' \
        -w "%{http_code}")
    
    if [[ $SYNC_RESPONSE == *"200"* ]] || [[ $SYNC_RESPONSE == *"500"* ]]; then
        log_info "同步接口可访问"
    else
        log_error "同步接口测试失败"
        exit 1
    fi
}

# 显示更新结果
show_update_result() {
    log_step "更新完成！"
    
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    echo -e "${GREEN}================================${NC}"
    echo -e "${GREEN}  X-UI Bridge 更新完成！${NC}"
    echo -e "${GREEN}================================${NC}"
    echo ""
    echo -e "${BLUE}更新内容:${NC}"
    echo -e "  ✅ 添加了 /api/xui/sync 接口"
    echo -e "  ✅ 改进了节点解析逻辑"
    echo -e "  ✅ 增强了错误处理"
    echo -e "  ✅ 更新了健康检查信息"
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
    echo ""
    echo -e "${YELLOW}注意: 请在Sub-Store前端测试X-UI面板同步功能${NC}"
}

# 主函数
main() {
    log_info "开始更新X-UI Bridge服务..."
    
    check_root
    stop_existing_service
    backup_existing_config
    update_bridge_service
    restart_service
    test_updated_service
    show_update_result
    
    log_info "更新完成！"
}

# 执行主函数
main "$@"
