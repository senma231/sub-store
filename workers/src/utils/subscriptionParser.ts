/**
 * 订阅内容解析工具
 * 支持解析各种格式的订阅链接内容
 */

export interface ParsedNode {
  id: string;
  name: string;
  type: string;
  server: string;
  port: number;
  enabled: boolean;
  [key: string]: any;
}

/**
 * 解析订阅内容
 * @param content 订阅内容（Base64编码或纯文本）
 * @returns 解析后的节点列表
 */
export function parseSubscriptionContent(content: string): ParsedNode[] {
  if (!content || !content.trim()) {
    return [];
  }

  let lines: string[] = [];

  try {
    // 尝试Base64解码
    const decoded = atob(content.trim());
    lines = decoded.split('\n').filter(line => line.trim());
  } catch {
    // 如果Base64解码失败，直接按行分割
    lines = content.split('\n').filter(line => line.trim());
  }

  const nodes: ParsedNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    try {
      const node = parseNodeLink(line, i);
      if (node) {
        nodes.push(node);
      }
    } catch (error) {
      console.warn(`Failed to parse line ${i + 1}: ${line}`, error);
    }
  }

  return nodes;
}

/**
 * 解析单个节点链接
 * @param link 节点链接
 * @param index 索引
 * @returns 解析后的节点对象
 */
function parseNodeLink(link: string, index: number): ParsedNode | null {
  if (!link || !link.includes('://')) {
    return null;
  }

  try {
    const url = new URL(link);
    const protocol = url.protocol.replace(':', '');

    switch (protocol) {
      case 'vless':
        return parseVlessNode(url, index);
      case 'vmess':
        return parseVmessNode(link, index);
      case 'trojan':
        return parseTrojanNode(url, index);
      case 'ss':
        return parseShadowsocksNode(url, index);
      case 'socks5':
        return parseSocks5Node(url, index);
      case 'hy2':
        return parseHysteria2Node(url, index);
      case 'hysteria':
        return parseHysteriaNode(url, index);
      default:
        console.warn(`Unsupported protocol: ${protocol}`);
        return null;
    }
  } catch (error) {
    console.warn(`Failed to parse node link: ${link}`, error);
    return null;
  }
}

/**
 * 解析VLESS节点
 */
function parseVlessNode(url: URL, index: number): ParsedNode {
  const params = new URLSearchParams(url.search);
  
  return {
    id: `vless-${Date.now()}-${index}`,
    name: decodeURIComponent(url.hash.slice(1)) || `VLESS-${index + 1}`,
    type: 'vless',
    server: url.hostname,
    port: parseInt(url.port) || 443,
    uuid: url.username,
    flow: params.get('flow') || '',
    encryption: params.get('encryption') || 'none',
    network: params.get('type') || 'tcp',
    tls: params.get('security') === 'tls',
    sni: params.get('sni') || '',
    alpn: params.get('alpn') || '',
    fingerprint: params.get('fp') || '',
    enabled: true,
  };
}

/**
 * 解析VMess节点
 */
function parseVmessNode(link: string, index: number): ParsedNode {
  try {
    // VMess链接格式: vmess://base64(json)
    const base64Data = link.replace('vmess://', '');
    const jsonStr = atob(base64Data);
    const config = JSON.parse(jsonStr);

    return {
      id: `vmess-${Date.now()}-${index}`,
      name: config.ps || `VMess-${index + 1}`,
      type: 'vmess',
      server: config.add,
      port: parseInt(config.port) || 443,
      uuid: config.id,
      alterId: parseInt(config.aid) || 0,
      cipher: config.scy || 'auto',
      network: config.net || 'tcp',
      tls: config.tls === 'tls',
      sni: config.sni || '',
      enabled: true,
    };
  } catch (error) {
    throw new Error(`Invalid VMess format: ${error}`);
  }
}

/**
 * 解析Trojan节点
 */
function parseTrojanNode(url: URL, index: number): ParsedNode {
  const params = new URLSearchParams(url.search);
  
  return {
    id: `trojan-${Date.now()}-${index}`,
    name: decodeURIComponent(url.hash.slice(1)) || `Trojan-${index + 1}`,
    type: 'trojan',
    server: url.hostname,
    port: parseInt(url.port) || 443,
    password: url.username,
    sni: params.get('sni') || url.hostname,
    alpn: params.get('alpn') || '',
    fingerprint: params.get('fp') || '',
    enabled: true,
  };
}

/**
 * 解析Shadowsocks节点
 */
function parseShadowsocksNode(url: URL, index: number): ParsedNode {
  let method = '';
  let password = '';

  try {
    // SS链接格式: ss://base64(method:password)@server:port#name
    const base64Data = url.username;
    const decoded = atob(base64Data);
    const [methodPart, passwordPart] = decoded.split(':');
    method = methodPart;
    password = passwordPart;
  } catch {
    // 如果Base64解码失败，尝试直接解析
    method = url.username.split(':')[0] || 'aes-256-gcm';
    password = url.password || '';
  }

  return {
    id: `ss-${Date.now()}-${index}`,
    name: decodeURIComponent(url.hash.slice(1)) || `SS-${index + 1}`,
    type: 'shadowsocks',
    server: url.hostname,
    port: parseInt(url.port) || 443,
    method,
    password,
    enabled: true,
  };
}

/**
 * 解析SOCKS5节点
 */
function parseSocks5Node(url: URL, index: number): ParsedNode {
  return {
    id: `socks5-${Date.now()}-${index}`,
    name: decodeURIComponent(url.hash.slice(1)) || `SOCKS5-${index + 1}`,
    type: 'socks5',
    server: url.hostname,
    port: parseInt(url.port) || 1080,
    username: url.username || '',
    password: url.password || '',
    enabled: true,
  };
}

/**
 * 解析Hysteria2节点
 */
function parseHysteria2Node(url: URL, index: number): ParsedNode {
  const params = new URLSearchParams(url.search);
  
  return {
    id: `hy2-${Date.now()}-${index}`,
    name: decodeURIComponent(url.hash.slice(1)) || `HY2-${index + 1}`,
    type: 'hysteria2',
    server: url.hostname,
    port: parseInt(url.port) || 443,
    password: url.username,
    sni: params.get('sni') || '',
    insecure: params.get('insecure') === '1',
    enabled: true,
  };
}

/**
 * 解析Hysteria节点
 */
function parseHysteriaNode(url: URL, index: number): ParsedNode {
  const params = new URLSearchParams(url.search);
  
  return {
    id: `hysteria-${Date.now()}-${index}`,
    name: decodeURIComponent(url.hash.slice(1)) || `Hysteria-${index + 1}`,
    type: 'hysteria',
    server: url.hostname,
    port: parseInt(url.port) || 443,
    auth: url.username,
    protocol: params.get('protocol') || 'udp',
    upmbps: parseInt(params.get('upmbps') || '10'),
    downmbps: parseInt(params.get('downmbps') || '50'),
    sni: params.get('peer') || '',
    insecure: params.get('insecure') === '1',
    enabled: true,
  };
}
