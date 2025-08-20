import { Hono } from 'hono';
import { XUIPanelRepository } from '../repositories/xuiPanelRepository';
import { NodeRepository } from '../repositories/nodeRepository';
import { XUIPanel, Node, ProxyType } from '../../../shared/types';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  ADMIN_TOKEN: string;
  JWT_SECRET: string;
};

const xuiPanels = new Hono<{ Bindings: Bindings }>();

// 启用认证中间件
xuiPanels.use('*', authMiddleware);

// 获取所有X-UI面板
xuiPanels.get('/', async (c) => {
  try {
    console.log('开始获取X-UI面板列表...');

    // 获取查询参数
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);

    const repository = new XUIPanelRepository(c.env.DB);
    const result = await repository.findAll();

    if (!result.success) {
      console.error('获取X-UI面板失败:', result.error);
      return c.json({
        success: false,
        error: result.error
      }, 500);
    }

    const panels = result.data || [];

    // 计算分页
    const total = panels.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedPanels = panels.slice(offset, offset + limit);

    console.log('返回X-UI面板数据，总数:', total, '当前页:', paginatedPanels.length);

    // 返回标准分页格式
    return c.json({
      success: true,
      data: {
        items: paginatedPanels,
        total: total,
        page: page,
        limit: limit,
        totalPages: totalPages
      }
    });
  } catch (error) {
    console.error('获取X-UI面板列表失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 根据ID获取X-UI面板
xuiPanels.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const repository = new XUIPanelRepository(c.env.DB);
    const result = await repository.findById(id);

    if (!result.success) {
      return c.json({ 
        success: false, 
        error: result.error 
      }, 500);
    }

    if (!result.data) {
      return c.json({ 
        success: false, 
        error: 'X-UI面板不存在' 
      }, 404);
    }

    return c.json({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('获取X-UI面板失败:', error);
    return c.json({ 
      success: false, 
      error: '服务器内部错误' 
    }, 500);
  }
});

// 创建X-UI面板
xuiPanels.post('/', async (c) => {
  try {
    const body = await c.req.json();
    console.log('创建X-UI面板请求数据:', body);

    // 支持两种字段格式：新格式(host/port/protocol)和旧格式(url)
    let url: string;

    if (body.host && body.port && body.protocol) {
      // 新格式：从host、port、protocol构建URL
      const basePath = body.basePath ? `/${body.basePath}` : '';
      url = `${body.protocol}://${body.host}:${body.port}${basePath}`;
    } else if (body.url) {
      // 旧格式：直接使用URL
      url = body.url;
    } else {
      return c.json({
        success: false,
        error: '缺少必需字段: (host, port, protocol) 或 url'
      }, 400);
    }

    // 验证其他必需字段
    if (!body.name || !body.username || !body.password) {
      return c.json({
        success: false,
        error: '缺少必需字段: name, username, password'
      }, 400);
    }

    // 验证URL格式
    try {
      new URL(url);
    } catch {
      return c.json({
        success: false,
        error: 'URL格式无效'
      }, 400);
    }

    console.log('构建的URL:', url);

    const panelData: Omit<XUIPanel, 'id' | 'createdAt' | 'updatedAt'> = {
      name: body.name,
      url: url,
      username: body.username,
      password: body.password,
      enabled: body.enabled !== false, // 默认启用
      remark: body.remark,
      tags: body.tags,
      timeout: body.timeout || 30,
      retryCount: body.retryCount || 3,
      totalNodes: 0,
      status: 'offline'
    };

    const repository = new XUIPanelRepository(c.env.DB);
    const result = await repository.create(panelData);

    if (!result.success) {
      return c.json({ 
        success: false, 
        error: result.error 
      }, 500);
    }

    return c.json({
      success: true,
      data: result.data,
      message: 'X-UI面板创建成功'
    }, 201);
  } catch (error) {
    console.error('创建X-UI面板失败:', error);
    return c.json({ 
      success: false, 
      error: '服务器内部错误' 
    }, 500);
  }
});

// 更新X-UI面板
xuiPanels.put('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();

    // 验证URL格式（如果提供）
    if (body.url) {
      try {
        new URL(body.url);
      } catch {
        return c.json({
          success: false,
          error: 'URL格式无效'
        }, 400);
      }
    }

    const repository = new XUIPanelRepository(c.env.DB);
    const result = await repository.update(id, body);

    if (!result.success) {
      return c.json({ 
        success: false, 
        error: result.error 
      }, 500);
    }

    if (!result.data) {
      return c.json({ 
        success: false, 
        error: 'X-UI面板不存在' 
      }, 404);
    }

    return c.json({
      success: true,
      data: result.data,
      message: 'X-UI面板更新成功'
    });
  } catch (error) {
    console.error('更新X-UI面板失败:', error);
    return c.json({ 
      success: false, 
      error: '服务器内部错误' 
    }, 500);
  }
});

