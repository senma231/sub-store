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

    res.json({
      success: true,
      message: `成功获取 ${inbounds.length} 个入站配置`,
      data: {
        inbounds: inbounds,
        count: inbounds.length,
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
