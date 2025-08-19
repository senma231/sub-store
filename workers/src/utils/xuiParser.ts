/**
 * X-UI节点配置解析器
 * 将X-UI的inbound配置转换为Sub-Store标准节点格式
 */

import type { XUIInbound } from './xuiConnector';
import type { ProxyNode } from '../database';

export interface ParsedNode extends ProxyNode {
  // 扩展字段
  xuiId?: number;
  xuiTag?: string;
  xuiRemark?: string;
}

export class XUIParser {
  /**
   * 解析X-UI inbound配置为标准节点
   */
  static parseInbound(inbound: XUIInbound, panelHost: string): ParsedNode | null {
    try {
      console.log(`🔍 [X-UI解析器] 解析入站配置: ${inbound.protocol}:${inbound.port} - ${inbound.remark}`);

      // 基础节点信息
      const baseNode: Partial<ParsedNode> = {
        id: `xui-${inbound.id}-${Date.now()}`,
        name: inbound.remark || `${inbound.protocol}-${inbound.port}`,
        type: this.mapProtocol(inbound.protocol),
        server: panelHost,
        port: inbound.port,
        enabled: inbound.enable,
        tags: ['x-ui', inbound.protocol],
        remark: `从X-UI面板导入 - ${inbound.remark || inbound.tag}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        xuiId: inbound.id,
        xuiTag: inbound.tag,
        xuiRemark: inbound.remark
      };

      // 解析协议特定配置
      const protocolConfig = this.parseProtocolConfig(inbound);
      if (!protocolConfig) {
        console.warn(`⚠️ [X-UI解析器] 不支持的协议或配置解析失败: ${inbound.protocol}`);
        return null;
      }

      // 解析传输配置
      const streamConfig = this.parseStreamConfig(inbound.streamSettings);

      // 合并所有配置
      const node: ParsedNode = {
        ...baseNode,
        ...protocolConfig,
        ...streamConfig
      } as ParsedNode;

      console.log(`✅ [X-UI解析器] 节点解析成功: ${node.name}`);
      return node;

    } catch (error) {
      console.error(`❌ [X-UI解析器] 解析失败:`, error);
      return null;
    }
  }

  /**
   * 映射协议名称
   */
  private static mapProtocol(xuiProtocol: string): string {
    const protocolMap: Record<string, string> = {
      'vmess': 'vmess',
      'vless': 'vless',
      'trojan': 'trojan',
      'shadowsocks': 'ss',
      'socks': 'socks5',
      'http': 'http'
    };

    return protocolMap[xuiProtocol.toLowerCase()] || xuiProtocol;
  }

  /**
   * 解析协议特定配置
   */
  private static parseProtocolConfig(inbound: XUIInbound): any {
    try {
      const settings = JSON.parse(inbound.settings || '{}');
      const protocol = inbound.protocol.toLowerCase();

      switch (protocol) {
        case 'vmess':
          return this.parseVMessConfig(settings);
        case 'vless':
          return this.parseVLESSConfig(settings);
        case 'trojan':
          return this.parseTrojanConfig(settings);
        case 'shadowsocks':
          return this.parseShadowsocksConfig(settings);
        case 'socks':
          return this.parseSocksConfig(settings);
        default:
          console.warn(`⚠️ [X-UI解析器] 未知协议: ${protocol}`);
          return null;
      }
    } catch (error) {
      console.error(`❌ [X-UI解析器] 协议配置解析失败:`, error);
      return null;
    }
  }

  /**
   * 解析VMess配置
   */
  private static parseVMessConfig(settings: any): any {
    const clients = settings.clients || [];
    if (clients.length === 0) {
      console.warn(`⚠️ [X-UI解析器] VMess配置中没有客户端`);
      return null;
    }

    const client = clients[0]; // 使用第一个客户端
    return {
      uuid: client.id,
      alterId: client.alterId || 0,
      security: 'auto'
    };
  }

  /**
   * 解析VLESS配置
   */
  private static parseVLESSConfig(settings: any): any {
    const clients = settings.clients || [];
    if (clients.length === 0) {
      console.warn(`⚠️ [X-UI解析器] VLESS配置中没有客户端`);
      return null;
    }

    const client = clients[0]; // 使用第一个客户端
    return {
      uuid: client.id,
      encryption: 'none',
      flow: client.flow || ''
    };
  }

  /**
   * 解析Trojan配置
   */
  private static parseTrojanConfig(settings: any): any {
    const clients = settings.clients || [];
    if (clients.length === 0) {
      console.warn(`⚠️ [X-UI解析器] Trojan配置中没有客户端`);
      return null;
    }

    const client = clients[0]; // 使用第一个客户端
    return {
      password: client.password
    };
  }

  /**
   * 解析Shadowsocks配置
   */
  private static parseShadowsocksConfig(settings: any): any {
    return {
      method: settings.method || 'aes-256-gcm',
      password: settings.password || ''
    };
  }

  /**
   * 解析Socks配置
   */
  private static parseSocksConfig(settings: any): any {
    const accounts = settings.accounts || [];
    if (accounts.length > 0) {
      const account = accounts[0];
      return {
        username: account.user,
        password: account.pass
      };
    }
    return {};
  }

  /**
   * 解析传输配置
   */
  private static parseStreamConfig(streamSettings: string): any {
    try {
      const stream = JSON.parse(streamSettings || '{}');
      const config: any = {
        network: stream.network || 'tcp',
        security: stream.security || 'none'
      };

      // TLS配置
      if (stream.security === 'tls' || stream.security === 'reality') {
        const tlsSettings = stream.tlsSettings || stream.realitySettings || {};
        config.tls = true;
        config.sni = tlsSettings.serverName || '';
        config.alpn = tlsSettings.alpn || [];
        config.fingerprint = tlsSettings.fingerprint || '';
        config.allowInsecure = tlsSettings.allowInsecure || false;
      }

      // 传输协议特定配置
      switch (stream.network) {
        case 'ws':
          const wsSettings = stream.wsSettings || {};
          config.wsPath = wsSettings.path || '/';
          config.wsHeaders = wsSettings.headers || {};
          break;

        case 'h2':
          const h2Settings = stream.httpSettings || {};
          config.h2Path = h2Settings.path || '/';
          config.h2Host = h2Settings.host || [];
          break;

        case 'grpc':
          const grpcSettings = stream.grpcSettings || {};
          config.grpcServiceName = grpcSettings.serviceName || '';
          config.grpcMode = grpcSettings.multiMode ? 'multi' : 'gun';
          break;

        case 'kcp':
          const kcpSettings = stream.kcpSettings || {};
          config.kcpType = kcpSettings.header?.type || 'none';
          config.kcpSeed = kcpSettings.seed || '';
          break;

        case 'quic':
          const quicSettings = stream.quicSettings || {};
          config.quicSecurity = quicSettings.security || 'none';
          config.quicKey = quicSettings.key || '';
          config.quicType = quicSettings.header?.type || 'none';
          break;
      }

      return config;

    } catch (error) {
      console.error(`❌ [X-UI解析器] 传输配置解析失败:`, error);
      return {
        network: 'tcp',
        security: 'none'
      };
    }
  }

  /**
   * 批量解析多个inbound配置
   */
  static parseInbounds(inbounds: XUIInbound[], panelHost: string): ParsedNode[] {
    const nodes: ParsedNode[] = [];
    
    console.log(`🔄 [X-UI解析器] 开始批量解析 ${inbounds.length} 个入站配置`);

    for (const inbound of inbounds) {
      // 只解析启用的入站配置
      if (!inbound.enable) {
        console.log(`⏭️ [X-UI解析器] 跳过已禁用的入站: ${inbound.remark || inbound.tag}`);
        continue;
      }

      const node = this.parseInbound(inbound, panelHost);
      if (node) {
        nodes.push(node);
      }
    }

    console.log(`✅ [X-UI解析器] 批量解析完成，成功解析 ${nodes.length} 个节点`);
    return nodes;
  }

  /**
   * 验证节点配置完整性
   */
  static validateNode(node: ParsedNode): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 基础字段验证
    if (!node.name) errors.push('节点名称不能为空');
    if (!node.type) errors.push('节点类型不能为空');
    if (!node.server) errors.push('服务器地址不能为空');
    if (!node.port || node.port < 1 || node.port > 65535) {
      errors.push('端口号必须在1-65535之间');
    }

    // 协议特定验证
    switch (node.type) {
      case 'vmess':
      case 'vless':
        if (!node.uuid) errors.push('UUID不能为空');
        break;
      case 'trojan':
        if (!node.password) errors.push('密码不能为空');
        break;
      case 'ss':
        if (!node.method) errors.push('加密方法不能为空');
        if (!node.password) errors.push('密码不能为空');
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
