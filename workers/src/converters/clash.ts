import { stringify } from 'yaml';
import { ProxyNode, VlessNode, VmessNode, TrojanNode, ShadowsocksNode, Socks5Node, Hysteria2Node, HysteriaNode } from '../../../shared/types';
import { ConversionOptions } from './index';

// Clash 配置接口
interface ClashConfig {
  port: number;
  'socks-port': number;
  'allow-lan': boolean;
  mode: string;
  'log-level': string;
  'external-controller': string;
  dns: {
    enable: boolean;
    listen: string;
    'default-nameserver': string[];
    nameserver: string[];
    'enhanced-mode': string;
    'fake-ip-range': string;
    'fake-ip-filter': string[];
  };
  proxies: any[];
  'proxy-groups': any[];
  rules: string[];
}

// 转换为 Clash 配置
export function toClashConfig(nodes: ProxyNode[], options: ConversionOptions = {}): string {
  const proxies = nodes.map(node => convertNodeToClashProxy(node));
  const proxyNames = proxies.map(proxy => proxy.name);
  
  const config: ClashConfig = {
    port: 7890,
    'socks-port': 7891,
    'allow-lan': false,
    mode: 'rule',
    'log-level': 'info',
    'external-controller': '127.0.0.1:9090',
    dns: {
      enable: true,
      listen: '0.0.0.0:53',
      'default-nameserver': ['223.5.5.5', '119.29.29.29'],
      nameserver: ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query'],
      'enhanced-mode': 'fake-ip',
      'fake-ip-range': '198.18.0.1/16',
      'fake-ip-filter': [
        '*.lan',
        'localhost.ptlogin2.qq.com',
        'dns.msftncsi.com',
        'www.msftncsi.com',
        'www.msftconnecttest.com'
      ]
    },
    proxies,
    'proxy-groups': generateProxyGroups(proxyNames, options),
    rules: getDefaultRules()
  };
  
  return stringify(config, {
    indent: 2,
    lineWidth: -1
  });
}

// 将节点转换为 Clash 代理配置
function convertNodeToClashProxy(node: ProxyNode): any {
  const base = {
    name: node.name,
    server: node.server,
    port: node.port
  };

  switch (node.type) {
    case 'vless':
      return convertVlessToClash(node as VlessNode, base);
    case 'vmess':
      return convertVmessToClash(node as VmessNode, base);
    case 'trojan':
      return convertTrojanToClash(node as TrojanNode, base);
    case 'ss':
      return convertShadowsocksToClash(node as ShadowsocksNode, base);
    case 'socks5':
      return convertSocks5ToClash(node as Socks5Node, base);
    case 'hy2':
      return convertHysteria2ToClash(node as Hysteria2Node, base);
    case 'hy':
      return convertHysteriaToClash(node as HysteriaNode, base);
    default:
      return base;
  }
}

// VLESS 转换
function convertVlessToClash(node: VlessNode, base: any): any {
  const proxy = {
    ...base,
    type: 'vless',
    uuid: node.uuid,
    cipher: node.encryption || 'none',
    tls: node.security === 'tls',
    'skip-cert-verify': false,
    network: node.network || 'tcp'
  };

  if (node.sni) {
    proxy.servername = node.sni;
  }

  if (node.alpn && node.alpn.length > 0) {
    proxy.alpn = node.alpn;
  }

  if (node.fingerprint) {
    proxy.fingerprint = node.fingerprint;
  }

  if (node.flow) {
    proxy.flow = node.flow;
  }

  // 网络特定配置
  if (node.network === 'ws') {
    proxy['ws-opts'] = {
      path: node.wsPath || '/',
      headers: node.wsHeaders || {}
    };
  } else if (node.network === 'h2') {
    proxy['h2-opts'] = {
      path: node.h2Path || '/',
      host: node.h2Host || []
    };
  } else if (node.network === 'grpc') {
    proxy['grpc-opts'] = {
      'grpc-service-name': node.grpcServiceName || ''
    };
  }

  return proxy;
}

