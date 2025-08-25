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
