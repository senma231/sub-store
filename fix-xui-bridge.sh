#!/bin/bash

# X-UI Bridge 修复脚本

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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查是否为root用户
check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}[ERROR]${NC} 此脚本需要root权限运行"
        echo -e "${GREEN}[INFO]${NC} 请使用: sudo $0"
        exit 1
    fi
}

# 停止服务
stop_service() {
    log_step "停止桥接服务..."
    systemctl stop xui-bridge.service || true
    log_info "服务已停止"
}

# 更新桥接服务代码
update_bridge_service() {
    log_step "更新桥接服务代码..."
    
    cd /opt/xui-bridge
    
    # 备份原文件
    cp xui-bridge.js xui-bridge.js.backup
    
    # 创建新的桥接服务文件
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

      const sessionMatch = setCookie.find(function(cookie) {
        return cookie.includes('session=');
      });
      
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
app.post('/api/xui/test', async function(req, res) {
  try {
    const url = req.body.url;
    const username = req.body.username;
    const password = req.body.password;
    
    if (!url || !username || !password) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    console.log('收到测试请求: ' + url);

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
app.post('/api/xui/sync', async function(req, res) {
  try {
    const url = req.body.url;
    const username = req.body.username;
    const password = req.body.password;
    
    if (!url || !username || !password) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    console.log('收到同步请求: ' + url);

    // 登录
    const sessionId = await bridge.login(url, username, password);
    
    // 获取入站配置
    const inbounds = await bridge.getInbounds(url, sessionId);
    
    // 解析入站配置为节点
    const nodes = [];
    const inboundList = Array.isArray(inbounds) ? inbounds : (inbounds.obj || []);
    
    for (let i = 0; i < inboundList.length; i++) {
      const inbound = inboundList[i];
      if (inbound.enable && inbound.settings) {
        try {
          const settings = typeof inbound.settings === 'string' 
            ? JSON.parse(inbound.settings) 
            : inbound.settings;
          
          if (settings.clients) {
            for (let j = 0; j < settings.clients.length; j++) {
              const client = settings.clients[j];
              nodes.push({
                id: inbound.id + '_' + client.id,
                name: client.email || (inbound.protocol + '_' + inbound.port),
                type: inbound.protocol,
                server: url.replace(/^https?:\/\//, '').split(':')[0],
                port: inbound.port,
                uuid: client.id,
                enabled: client.enable !== false,
                settings: {
                  protocol: inbound.protocol,
                  port: inbound.port
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
      message: '成功同步 ' + nodes.length + ' 个节点',
      data: {
        nodes: nodes,
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
app.get('/health', function(req, res) {
  res.json({
    status: 'ok',
    service: 'X-UI Bridge',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, function() {
  console.log('X-UI桥接服务运行在端口 ' + PORT);
  console.log('健康检查: http://localhost:' + PORT + '/health');
  console.log('测试接口: POST http://localhost:' + PORT + '/api/xui/test');
  console.log('同步接口: POST http://localhost:' + PORT + '/api/xui/sync');
});
EOF
    
    chmod +x xui-bridge.js
    log_info "桥接服务代码更新完成"
}

# 启动服务
start_service() {
    log_step "启动桥接服务..."
    systemctl start xui-bridge.service
    sleep 3
    
    if systemctl is-active --quiet xui-bridge.service; then
        log_info "桥接服务启动成功"
    else
        echo -e "${RED}[ERROR]${NC} 桥接服务启动失败"
        systemctl status xui-bridge.service
        exit 1
    fi
}

# 测试服务
test_service() {
    log_step "测试桥接服务..."
    
    if curl -s http://localhost:3002/health > /dev/null; then
        log_info "桥接服务运行正常"
    else
        echo -e "${RED}[ERROR]${NC} 桥接服务测试失败"
        exit 1
    fi
}

# 主函数
main() {
    log_info "开始修复 X-UI Bridge 桥接服务..."
    
    check_root
    stop_service
    update_bridge_service
    start_service
    test_service
    
    log_info "修复完成！"
    echo -e "${GREEN}桥接服务已更新并重新启动${NC}"
}

# 执行主函数
main "$@"
