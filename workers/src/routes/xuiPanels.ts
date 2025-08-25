import { Hono } from 'hono';
import { XUIPanelRepository } from '../repositories/xuiPanelRepository';
import { NodeRepository } from '../repositories/nodeRepository';
import { XUIPanel, Node, ProxyType } from '../../../shared/types';
import { IPLocationService } from '../services/ipLocationService';
import { authMiddleware } from '../middleware/auth';

type Bindings = {
  DB: D1Database;
  ADMIN_TOKEN: string;
  JWT_SECRET: string;
  XUI_BRIDGE_URL?: string;
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

    console.log(`测试连接到面板: ${panel.name}, URL: ${panel.url}, 用户名: ${panel.username}`);

    try {
      // 优先使用桥接服务进行测试
      const bridgeUrl = c.env.XUI_BRIDGE_URL;
      if (bridgeUrl) {
        console.log(`使用桥接服务测试连接: ${bridgeUrl}`);
        const result = await testXUIWithBridge(c, bridgeUrl, panel.url, panel.username, panel.password);

        // 更新面板状态
        const status = result.success ? 'online' : 'error';
        await repository.update(id, {
          status,
          lastSync: new Date().toISOString()
        });

        return result;
      }

      // 回退到简单的页面可访问性测试
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
        success: isOnline,
        data: {
          status,
          statusCode: response.status,
          responseTime: Date.now(),
          connected: isOnline
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
          error: error instanceof Error ? error.message : String(error),
          connected: false
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

  async login(proxyUrl?: string): Promise<string> {
    try {
      let loginUrl = `${this.baseUrl}/login`;

      console.log(`尝试登录: ${loginUrl}`);
      console.log(`用户名: ${this.username}`);
      console.log(`密码长度: ${this.password.length}`);

      let fetchOptions: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'max-age=0',
          'Origin': this.baseUrl,
          'Referer': this.baseUrl + '/',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'same-origin',
          'Sec-Fetch-User': '?1'
        },
        body: `username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`
      };

      // 如果使用代理，修改请求
      if (proxyUrl) {
        console.log(`使用代理: ${proxyUrl}`);
        loginUrl = proxyUrl;
        fetchOptions.headers = {
          ...fetchOptions.headers,
          'X-Target-URL': `${this.baseUrl}/login`
        };
      }

      const response = await fetch(loginUrl, fetchOptions);

      console.log(`登录响应状态: ${response.status}`);
      console.log(`登录响应状态文本: ${response.statusText}`);
      console.log(`登录响应头:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const responseText = await response.text();
        console.log('登录失败响应:', responseText);

        // 特殊处理Cloudflare错误
        if (response.status === 403) {
          throw new Error(`访问被拒绝 (403): 可能是防火墙或Cloudflare安全策略阻止了访问。响应: ${responseText}`);
        }

        throw new Error(`登录失败: HTTP ${response.status} ${response.statusText} - ${responseText}`);
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
      // FranzKafkaYu x-ui 使用 /xui/inbound/list 路径
      const apiUrl = `${this.baseUrl}/xui/inbound/list`;

      console.log(`尝试获取入站配置: ${apiUrl}`);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `session=${sessionId}`,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({})
      });

      console.log(`入站配置响应状态: ${response.status}`);
      console.log(`入站配置响应头:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const responseText = await response.text();
        console.log('获取入站配置失败响应:', responseText);
        throw new Error(`获取入站配置失败: HTTP ${response.status} - ${responseText}`);
      }

      const data = await response.json();
      console.log('入站配置响应数据:', data);

      // FranzKafkaYu x-ui 的响应格式可能不同
      if ((data as any).success === false) {
        throw new Error(`API返回错误: ${(data as any).msg || '未知错误'}`);
      }

      // 返回数据，可能直接是数组或在obj字段中
      return Array.isArray(data) ? data : ((data as any).obj || (data as any).data || []);
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
              id: `xui_${inbound.id}_${client.id}_${Date.now()}`,
              name: `${inbound.remark || 'VLESS'}-${client.email || index + 1}`,
              type: 'vless' as ProxyType,
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
          settings.clients.forEach((client: any, index: number) => {
            const node: Node = {
              id: `xui_${inbound.id}_${client.id}_${Date.now()}`,
              name: `${inbound.remark || 'VMess'}-${client.email || index + 1}`,
              type: 'vmess' as ProxyType,
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
          settings.clients.forEach((client: any, index: number) => {
            const node: Node = {
              id: `xui_${inbound.id}_${client.id || client.password}_${Date.now()}`,
              name: `${inbound.remark || 'Trojan'}-${client.email || index + 1}`,
              type: 'trojan' as ProxyType,
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
        const node: Node = {
          id: `xui_${inbound.id}_ss_${Date.now()}`,
          name: inbound.remark || 'Shadowsocks',
          type: 'ss' as ProxyType,
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

      let inbounds: any[] = [];

      // 优先使用Bridge服务进行同步
      const bridgeUrl = c.env.XUI_BRIDGE_URL;
      if (bridgeUrl) {
        console.log(`使用Bridge服务同步: ${bridgeUrl}`);
        const syncResult = await syncXUIWithBridge(bridgeUrl, panel.url, panel.username, panel.password);
        if (syncResult.success) {
          inbounds = syncResult.data.nodes || [];
          console.log(`通过Bridge服务获取到 ${inbounds.length} 个节点`);
        } else {
          throw new Error(`Bridge服务同步失败: ${syncResult.error}`);
        }
      } else {
        // 回退到直接连接
        console.log('使用直接连接方式...');
        const apiClient = new XUIApiClient(panel.url, panel.username, panel.password);

        // 登录获取session
        console.log('尝试登录X-UI面板...');
        const sessionId = await apiClient.login();
        console.log('X-UI面板登录成功，Session ID:', sessionId.substring(0, 10) + '...');

        // 获取入站配置
        console.log('获取入站配置...');
        const rawInbounds = await apiClient.getInbounds(sessionId);
        console.log(`获取到 ${rawInbounds.length} 个入站配置`);

        // 解析入站配置为节点
        for (const inbound of rawInbounds) {
          const parsedNodes = parseXUIInbound(inbound);
          inbounds.push(...parsedNodes);
        }
      }

      let nodesFound = 0;
      let nodesImported = 0;
      let nodesUpdated = 0;

      // 处理节点数据
      let nodesToProcess: any[] = [];

      if (bridgeUrl) {
        // Bridge服务返回的已经是解析好的节点
        nodesToProcess = inbounds;
        nodesFound = nodesToProcess.length;
      } else {
        // 直接连接需要解析入站配置
        for (const inbound of inbounds) {
          const parsedNodes = parseXUIInbound(inbound);
          nodesToProcess.push(...parsedNodes);
          nodesFound += parsedNodes.length;
        }
      }

      // 导入节点（支持去重和更新）
      for (const node of nodesToProcess) {
        // 设置服务器地址（从面板URL提取）
        if (!node.server || node.server === 'localhost') {
          try {
            const panelUrl = new URL(panel.url);
            node.server = panelUrl.hostname;
          } catch {
            node.server = panel.url.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
          }
        }

        // 设置来源信息
        node.sourceType = 'xui';
        node.sourcePanelId = panel.id;
        node.sourceNodeId = node.id; // 使用原始的XUI节点ID作为来源节点ID

        // 查询IP地理位置信息
        try {
          const locationInfo = await IPLocationService.getLocation(node.server);
          node.locationCountry = locationInfo.country;
          node.locationRegion = locationInfo.region;
          node.locationCity = locationInfo.city;
        } catch (locationError) {
          console.warn(`获取IP地理位置失败 (${node.server}):`, locationError);
        }

        try {
          // 检查是否已存在相同来源的节点
          const existingResult = await nodeRepository.findBySource(panel.id, node.id);

          if (existingResult.success && existingResult.data) {
            // 节点已存在，更新它
            const updateResult = await nodeRepository.update(existingResult.data.id, {
              name: node.name,
              type: node.type,
              server: node.server,
              port: node.port,
              enabled: node.enabled,
              tags: node.tags,
              remark: node.remark,
              uuid: node.uuid,
              encryption: node.encryption,
              flow: node.flow,
              alterId: node.alterId,
              security: node.security,
              password: node.password,
              method: node.method,
              username: node.username,
              network: node.network,
              tls: node.tls,
              sni: node.sni,
              alpn: node.alpn,
              fingerprint: node.fingerprint,
              allowInsecure: node.allowInsecure,
              wsPath: node.wsPath,
              wsHeaders: node.wsHeaders,
              h2Path: node.h2Path,
              h2Host: node.h2Host,
              grpcServiceName: node.grpcServiceName,
              grpcMode: node.grpcMode,
              plugin: node.plugin,
              pluginOpts: node.pluginOpts,
              obfs: node.obfs,
              obfsPassword: node.obfsPassword,
              upMbps: node.upMbps,
              downMbps: node.downMbps,
              auth: node.auth,
              authStr: node.authStr,
              protocol: node.protocol,
              sourceType: node.sourceType,
              sourcePanelId: node.sourcePanelId,
              sourceNodeId: node.sourceNodeId
            });

            if (updateResult.success) {
              nodesUpdated++;
              console.log(`成功更新节点: ${node.name}`);
            } else {
              console.error(`更新节点失败: ${node.name}`, updateResult.error);
            }
          } else {
            // 节点不存在，创建新节点
            const createResult = await nodeRepository.create(node);
            if (createResult.success) {
              nodesImported++;
              console.log(`成功导入节点: ${node.name}`);
            } else {
              console.error(`导入节点失败: ${node.name}`, createResult.error);
            }
          }
        } catch (nodeError) {
          console.error(`处理节点时出错: ${node.name}`, nodeError);
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
    const { url, username, password, useProxy, bridgeUrl } = await c.req.json();

    if (!url || !username || !password) {
      return c.json({ success: false, error: '缺少必要参数' }, 400);
    }

    console.log(`测试连接到: ${url}, 用户名: ${username}`);

    // 优先使用配置的桥接服务URL，然后是请求中提供的bridgeUrl
    const configuredBridgeUrl = c.env.XUI_BRIDGE_URL;
    const finalBridgeUrl = bridgeUrl || configuredBridgeUrl;

    if (finalBridgeUrl) {
      console.log(`使用桥接服务: ${finalBridgeUrl}`);
      return await testXUIWithBridge(c, finalBridgeUrl, url, username, password);
    }

    // 如果启用代理模式，使用代理服务
    if (useProxy) {
      return await testXUIWithProxy(c, url, username, password);
    }

    // 首先测试基本连通性
    let workingUrl = url;
    let connectivityTest = false;

    // 尝试不同的连接方式
    const urlsToTest = [url];

    // 如果是HTTP，也尝试HTTPS
    if (url.startsWith('http://')) {
      urlsToTest.push(url.replace('http://', 'https://'));
    }

    // 尝试添加更多真实的请求头
    for (const testUrl of urlsToTest) {
      try {
        console.log(`测试连通性: ${testUrl}`);
        const pingResponse = await fetch(testUrl, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
          }
        });
        console.log(`连通性测试结果 ${testUrl}: ${pingResponse.status} ${pingResponse.statusText}`);
        console.log(`响应头:`, Object.fromEntries(pingResponse.headers.entries()));

        if (pingResponse.ok || pingResponse.status === 302 || pingResponse.status === 401 || pingResponse.status === 200) {
          connectivityTest = true;
          workingUrl = testUrl;
          break;
        }
      } catch (pingError) {
        console.error(`连通性测试失败 ${testUrl}:`, pingError);
      }
    }

    if (!connectivityTest) {
      return c.json({
        success: false,
        error: `无法连接到服务器，已尝试: ${urlsToTest.join(', ')}。这可能是Cloudflare Workers被目标服务器阻止，或者网络连接问题。`
      }, 500);
    }

    // 创建API客户端并测试连接
    const apiClient = new XUIApiClient(workingUrl, username, password);

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

// 使用桥接服务测试X-UI连接
async function testXUIWithBridge(c: any, bridgeUrl: string, url: string, username: string, password: string) {
  try {
    console.log(`使用桥接服务测试X-UI连接: ${bridgeUrl}`);

    const response = await fetch(`${bridgeUrl}/api/xui/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Sub-Store/2.0.0'
      },
      body: JSON.stringify({
        url,
        username,
        password
      })
    });

    console.log(`桥接服务响应状态: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`桥接服务请求失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('桥接服务响应:', data);

    return c.json({
      success: true,
      message: '通过桥接服务成功连接X-UI面板',
      data: (data as any).data,
      bridgeService: true
    });
  } catch (error) {
    console.error('桥接服务测试失败:', error);
    return c.json({
      success: false,
      error: `桥接服务测试失败: ${error instanceof Error ? error.message : String(error)}`
    }, 500);
  }
}

// 使用代理服务测试X-UI连接
async function testXUIWithProxy(c: any, url: string, username: string, password: string) {
  try {
    console.log('使用代理模式测试X-UI连接');

    // 使用公共代理服务或你自己的代理服务
    const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url);

    console.log(`通过代理访问: ${proxyUrl}`);

    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    console.log(`代理响应状态: ${response.status}`);

    if (response.ok) {
      const responseText = await response.text();
      console.log('代理访问成功，响应长度:', responseText.length);

      return c.json({
        success: true,
        message: '通过代理服务成功访问X-UI面板',
        proxyTest: true,
        responseLength: responseText.length
      });
    } else {
      throw new Error(`代理访问失败: ${response.status}`);
    }
  } catch (error) {
    console.error('代理测试失败:', error);
    return c.json({
      success: false,
      error: `代理测试失败: ${error instanceof Error ? error.message : String(error)}`
    }, 500);
  }
}

// 使用SSH隧道方式（需要你提供一个中转服务器）
async function testXUIWithSSHTunnel(c: any, url: string, username: string, password: string) {
  try {
    // 这需要你在某台服务器上设置SSH隧道
    // ssh -L 8080:target-server:65500 your-proxy-server
    // 然后通过 http://your-proxy-server:8080 访问

    const tunnelUrl = url.replace('8.211.175.95:65500', 'your-proxy-server.com:8080');

    console.log(`通过SSH隧道访问: ${tunnelUrl}`);

    const apiClient = new XUIApiClient(tunnelUrl, username, password);
    const sessionId = await apiClient.login();
    const inbounds = await apiClient.getInbounds(sessionId);

    return c.json({
      success: true,
      message: '通过SSH隧道成功连接',
      sessionId: sessionId.substring(0, 10) + '...',
      inboundCount: inbounds.length
    });
  } catch (error) {
    console.error('SSH隧道测试失败:', error);
    return c.json({
      success: false,
      error: `SSH隧道测试失败: ${error instanceof Error ? error.message : String(error)}`
    }, 500);
  }
}

// 使用桥接服务同步X-UI节点
async function syncXUIWithBridge(bridgeUrl: string, url: string, username: string, password: string) {
  try {
    console.log(`使用桥接服务同步X-UI节点: ${bridgeUrl}`);

    const response = await fetch(`${bridgeUrl}/api/xui/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Sub-Store/2.0.0'
      },
      body: JSON.stringify({
        url,
        username,
        password
      })
    });

    console.log(`桥接服务同步响应状态: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`桥接服务同步失败: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('桥接服务同步响应:', data);

    return {
      success: true,
      data: (data as any).data || data,
      message: (data as any).message || '同步成功'
    };
  } catch (error) {
    console.error('桥接服务同步失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export { xuiPanels };
