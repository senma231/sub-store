import { ProxyNode, VlessNode, VmessNode, TrojanNode, ShadowsocksNode } from '../../../shared/types';

// V2Ray 配置接口
interface V2RayConfig {
  log: {
    loglevel: string;
  };
  inbounds: any[];
  outbounds: any[];
  routing: {
    rules: any[];
  };
}

// 转换为 V2Ray JSON 配置
export function toV2rayConfig(nodes: ProxyNode[]): V2RayConfig {
  const outbounds = nodes.map(node => convertNodeToV2rayOutbound(node));
  
  return {
    log: {
      loglevel: "warning"
    },
    inbounds: [
      {
        tag: "socks",
        port: 1080,
        listen: "127.0.0.1",
        protocol: "socks",
        sniffing: {
          enabled: true,
          destOverride: ["http", "tls"]
        },
        settings: {
          auth: "noauth",
          udp: true
        }
      },
      {
        tag: "http",
        port: 1087,
        listen: "127.0.0.1",
        protocol: "http",
        sniffing: {
          enabled: true,
          destOverride: ["http", "tls"]
        }
      }
    ],
    outbounds: [
      ...outbounds,
      {
        tag: "direct",
        protocol: "freedom",
        settings: {}
      },
      {
        tag: "block",
        protocol: "blackhole",
        settings: {
          response: {
            type: "http"
          }
        }
      }
    ],
    routing: {
      rules: [
        {
          type: "field",
          outboundTag: "direct",
          domain: ["geosite:cn"]
        },
        {
          type: "field",
          outboundTag: "direct",
          ip: ["geoip:cn", "geoip:private"]
        }
      ]
    }
  };
}

// 转换为 Base64 编码的订阅链接
export function toV2rayBase64(nodes: ProxyNode[]): string {
  const links = nodes.map(node => convertNodeToV2rayLink(node)).filter(Boolean);
  return btoa(links.join('\n'));
}

// 将节点转换为 V2Ray outbound 配置
function convertNodeToV2rayOutbound(node: ProxyNode): any {
  const base = {
    tag: node.name,
    protocol: getV2rayProtocol(node.type),
  };

  switch (node.type) {
    case 'vless':
      return {
        ...base,
        settings: {
          vnext: [{
            address: node.server,
            port: node.port,
            users: [{
              id: (node as VlessNode).uuid,
              encryption: (node as VlessNode).encryption || 'none',
              flow: (node as VlessNode).flow || ''
            }]
          }]
        },
        streamSettings: buildStreamSettings(node as VlessNode)
      };

    case 'vmess':
      return {
        ...base,
        settings: {
          vnext: [{
            address: node.server,
            port: node.port,
            users: [{
              id: (node as VmessNode).uuid,
              alterId: (node as VmessNode).alterId || 0,
              security: (node as VmessNode).security || 'auto'
            }]
          }]
        },
        streamSettings: buildStreamSettings(node as VmessNode)
      };

    case 'trojan':
      return {
        ...base,
        settings: {
          servers: [{
            address: node.server,
            port: node.port,
            password: (node as TrojanNode).password
          }]
        },
        streamSettings: buildStreamSettings(node as TrojanNode)
      };

    case 'ss':
      return {
        ...base,
        protocol: 'shadowsocks',
        settings: {
          servers: [{
            address: node.server,
            port: node.port,
            method: (node as ShadowsocksNode).method,
            password: (node as ShadowsocksNode).password
          }]
        }
      };

    default:
      return base;
  }
}

// 将节点转换为 V2Ray 链接
function convertNodeToV2rayLink(node: ProxyNode): string {
  switch (node.type) {
    case 'vless':
      return buildVlessLink(node as VlessNode);
    case 'vmess':
      return buildVmessLink(node as VmessNode);
    case 'trojan':
      return buildTrojanLink(node as TrojanNode);
    case 'ss':
      return buildShadowsocksLink(node as ShadowsocksNode);
    default:
      return '';
  }
}

// 构建 VLESS 链接
function buildVlessLink(node: VlessNode): string {
  const params = new URLSearchParams();
  
  if (node.encryption && node.encryption !== 'none') {
    params.set('encryption', node.encryption);
  }
  
  if (node.flow) {
    params.set('flow', node.flow);
  }
  
  if (node.security && node.security !== 'none') {
    params.set('security', node.security);
  }
  
  if (node.sni) {
    params.set('sni', node.sni);
  }
  
  if (node.alpn && node.alpn.length > 0) {
    params.set('alpn', node.alpn.join(','));
  }
  
  if (node.fingerprint) {
    params.set('fp', node.fingerprint);
  }
  
  params.set('type', node.network);
  
  // 网络特定参数
  if (node.network === 'ws') {
    if (node.wsPath) params.set('path', node.wsPath);
    if (node.wsHeaders) {
      params.set('host', node.wsHeaders.Host || '');
    }
  } else if (node.network === 'h2') {
    if (node.h2Path) params.set('path', node.h2Path);
    if (node.h2Host && node.h2Host.length > 0) {
      params.set('host', node.h2Host.join(','));
    }
  } else if (node.network === 'grpc') {
    if (node.grpcServiceName) params.set('serviceName', node.grpcServiceName);
    if (node.grpcMode) params.set('mode', node.grpcMode);
  }
  
  const paramString = params.toString();
  const fragment = encodeURIComponent(node.name);
  
  return `vless://${node.uuid}@${node.server}:${node.port}?${paramString}#${fragment}`;
}

