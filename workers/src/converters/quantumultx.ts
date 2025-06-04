import { ProxyNode, VlessNode, VmessNode, TrojanNode, ShadowsocksNode } from '../../../shared/types';

// 转换为 Quantumult X 配置
export function toQuantumultXConfig(nodes: ProxyNode[]): string {
  const proxies = nodes.map(node => convertNodeToQuantumultX(node)).filter(Boolean);
  
  const config = [
    '[server_local]',
    ...proxies,
    '',
    '[filter_local]',
    'host-suffix, local, direct',
    'ip-cidr, 192.168.0.0/16, direct',
    'ip-cidr, 10.0.0.0/8, direct',
    'ip-cidr, 172.16.0.0/12, direct',
    'ip-cidr, 127.0.0.0/8, direct',
    'ip-cidr, 100.64.0.0/10, direct',
    'ip-cidr, 224.0.0.0/4, direct',
    'ip6-cidr, fe80::/10, direct',
    'geoip, cn, direct',
    'final, proxy',
    '',
    '[rewrite_local]',
    '',
    '[task_local]',
    '',
    '[http_backend]',
    '',
    '[mitm]'
  ];
  
  return config.join('\n');
}

// 将节点转换为 Quantumult X 格式
function convertNodeToQuantumultX(node: ProxyNode): string {
  switch (node.type) {
    case 'vmess':
      return buildVmessProxy(node as VmessNode);
    case 'trojan':
      return buildTrojanProxy(node as TrojanNode);
    case 'ss':
      return buildShadowsocksProxy(node as ShadowsocksNode);
    default:
      return '';
  }
}

// 构建 VMess 代理
function buildVmessProxy(node: VmessNode): string {
  const parts = [
    `vmess=${node.server}:${node.port}`,
    `method=${node.security}`,
    `password=${node.uuid}`,
    `tag=${node.name}`
  ];
  
  if (node.network === 'ws') {
    parts.push('obfs=ws');
    if (node.wsPath) {
      parts.push(`obfs-uri=${node.wsPath}`);
    }
    if (node.wsHeaders?.Host) {
      parts.push(`obfs-host=${node.wsHeaders.Host}`);
    }
  } else if (node.network === 'h2') {
    parts.push('obfs=h2');
    if (node.h2Path) {
      parts.push(`obfs-uri=${node.h2Path}`);
    }
    if (node.h2Host && node.h2Host.length > 0) {
      parts.push(`obfs-host=${node.h2Host[0]}`);
    }
  }
  
  if (node.tls) {
    parts.push('obfs=over-tls');
    if (node.sni) {
      parts.push(`tls-host=${node.sni}`);
    }
  }
  
  return parts.join(', ');
}

// 构建 Trojan 代理
function buildTrojanProxy(node: TrojanNode): string {
  const parts = [
    `trojan=${node.server}:${node.port}`,
    `password=${node.password}`,
    `tag=${node.name}`
  ];
  
  if (node.sni) {
    parts.push(`tls-host=${node.sni}`);
  }
  
  if (node.allowInsecure) {
    parts.push('tls-verification=false');
  }
  
  if (node.network === 'ws') {
    parts.push('obfs=ws');
    if (node.wsPath) {
      parts.push(`obfs-uri=${node.wsPath}`);
    }
    if (node.wsHeaders?.Host) {
      parts.push(`obfs-host=${node.wsHeaders.Host}`);
    }
  }
  
  return parts.join(', ');
}

// 构建 Shadowsocks 代理
function buildShadowsocksProxy(node: ShadowsocksNode): string {
  const parts = [
    `shadowsocks=${node.server}:${node.port}`,
    `method=${node.method}`,
    `password=${node.password}`,
    `tag=${node.name}`
  ];
  
  if (node.plugin) {
    if (node.plugin === 'obfs-local') {
      parts.push('obfs=http');
      if (node.pluginOpts?.includes('obfs-host=')) {
        const host = node.pluginOpts.match(/obfs-host=([^;]+)/)?.[1];
        if (host) {
          parts.push(`obfs-host=${host}`);
        }
      }
    } else if (node.plugin === 'v2ray-plugin') {
      if (node.pluginOpts?.includes('mode=websocket')) {
        parts.push('obfs=ws');
        if (node.pluginOpts.includes('path=')) {
          const path = node.pluginOpts.match(/path=([^;]+)/)?.[1];
          if (path) {
            parts.push(`obfs-uri=${path}`);
          }
        }
        if (node.pluginOpts.includes('host=')) {
          const host = node.pluginOpts.match(/host=([^;]+)/)?.[1];
          if (host) {
            parts.push(`obfs-host=${host}`);
          }
        }
      }
    }
  }
  
  return parts.join(', ');
}
