import { Hono } from 'hono';
import { Env } from '../index';

// 简化的节点类型
interface SimpleNode {
  id: string;
  name: string;
  type: 'vless' | 'vmess' | 'trojan' | 'ss' | 'socks5' | 'hy2' | 'hy';
  server: string;
  port: number;
  enabled: boolean;
  remark?: string;
  uuid?: string;
  password?: string;
  method?: string;
  [key: string]: any;
}

export const subscriptionRouter = new Hono<{ Bindings: Env }>();

// 演示节点数据
const demoNodes: SimpleNode[] = [
  {
    id: 'demo-vless-1',
    name: '演示 VLESS 节点',
    type: 'vless',
    server: 'demo.example.com',
    port: 443,
    enabled: true,
    uuid: '12345678-1234-1234-1234-123456789abc',
    remark: '这是一个演示节点',
  },
  {
    id: 'demo-vmess-1',
    name: '演示 VMess 节点',
    type: 'vmess',
    server: 'demo2.example.com',
    port: 443,
    enabled: true,
    uuid: '87654321-4321-4321-4321-cba987654321',
    remark: '这是另一个演示节点',
  }
];

// 获取订阅内容
subscriptionRouter.get('/:format', async (c) => {
  try {
    const format = c.req.param('format');
    const userAgent = c.req.header('User-Agent') || '';

    // 验证格式
    const supportedFormats = ['v2ray', 'clash', 'shadowrocket'];
    if (!supportedFormats.includes(format)) {
      return c.text(`Unsupported format: ${format}. Supported: ${supportedFormats.join(', ')}`, 400);
    }

    // 获取启用的节点
    const enabledNodes = demoNodes.filter(node => node.enabled);

    // 简化的订阅内容生成
    let content = '';
    let contentType = 'text/plain';
    let filename = `sub-store-${format}.txt`;

    if (format === 'v2ray') {
      // 生成 V2Ray 订阅（Base64 编码的 vmess/vless 链接）
      const links = enabledNodes.map(node => {
        if (node.type === 'vless') {
          return `vless://${node.uuid}@${node.server}:${node.port}?type=tcp&security=tls#${encodeURIComponent(node.name)}`;
        } else if (node.type === 'vmess') {
          const vmessConfig = {
            v: "2",
            ps: node.name,
            add: node.server,
            port: node.port,
            id: node.uuid,
            aid: "0",
            net: "tcp",
            type: "none",
            host: "",
            path: "",
            tls: "tls"
          };
          return 'vmess://' + btoa(JSON.stringify(vmessConfig));
        }
        return `# Unsupported node type: ${node.type}`;
      });
      content = btoa(links.join('\n'));
      contentType = 'text/plain';
      filename = 'sub-store-v2ray.txt';
    } else if (format === 'clash') {
      // 生成 Clash 配置
      const proxies = enabledNodes.map(node => {
        if (node.type === 'vless') {
          return {
            name: node.name,
            type: 'vless',
            server: node.server,
            port: node.port,
            uuid: node.uuid,
            tls: true,
            network: 'tcp'
          };
        } else if (node.type === 'vmess') {
          return {
            name: node.name,
            type: 'vmess',
            server: node.server,
            port: node.port,
            uuid: node.uuid,
            alterId: 0,
            cipher: 'auto',
            tls: true,
            network: 'tcp'
          };
        }
        return null;
      }).filter(Boolean);

      const clashConfig = {
        port: 7890,
        'socks-port': 7891,
        'allow-lan': false,
        mode: 'rule',
        'log-level': 'info',
        'external-controller': '127.0.0.1:9090',
        proxies,
        'proxy-groups': [
          {
            name: 'Proxy',
            type: 'select',
            proxies: ['DIRECT', ...proxies.map(p => p.name)]
          }
        ],
        rules: [
          'MATCH,Proxy'
        ]
      };
      content = `# Sub-Store Clash Configuration\n# Generated at ${new Date().toISOString()}\n\n` +
                JSON.stringify(clashConfig, null, 2);
      contentType = 'application/yaml';
      filename = 'sub-store-clash.yaml';
    } else if (format === 'shadowrocket') {
      // 生成 Shadowrocket 订阅
      const links = enabledNodes.map(node => {
        if (node.type === 'vless') {
          return `vless://${node.uuid}@${node.server}:${node.port}?type=tcp&security=tls#${encodeURIComponent(node.name)}`;
        } else if (node.type === 'vmess') {
          const vmessConfig = {
            v: "2",
            ps: node.name,
            add: node.server,
            port: node.port,
            id: node.uuid,
            aid: "0",
            net: "tcp",
            type: "none",
            host: "",
            path: "",
            tls: "tls"
          };
          return 'vmess://' + btoa(JSON.stringify(vmessConfig));
        }
        return `# Unsupported node type: ${node.type}`;
      });
      content = btoa(links.join('\n'));
      contentType = 'text/plain';
      filename = 'sub-store-shadowrocket.txt';
    }

    // 设置响应头
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Subscription-Userinfo': `upload=0; download=0; total=${enabledNodes.length}; expire=0`,
      'Profile-Update-Interval': '24',
      'Profile-Title': 'Sub-Store Demo Subscription',
    };

    return c.text(content, 200, headers);
    
  } catch (error) {
    console.error('Subscription error:', error);
    return c.text('Internal server error', 500);
  }
});

// 获取订阅信息
subscriptionRouter.get('/:format/info', async (c) => {
  try {
    const format = c.req.param('format');

    const supportedFormats = ['v2ray', 'clash', 'shadowrocket'];
    if (!supportedFormats.includes(format)) {
      return c.json({
        success: false,
        error: 'Unsupported format',
        message: `Format '${format}' is not supported`,
      }, 400);
    }

    const enabledNodes = demoNodes.filter(node => node.enabled);

    // 统计节点类型
    const nodeStats = enabledNodes.reduce((stats, node) => {
      stats[node.type] = (stats[node.type] || 0) + 1;
      return stats;
    }, {} as Record<string, number>);

    return c.json({
      success: true,
      data: {
        format: {
          name: format,
          description: `${format} subscription format`,
          contentType: format === 'clash' ? 'application/yaml' : 'text/plain',
        },
        statistics: {
          totalNodes: demoNodes.length,
          enabledNodes: enabledNodes.length,
          nodeTypes: nodeStats,
        },
        lastUpdated: Date.now(),
      },
    });

  } catch (error) {
    console.error('Subscription info error:', error);
    return c.json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

// 获取支持的格式列表
subscriptionRouter.get('/', async (c) => {
  const formats = [
    {
      format: 'v2ray',
      name: 'V2Ray',
      description: 'V2Ray subscription format (Base64 encoded)',
      contentType: 'text/plain',
      url: `${c.req.url}/v2ray`,
    },
    {
      format: 'clash',
      name: 'Clash',
      description: 'Clash configuration format',
      contentType: 'application/yaml',
      url: `${c.req.url}/clash`,
    },
    {
      format: 'shadowrocket',
      name: 'Shadowrocket',
      description: 'Shadowrocket subscription format',
      contentType: 'text/plain',
      url: `${c.req.url}/shadowrocket`,
    }
  ];

  return c.json({
    success: true,
    data: {
      formats,
      statistics: {
        totalNodes: demoNodes.length,
        enabledNodes: demoNodes.filter(n => n.enabled).length,
      },
      examples: {
        v2ray: `${c.req.url}/v2ray`,
        clash: `${c.req.url}/clash`,
        shadowrocket: `${c.req.url}/shadowrocket`,
      },
    },
  });
});