// 删除X-UI面板
xuiPanels.delete('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const repository = new XUIPanelRepository(c.env.DB);
    const result = await repository.delete(id);

    if (!result.success) {
      return c.json({ 
        success: false, 
        error: result.error 
      }, 500);
    }

    return c.json({
      success: true,
      message: 'X-UI面板删除成功'
    });
  } catch (error) {
    console.error('删除X-UI面板失败:', error);
    return c.json({ 
      success: false, 
      error: '服务器内部错误' 
    }, 500);
  }
});

// 批量操作X-UI面板
xuiPanels.post('/batch', async (c) => {
  try {
    const body = await c.req.json();
    const { action, ids, data } = body;

    if (!action || !ids || !Array.isArray(ids)) {
      return c.json({
        success: false,
        error: '缺少必需字段: action, ids'
      }, 400);
    }

    const repository = new XUIPanelRepository(c.env.DB);

    switch (action) {
      case 'enable':
        const enableResult = await repository.batchUpdate(ids, { enabled: true });
        if (!enableResult.success) {
          return c.json({ success: false, error: enableResult.error }, 500);
        }
        return c.json({
          success: true,
          message: `成功启用 ${enableResult.data} 个X-UI面板`
        });

      case 'disable':
        const disableResult = await repository.batchUpdate(ids, { enabled: false });
        if (!disableResult.success) {
          return c.json({ success: false, error: disableResult.error }, 500);
        }
        return c.json({
          success: true,
          message: `成功禁用 ${disableResult.data} 个X-UI面板`
        });

      case 'delete':
        let deletedCount = 0;
        for (const id of ids) {
          const deleteResult = await repository.delete(id);
          if (deleteResult.success) {
            deletedCount++;
          }
        }
        return c.json({
          success: true,
          message: `成功删除 ${deletedCount} 个X-UI面板`
        });

      default:
        return c.json({
          success: false,
          error: '不支持的操作类型'
        }, 400);
    }
  } catch (error) {
    console.error('批量操作X-UI面板失败:', error);
    return c.json({ 
      success: false, 
      error: '服务器内部错误' 
    }, 500);
  }
});

// 测试X-UI面板连接
xuiPanels.post('/:id/test', async (c) => {
  try {
    const id = c.req.param('id');
    const repository = new XUIPanelRepository(c.env.DB);
    
    // 获取面板信息
    const panelResult = await repository.findById(id);
    if (!panelResult.success || !panelResult.data) {
      return c.json({
        success: false,
        error: 'X-UI面板不存在'
      }, 404);
    }

    const panel = panelResult.data;
    
    try {
      // 测试连接（这里是模拟，实际需要调用X-UI API）
      const testUrl = `${panel.url}/login`;
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Sub-Store/2.0.0'
        },
        signal: AbortSignal.timeout(panel.timeout! * 1000)
      });

      const isOnline = response.ok;
      const status = isOnline ? 'online' : 'error';

      // 更新面板状态
      await repository.update(id, { 
        status,
        lastSync: new Date().toISOString()
      });

      return c.json({
        success: true,
        data: {
          status,
          statusCode: response.status,
          responseTime: Date.now() // 简化的响应时间
        },
        message: isOnline ? '连接测试成功' : '连接测试失败'
      });
    } catch (error) {
      // 更新为错误状态
      await repository.update(id, { 
        status: 'error',
        lastSync: new Date().toISOString()
      });

      return c.json({
        success: false,
        error: `连接测试失败: ${error instanceof Error ? error.message : String(error)}`,
        data: {
          status: 'error',
          error: error instanceof Error ? error.message : String(error)
        }
      });
    }
  } catch (error) {
    console.error('测试X-UI面板连接失败:', error);
    return c.json({ 
      success: false, 
      error: '服务器内部错误' 
    }, 500);
  }
});

// X-UI API 客户端
class XUIApiClient {
  constructor(private baseUrl: string, private username: string, private password: string) {}

