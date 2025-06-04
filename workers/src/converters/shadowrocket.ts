import { ProxyNode, VlessNode, VmessNode, TrojanNode, ShadowsocksNode } from '../../../shared/types';

// 转换为 Shadowrocket 配置
export function toShadowrocketConfig(nodes: ProxyNode[]): string {
  const links = nodes.map(node => convertNodeToShadowrocketLink(node)).filter(Boolean);
  return btoa(links.join('\n'));
}

// 将节点转换为 Shadowrocket 链接
function convertNodeToShadowrocketLink(node: ProxyNode): string {
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
  
  params.set('type', node.network);
  
  // 网络特定参数
  if (node.network === 'ws') {
    if (node.wsPath) params.set('path', node.wsPath);
    if (node.wsHeaders?.Host) params.set('host', node.wsHeaders.Host);
  } else if (node.network === 'h2') {
    if (node.h2Path) params.set('path', node.h2Path);
    if (node.h2Host && node.h2Host.length > 0) {
      params.set('host', node.h2Host.join(','));
    }
  } else if (node.network === 'grpc') {
    if (node.grpcServiceName) params.set('serviceName', node.grpcServiceName);
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
    sni: node.sni || ''
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