// VMess 转换
function convertVmessToClash(node: VmessNode, base: any): any {
  const proxy = {
    ...base,
    type: 'vmess',
    uuid: node.uuid,
    alterId: node.alterId || 0,
    cipher: node.security || 'auto',
    tls: node.tls || false,
    'skip-cert-verify': false,
    network: node.network || 'tcp'
  };

  if (node.sni) {
    proxy.servername = node.sni;
  }

  if (node.alpn && node.alpn.length > 0) {
    proxy.alpn = node.alpn;
  }

  // 网络特定配置
  if (node.network === 'ws') {
    proxy['ws-opts'] = {
      path: node.wsPath || '/',
      headers: node.wsHeaders || {}
    };
  } else if (node.network === 'h2') {
    proxy['h2-opts'] = {
      path: node.h2Path || '/',
      host: node.h2Host || []
    };
  } else if (node.network === 'grpc') {
    proxy['grpc-opts'] = {
      'grpc-service-name': node.grpcServiceName || ''
    };
  }

  return proxy;
}

// Trojan 转换
function convertTrojanToClash(node: TrojanNode, base: any): any {
  const proxy = {
    ...base,
    type: 'trojan',
    password: node.password,
    'skip-cert-verify': node.allowInsecure || false,
    network: node.network || 'tcp'
  };

  if (node.sni) {
    proxy.sni = node.sni;
  }

  if (node.alpn && node.alpn.length > 0) {
    proxy.alpn = node.alpn;
  }

  if (node.fingerprint) {
    proxy.fingerprint = node.fingerprint;
  }

  // 网络特定配置
  if (node.network === 'ws') {
    proxy['ws-opts'] = {
      path: node.wsPath || '/',
      headers: node.wsHeaders || {}
    };
  } else if (node.network === 'grpc') {
    proxy['grpc-opts'] = {
      'grpc-service-name': node.grpcServiceName || ''
    };
  }

  return proxy;
}

// Shadowsocks 转换
function convertShadowsocksToClash(node: ShadowsocksNode, base: any): any {
  const proxy = {
    ...base,
    type: 'ss',
    cipher: node.method,
    password: node.password
  };

  if (node.plugin) {
    proxy.plugin = node.plugin;
    if (node.pluginOpts) {
      proxy['plugin-opts'] = parsePluginOpts(node.pluginOpts);
    }
  }

  return proxy;
}

// SOCKS5 转换
function convertSocks5ToClash(node: Socks5Node, base: any): any {
  const proxy = {
    ...base,
    type: 'socks5'
  };

  if (node.username) {
    proxy.username = node.username;
  }

  if (node.password) {
    proxy.password = node.password;
  }

  if (node.tls) {
    proxy.tls = true;
    proxy['skip-cert-verify'] = false;
    if (node.sni) {
      proxy.sni = node.sni;
    }
  }

  return proxy;
}

// Hysteria2 转换
function convertHysteria2ToClash(node: Hysteria2Node, base: any): any {
  const proxy = {
    ...base,
    type: 'hysteria2',
    password: node.password,
    'skip-cert-verify': node.allowInsecure || false
  };

  if (node.sni) {
    proxy.sni = node.sni;
  }

  if (node.alpn && node.alpn.length > 0) {
    proxy.alpn = node.alpn;
  }

  if (node.obfs) {
    proxy.obfs = node.obfs;
    if (node.obfsPassword) {
      proxy['obfs-password'] = node.obfsPassword;
    }
  }

  if (node.upMbps) {
    proxy.up = `${node.upMbps} Mbps`;
  }

  if (node.downMbps) {
    proxy.down = `${node.downMbps} Mbps`;
  }

  return proxy;
}