  async login(): Promise<string> {
    try {
      // 尝试不同的登录路径
      const loginPaths = ['/login', '/api/login', '/xui/login'];
      let loginUrl = `${this.baseUrl}/login`;

      // 如果baseUrl已经包含路径，直接使用
      if (this.baseUrl.includes('/xraes') || this.baseUrl.includes('/xui')) {
        loginUrl = `${this.baseUrl}/login`;
      }

      console.log(`尝试登录: ${loginUrl}`);
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Sub-Store/2.0.0'
        },
        body: `username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`
      });

      console.log(`登录响应状态: ${response.status}`);
      console.log(`登录响应头:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const responseText = await response.text();
        console.log('登录失败响应:', responseText);
        throw new Error(`登录失败: HTTP ${response.status} - ${responseText}`);
      }

      const responseText = await response.text();
      console.log('登录响应内容:', responseText);

      // 从响应头获取session cookie
      const setCookieHeader = response.headers.get('set-cookie');
      console.log('Set-Cookie头:', setCookieHeader);

      if (!setCookieHeader) {
        throw new Error('未获取到登录凭据');
      }

      // 提取session ID
      const sessionMatch = setCookieHeader.match(/session=([^;]+)/);
      if (!sessionMatch) {
        throw new Error('未找到有效的session');
      }

      return sessionMatch[1];
    } catch (error) {
      console.error('登录过程出错:', error);
      throw error;
    }
  }

  async getInbounds(sessionId: string): Promise<any[]> {
    try {
      // 尝试不同的API路径
      const apiPaths = [
        '/panel/api/inbounds/list',
        '/api/inbounds/list',
        '/xui/api/inbounds/list',
        '/panel/inbound/list'
      ];

      let apiUrl = `${this.baseUrl}/panel/api/inbounds/list`;

      console.log(`尝试获取入站配置: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': `session=${sessionId}`
        }
      });

      console.log(`入站配置响应状态: ${response.status}`);

      if (!response.ok) {
        const responseText = await response.text();
        console.log('获取入站配置失败响应:', responseText);
        throw new Error(`获取入站配置失败: HTTP ${response.status} - ${responseText}`);
      }

      const data = await response.json();
      console.log('入站配置响应数据:', data);

      if (!data.success) {
        throw new Error(`API返回错误: ${data.msg || '未知错误'}`);
      }

      return data.obj || [];
    } catch (error) {
      console.error('获取入站配置出错:', error);
      throw error;
    }
  }
}

// 解析X-UI入站配置为节点
function parseXUIInbound(inbound: any): Node[] {
  const nodes: Node[] = [];

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
          settings.clients.forEach((client: any, index: number) => {
            const node: Node = {
              name: `${inbound.remark || 'VLESS'}-${client.email || index + 1}`,
              type: 'vless' as ProxyType,
              server: '', // 需要从外部获取服务器地址
              port: inbound.port,
              enabled: inbound.enable,
              uuid: client.id,
              encryption: 'none',
              flow: client.flow || '',
              network: streamSettings?.network || 'tcp',
              security: streamSettings?.security || 'none',
              sni: streamSettings?.tlsSettings?.serverName || streamSettings?.realitySettings?.serverName,
              wsPath: streamSettings?.wsSettings?.path,
              grpcServiceName: streamSettings?.grpcSettings?.serviceName,
              remark: `从X-UI面板同步: ${inbound.remark || 'VLESS节点'}`,
              tags: ['xui-sync']
            };
            nodes.push(node);
          });
        }
        break;

      case 'vmess':
        if (settings.clients && Array.isArray(settings.clients)) {
          settings.clients.forEach((client: any, index: number) => {
            const node: Node = {
              name: `${inbound.remark || 'VMess'}-${client.email || index + 1}`,
              type: 'vmess' as ProxyType,
              server: '',
              port: inbound.port,
              enabled: inbound.enable,
              uuid: client.id,
              alterId: client.alterId || 0,
              encryption: client.security || 'auto',
              network: streamSettings?.network || 'tcp',
              security: streamSettings?.security || 'none',
              sni: streamSettings?.tlsSettings?.serverName,
              wsPath: streamSettings?.wsSettings?.path,
              grpcServiceName: streamSettings?.grpcSettings?.serviceName,
              remark: `从X-UI面板同步: ${inbound.remark || 'VMess节点'}`,
              tags: ['xui-sync']
            };
            nodes.push(node);
          });
        }
        break;

      case 'trojan':
        if (settings.clients && Array.isArray(settings.clients)) {
          settings.clients.forEach((client: any, index: number) => {
            const node: Node = {
              name: `${inbound.remark || 'Trojan'}-${client.email || index + 1}`,
              type: 'trojan' as ProxyType,
              server: '',
              port: inbound.port,
              enabled: inbound.enable,
              password: client.password,
              network: streamSettings?.network || 'tcp',
              sni: streamSettings?.tlsSettings?.serverName,
              wsPath: streamSettings?.wsSettings?.path,
              grpcServiceName: streamSettings?.grpcSettings?.serviceName,
              remark: `从X-UI面板同步: ${inbound.remark || 'Trojan节点'}`,
              tags: ['xui-sync']
            };
            nodes.push(node);
          });
        }
        break;

      case 'shadowsocks':
        const node: Node = {
          name: inbound.remark || 'Shadowsocks',
          type: 'ss' as ProxyType,
          server: '',
          port: inbound.port,
          enabled: inbound.enable,
          method: settings.method || 'aes-256-gcm',
          password: settings.password,
          remark: `从X-UI面板同步: ${inbound.remark || 'Shadowsocks节点'}`,
          tags: ['xui-sync']
        };
        nodes.push(node);
        break;
    }
  } catch (error) {
    console.error('解析入站配置失败:', error, inbound);
  }

  return nodes;
}

