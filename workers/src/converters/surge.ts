import { ProxyNode, VmessNode, TrojanNode, ShadowsocksNode } from '../../../shared/types';
import { ConversionOptions } from './index';

// 转换为 Surge 配置
export function toSurgeConfig(nodes: ProxyNode[], options: ConversionOptions = {}): string {
  const proxies = nodes.map(node => convertNodeToSurge(node)).filter(Boolean);
  const proxyNames = nodes.map(node => node.name);
  
  const config = [
    '[General]',
    'loglevel = notify',
    'internet-test-url = http://www.gstatic.com/generate_204',
    'proxy-test-url = http://www.gstatic.com/generate_204',
    'test-timeout = 5',
    'dns-server = 223.5.5.5, 119.29.29.29',
    'encrypted-dns-server = https://doh.pub/dns-query',
    'skip-proxy = 127.0.0.1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, localhost, *.local',
    'exclude-simple-hostnames = true',
    '',
    '[Proxy]',
    ...proxies,
    '',
    '[Proxy Group]',
    `🚀 节点选择 = select, ${proxyNames.join(', ')}`,
    `♻️ 自动选择 = url-test, ${proxyNames.join(', ')}, url = http://www.gstatic.com/generate_204, interval = 300`,
    '🎯 全球直连 = select, DIRECT',
    '🛑 广告拦截 = select, REJECT, DIRECT',
    `🐟 漏网之鱼 = select, 🚀 节点选择, 🎯 全球直连, ${proxyNames.join(', ')}`,
    '',
    '[Rule]',
    ...getDefaultSurgeRules(),
    ''
  ];
  
  return config.join('\n');
}

// 将节点转换为 Surge 格式
function convertNodeToSurge(node: ProxyNode): string {
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
    `${node.name} = vmess`,
    node.server,
    node.port.toString(),
    `username=${node.uuid}`
  ];
  
  if (node.network === 'ws') {
    parts.push('ws=true');
    if (node.wsPath) {
      parts.push(`ws-path=${node.wsPath}`);
    }
    if (node.wsHeaders?.Host) {
      parts.push(`ws-headers=Host:${node.wsHeaders.Host}`);
    }
  }
  
  if (node.tls) {
    parts.push('tls=true');
    if (node.sni) {
      parts.push(`sni=${node.sni}`);
    }
  }
  
  if (node.security && node.security !== 'auto') {
    parts.push(`encrypt-method=${node.security}`);
  }
  
  return parts.join(', ');
}

// 构建 Trojan 代理
function buildTrojanProxy(node: TrojanNode): string {
  const parts = [
    `${node.name} = trojan`,
    node.server,
    node.port.toString(),
    `password=${node.password}`
  ];
  
  if (node.sni) {
    parts.push(`sni=${node.sni}`);
  }
  
  if (node.allowInsecure) {
    parts.push('skip-cert-verify=true');
  }
  
  if (node.network === 'ws') {
    parts.push('ws=true');
    if (node.wsPath) {
      parts.push(`ws-path=${node.wsPath}`);
    }
    if (node.wsHeaders?.Host) {
      parts.push(`ws-headers=Host:${node.wsHeaders.Host}`);
    }
  }
  
  return parts.join(', ');
}

// 构建 Shadowsocks 代理
function buildShadowsocksProxy(node: ShadowsocksNode): string {
  const parts = [
    `${node.name} = ss`,
    node.server,
    node.port.toString(),
    `encrypt-method=${node.method}`,
    `password=${node.password}`
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

// 获取默认 Surge 规则
function getDefaultSurgeRules(): string[] {
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
    'FINAL,🚀 节点选择'
  ];
}
