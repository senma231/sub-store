const express = require('express');
const axios = require('axios');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// X-UI API 客户端
class XUIApiClient {
  constructor(baseUrl, username, password) {
    this.baseUrl = baseUrl;
    this.username = username;
    this.password = password;
    this.sessionId = null;
  }

  async login() {
    try {
      console.log(`尝试登录X-UI: ${this.baseUrl}`);
      
      const response = await axios.post(`${this.baseUrl}/login`, 
        `username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`, 
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          maxRedirects: 0,
          validateStatus: (status) => status < 400 || status === 302,
          timeout: 10000
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

      this.sessionId = sessionMatch.split('session=')[1].split(';')[0];
      console.log('X-UI登录成功');
      
      return this.sessionId;
    } catch (error) {
      console.error('X-UI登录失败:', error.message);
      throw new Error(`登录失败: ${error.message}`);
    }
  }

  async getInbounds() {
    if (!this.sessionId) {
      await this.login();
    }

    try {
      console.log(`获取入站配置: ${this.baseUrl}/xui/inbound/list`);
      
      const response = await axios.post(`${this.baseUrl}/xui/inbound/list`, {}, {
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${this.sessionId}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 15000
      });

      console.log('获取入站配置成功');
      return response.data;
    } catch (error) {
      console.error('获取入站配置失败:', error.message);
      // 如果是认证错误，重新登录
      if (error.response && error.response.status === 401) {
        console.log('Session过期，重新登录...');
        this.sessionId = null;
        await this.login();
        return this.getInbounds();
      }
      throw new Error(`获取入站配置失败: ${error.message}`);
    }
  }
}

// 解析X-UI入站配置为节点
function parseXUIInbound(inbound) {
  const nodes = [];

  try {
    const settings = typeof inbound.settings === 'string'
      ? JSON.parse(inbound.settings)
      : inbound.settings;

    const streamSettings = typeof inbound.streamSettings === 'string'
      ? JSON.parse(inbound.streamSettings)
      : inbound.streamSettings;

    // 根据协议类型解析
    switch (inbound.protocol) {
      case 'vless':
        if (settings.clients && Array.isArray(settings.clients)) {
          settings.clients.forEach((client, index) => {
            const node = {
              id: `xui_${inbound.id}_${client.id}_${Date.now()}`,
              name: `${inbound.remark || 'VLESS'}-${client.email || index + 1}`,
              type: 'vless',
              server: '', // 需要从外部获取服务器地址
              port: inbound.port,
              enabled: inbound.enable,
              uuid: client.id,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              encryption: 'none',
              flow: client.flow || '',
              network: streamSettings?.network || 'tcp',
              security: streamSettings?.security || 'none',
              sni: streamSettings?.tlsSettings?.serverName || streamSettings?.realitySettings?.serverName,
              wsPath: streamSettings?.wsSettings?.path,
              grpcServiceName: streamSettings?.grpcSettings?.serviceName,
              remark: `从X-UI面板同步: ${inbound.remark || 'VLESS节点'}`,
              tags: ['xui-sync'],
              sourceType: 'xui',
              sourceNodeId: `${inbound.id}_${client.id}` // 使用入站ID和客户端ID组合作为唯一标识
            };
            nodes.push(node);
          });
        }
        break;

      case 'vmess':
        if (settings.clients && Array.isArray(settings.clients)) {
          settings.clients.forEach((client, index) => {
            const node = {
              id: `xui_${inbound.id}_${client.id}_${Date.now()}`,
              name: `${inbound.remark || 'VMess'}-${client.email || index + 1}`,
              type: 'vmess',
              server: '',
              port: inbound.port,
              enabled: inbound.enable,
              uuid: client.id,
              alterId: client.alterId || 0,
              encryption: client.security || 'auto',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              network: streamSettings?.network || 'tcp',
              security: streamSettings?.security || 'none',
              sni: streamSettings?.tlsSettings?.serverName,
              wsPath: streamSettings?.wsSettings?.path,
              grpcServiceName: streamSettings?.grpcSettings?.serviceName,
              remark: `从X-UI面板同步: ${inbound.remark || 'VMess节点'}`,
              tags: ['xui-sync'],
              sourceType: 'xui',
              sourceNodeId: `${inbound.id}_${client.id}`
            };
            nodes.push(node);
          });
        }
        break;

      case 'trojan':
        if (settings.clients && Array.isArray(settings.clients)) {
          settings.clients.forEach((client, index) => {
            const node = {
              id: `xui_${inbound.id}_${client.id || client.password}_${Date.now()}`,
              name: `${inbound.remark || 'Trojan'}-${client.email || index + 1}`,
              type: 'trojan',
              server: '',
              port: inbound.port,
              enabled: inbound.enable,
              password: client.password,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              network: streamSettings?.network || 'tcp',
              sni: streamSettings?.tlsSettings?.serverName,
              wsPath: streamSettings?.wsSettings?.path,
              grpcServiceName: streamSettings?.grpcSettings?.serviceName,
              remark: `从X-UI面板同步: ${inbound.remark || 'Trojan节点'}`,
              tags: ['xui-sync'],
              sourceType: 'xui',
              sourceNodeId: `${inbound.id}_${client.id || client.password}`
            };
            nodes.push(node);
          });
        }
        break;

      case 'shadowsocks':
        const node = {
          id: `xui_${inbound.id}_ss_${Date.now()}`,
          name: inbound.remark || 'Shadowsocks',
          type: 'ss',
          server: '',
          port: inbound.port,
          enabled: inbound.enable,
          method: settings.method || 'aes-256-gcm',
          password: settings.password,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          remark: `从X-UI面板同步: ${inbound.remark || 'Shadowsocks节点'}`,
          tags: ['xui-sync'],
          sourceType: 'xui',
          sourceNodeId: `${inbound.id}_ss`
        };
        nodes.push(node);
        break;
    }
  } catch (error) {
    console.error('解析入站配置失败:', error, inbound);
  }

  return nodes;
}

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'X-UI Bridge Server'
  });
});