// Hysteria 转换
function convertHysteriaToClash(node: HysteriaNode, base: any): any {
  const proxy = {
    ...base,
    type: 'hysteria',
    'skip-cert-verify': node.allowInsecure || false,
    protocol: node.protocol || 'udp'
  };

  if (node.auth) {
    proxy.auth = node.auth;
  }

  if (node.authStr) {
    proxy['auth-str'] = node.authStr;
  }

  if (node.sni) {
    proxy.sni = node.sni;
  }

  if (node.alpn && node.alpn.length > 0) {
    proxy.alpn = node.alpn;
  }

  if (node.obfs) {
    proxy.obfs = node.obfs;
  }

  if (node.upMbps) {
    proxy.up = `${node.upMbps} Mbps`;
  }

  if (node.downMbps) {
    proxy.down = `${node.downMbps} Mbps`;
  }

  return proxy;
}

// 生成代理组
function generateProxyGroups(proxyNames: string[], options: ConversionOptions): any[] {
  const groups = [
    {
      name: '🚀 节点选择',
      type: 'select',
      proxies: ['♻️ 自动选择', '🎯 全球直连', ...proxyNames]
    },
    {
      name: '♻️ 自动选择',
      type: 'url-test',
      proxies: proxyNames,
      url: 'http://www.gstatic.com/generate_204',
      interval: 300
    },
    {
      name: '🎯 全球直连',
      type: 'select',
      proxies: ['DIRECT']
    },
    {
      name: '🛑 广告拦截',
      type: 'select',
      proxies: ['REJECT', 'DIRECT']
    },
    {
      name: '🐟 漏网之鱼',
      type: 'select',
      proxies: ['🚀 节点选择', '🎯 全球直连', ...proxyNames]
    }
  ];

  // 如果启用了分组
  if (options.grouping?.enabled) {
    const groupedProxies = groupProxiesByType(proxyNames);
    Object.entries(groupedProxies).forEach(([type, proxies]) => {
      if (proxies.length > 0) {
        groups.push({
          name: `📡 ${type.toUpperCase()}`,
          type: 'select',
          proxies: ['♻️ 自动选择', ...proxies]
        });
      }
    });
  }

  return groups;
}

// 按类型分组代理
function groupProxiesByType(proxyNames: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {
    vless: [],
    vmess: [],
    trojan: [],
    ss: [],
    hy2: [],
    hy: []
  };

  // 这里需要根据节点名称或其他信息来分组
  // 简化实现，实际应该根据节点类型来分组
  proxyNames.forEach(name => {
    if (name.toLowerCase().includes('vless')) {
      groups.vless.push(name);
    } else if (name.toLowerCase().includes('vmess')) {
      groups.vmess.push(name);
    } else if (name.toLowerCase().includes('trojan')) {
      groups.trojan.push(name);
    } else if (name.toLowerCase().includes('ss')) {
      groups.ss.push(name);
    } else {
      groups.vless.push(name); // 默认分组
    }
  });

  return groups;
}

// 解析插件选项
function parsePluginOpts(pluginOpts: string): any {
  const opts: any = {};
  const pairs = pluginOpts.split(';');
  
  pairs.forEach(pair => {
    const [key, value] = pair.split('=');
    if (key && value) {
      opts[key.trim()] = value.trim();
    }
  });
  
  return opts;
}

// 获取默认规则
function getDefaultRules(): string[] {
  return [
    'DOMAIN-SUFFIX,local,🎯 全球直连',
    'IP-CIDR,127.0.0.0/8,🎯 全球直连',
    'IP-CIDR,172.16.0.0/12,🎯 全球直连',
    'IP-CIDR,192.168.0.0/16,🎯 全球直连',
    'IP-CIDR,10.0.0.0/8,🎯 全球直连',
    'IP-CIDR,17.0.0.0/8,🎯 全球直连',
    'IP-CIDR,100.64.0.0/10,🎯 全球直连',
    'DOMAIN-SUFFIX,cn,🎯 全球直连',
    'DOMAIN-KEYWORD,baidu,🎯 全球直连',
    'DOMAIN-KEYWORD,alibaba,🎯 全球直连',
    'DOMAIN-KEYWORD,tencent,🎯 全球直连',
    'GEOIP,CN,🎯 全球直连',
    'MATCH,🚀 节点选择'
  ];
}