// 构建 VMess 链接
function buildVmessLink(node: VmessNode): string {
  const config = {
    v: '2',
    ps: node.name,
    add: node.server,
    port: node.port.toString(),
    id: node.uuid,
    aid: node.alterId.toString(),
    scy: node.security,
    net: node.network,
    type: 'none',
    host: '',
    path: '',
    tls: node.tls ? 'tls' : '',
    sni: node.sni || '',
    alpn: node.alpn ? node.alpn.join(',') : ''
  };
  
  // 网络特定配置
  if (node.network === 'ws') {
    config.path = node.wsPath || '';
    config.host = node.wsHeaders?.Host || '';
  } else if (node.network === 'h2') {
    config.path = node.h2Path || '';
    config.host = node.h2Host ? node.h2Host.join(',') : '';
  } else if (node.network === 'grpc') {
    config.path = node.grpcServiceName || '';
    config.type = node.grpcMode || 'gun';
  }
  
  return 'vmess://' + btoa(JSON.stringify(config));
}

// 构建 Trojan 链接
function buildTrojanLink(node: TrojanNode): string {
  const params = new URLSearchParams();
  
  if (node.sni) {
    params.set('sni', node.sni);
  }
  
  if (node.alpn && node.alpn.length > 0) {
    params.set('alpn', node.alpn.join(','));
  }
  
  if (node.allowInsecure) {
    params.set('allowInsecure', '1');
  }
  
  if (node.network && node.network !== 'tcp') {
    params.set('type', node.network);
    
    if (node.network === 'ws') {
      if (node.wsPath) params.set('path', node.wsPath);
      if (node.wsHeaders?.Host) params.set('host', node.wsHeaders.Host);
    } else if (node.network === 'grpc') {
      if (node.grpcServiceName) params.set('serviceName', node.grpcServiceName);
      if (node.grpcMode) params.set('mode', node.grpcMode);
    }
  }
  
  const paramString = params.toString();
  const fragment = encodeURIComponent(node.name);
  
  return `trojan://${encodeURIComponent(node.password)}@${node.server}:${node.port}?${paramString}#${fragment}`;
}

// 构建 Shadowsocks 链接
function buildShadowsocksLink(node: ShadowsocksNode): string {
  const auth = btoa(`${node.method}:${node.password}`);
  const fragment = encodeURIComponent(node.name);
  
  let link = `ss://${auth}@${node.server}:${node.port}#${fragment}`;
  
  if (node.plugin) {
    const params = new URLSearchParams();
    params.set('plugin', `${node.plugin}${node.pluginOpts ? ';' + node.pluginOpts : ''}`);
    link += '?' + params.toString();
  }
  
  return link;
}

// 构建流设置
function buildStreamSettings(node: VlessNode | VmessNode | TrojanNode): any {
  const streamSettings: any = {
    network: node.network || 'tcp'
  };
  
  // TLS 设置
  if ((node as any).security === 'tls' || (node as any).tls) {
    streamSettings.security = 'tls';
    streamSettings.tlsSettings = {
      allowInsecure: (node as any).allowInsecure || false,
      serverName: node.sni || ''
    };

    if (node.alpn && node.alpn.length > 0) {
      streamSettings.tlsSettings.alpn = node.alpn;
    }

    if ((node as any).fingerprint) {
      streamSettings.tlsSettings.fingerprint = (node as any).fingerprint;
    }
  }
  
  // 网络特定设置
  if (node.network === 'ws') {
    streamSettings.wsSettings = {
      path: (node as any).wsPath || '/',
      headers: (node as any).wsHeaders || {}
    };
  } else if (node.network === 'h2') {
    streamSettings.httpSettings = {
      path: (node as any).h2Path || '/',
      host: (node as any).h2Host || []
    };
  } else if (node.network === 'grpc') {
    streamSettings.grpcSettings = {
      serviceName: (node as any).grpcServiceName || '',
      multiMode: (node as any).grpcMode === 'multi'
    };
  }
  
  return streamSettings;
}

// 获取 V2Ray 协议名称
function getV2rayProtocol(type: string): string {
  switch (type) {
    case 'vless':
      return 'vless';
    case 'vmess':
      return 'vmess';
    case 'trojan':
      return 'trojan';
    case 'ss':
      return 'shadowsocks';
    default:
      return type;
  }
}