// 测试X-UI连接
app.post('/api/xui/test', async (req, res) => {
  try {
    const { url, username, password } = req.body;

    if (!url || !username || !password) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: url, username, password'
      });
    }

    console.log(`测试X-UI连接: ${url}, 用户名: ${username}`);

    const client = new XUIApiClient(url, username, password);
    
    // 测试登录
    const sessionId = await client.login();
    
    // 测试获取入站配置
    const inbounds = await client.getInbounds();
    
    res.json({
      success: true,
      message: '连接测试成功',
      data: {
        sessionId: sessionId.substring(0, 10) + '...',
        inboundCount: inbounds?.obj?.length || 0,
        connected: true,
        latency: Date.now() // 简化的延迟
      }
    });

  } catch (error) {
    console.error('测试连接失败:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: {
        connected: false,
        error: error.message
      }
    });
  }
});

// 同步X-UI节点
app.post('/api/xui/sync', async (req, res) => {
  try {
    const { url, username, password } = req.body;

    if (!url || !username || !password) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数: url, username, password'
      });
    }

    console.log(`同步X-UI节点: ${url}`);

    const client = new XUIApiClient(url, username, password);
    
    // 获取入站配置
    const result = await client.getInbounds();
    
    if (!result.success) {
      throw new Error(result.msg || '获取入站配置失败');
    }

    const inbounds = result.obj || [];
    console.log(`获取到 ${inbounds.length} 个入站配置`);

    // 解析入站配置为节点
    const nodes = [];
    for (const inbound of inbounds) {
      const parsedNodes = parseXUIInbound(inbound);
      nodes.push(...parsedNodes);
    }

    console.log(`解析得到 ${nodes.length} 个节点`);

    res.json({
      success: true,
      message: `成功获取 ${inbounds.length} 个入站配置，解析得到 ${nodes.length} 个节点`,
      data: {
        nodes: nodes,
        inbounds: inbounds,
        nodeCount: nodes.length,
        inboundCount: inbounds.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('同步节点失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 错误处理中间件
app.use((error, req, res, next) => {
  console.error('服务器错误:', error);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`X-UI桥接服务启动成功，端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
});