// 同步X-UI面板节点
xuiPanels.post('/:id/sync', async (c) => {
  try {
    const id = c.req.param('id');
    const repository = new XUIPanelRepository(c.env.DB);
    const nodeRepository = new NodeRepository(c.env.DB);

    // 获取面板信息
    const panelResult = await repository.findById(id);
    if (!panelResult.success || !panelResult.data) {
      return c.json({
        success: false,
        error: 'X-UI面板不存在'
      }, 404);
    }

    const panel = panelResult.data;

    try {
      console.log(`开始同步面板 ${panel.name} 的节点...`);
      console.log(`面板URL: ${panel.url}, 用户名: ${panel.username}`);

      // 创建X-UI API客户端
      const apiClient = new XUIApiClient(panel.url, panel.username, panel.password);

      // 登录获取session
      console.log('尝试登录X-UI面板...');
      const sessionId = await apiClient.login();
      console.log('X-UI面板登录成功，Session ID:', sessionId.substring(0, 10) + '...');

      // 获取入站配置
      console.log('获取入站配置...');
      const inbounds = await apiClient.getInbounds(sessionId);
      console.log(`获取到 ${inbounds.length} 个入站配置`);
      console.log('入站配置示例:', inbounds[0]);

      let nodesFound = 0;
      let nodesImported = 0;
      let nodesUpdated = 0;

      // 解析并导入节点
      for (const inbound of inbounds) {
        const parsedNodes = parseXUIInbound(inbound);
        nodesFound += parsedNodes.length;

        for (const node of parsedNodes) {
          // 设置服务器地址（从面板URL提取）
          try {
            const panelUrl = new URL(panel.url);
            node.server = panelUrl.hostname;
          } catch {
            node.server = panel.url.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
          }

          try {
            // 直接创建新节点，暂时不检查重复
            const createResult = await nodeRepository.create(node);
            if (createResult.success) {
              nodesImported++;
              console.log(`成功导入节点: ${node.name}`);
            } else {
              console.error(`导入节点失败: ${node.name}`, createResult.error);
            }
          } catch (nodeError) {
            console.error(`处理节点时出错: ${node.name}`, nodeError);
          }
        }
      }

      // 更新面板状态
      await repository.update(id, {
        status: 'online',
        lastSync: new Date().toISOString(),
        totalNodes: nodesFound
      });

      const syncResult = {
        nodesFound,
        nodesImported,
        nodesUpdated
      };

      console.log('同步完成:', syncResult);

      return c.json({
        success: true,
        data: syncResult,
        message: '节点同步成功'
      });
    } catch (error) {
      console.error('同步过程中出错:', error);

      // 更新为错误状态
      await repository.update(id, {
        status: 'error',
        lastSync: new Date().toISOString()
      });

      return c.json({
        success: false,
        error: `节点同步失败: ${error instanceof Error ? error.message : String(error)}`
      }, 500);
    }
  } catch (error) {
    console.error('同步X-UI面板节点失败:', error);
    return c.json({
      success: false,
      error: '服务器内部错误'
    }, 500);
  }
});

// 测试连接
xuiPanels.post('/test', async (c) => {
  try {
    const { url, username, password } = await c.req.json();

    if (!url || !username || !password) {
      return c.json({ success: false, error: '缺少必要参数' }, 400);
    }

    console.log(`测试连接到: ${url}, 用户名: ${username}`);

    // 创建API客户端并测试连接
    const apiClient = new XUIApiClient(url, username, password);

    console.log('开始测试登录...');
    const sessionId = await apiClient.login();
    console.log('登录成功，测试获取入站配置...');

    const inbounds = await apiClient.getInbounds(sessionId);
    console.log(`获取到 ${inbounds.length} 个入站配置`);

    return c.json({
      success: true,
      message: '连接测试成功',
      sessionId: sessionId.substring(0, 10) + '...',
      inboundCount: inbounds.length,
      sampleInbound: inbounds[0] || null
    });
  } catch (error) {
    console.error('测试连接失败:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '连接测试失败'
    }, 500);
  }
});

export { xuiPanels };
