import { ProxyNode, ProxyType } from '../../../shared/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// 验证节点数据
export function validateNode(node: any): ValidationResult {
  const errors: string[] = [];
  
  // 基础字段验证
  if (!node.name || typeof node.name !== 'string' || node.name.trim().length === 0) {
    errors.push('Node name is required and must be a non-empty string');
  }
  
  if (!node.server || typeof node.server !== 'string' || node.server.trim().length === 0) {
    errors.push('Server address is required and must be a non-empty string');
  }
  
  if (!node.port || typeof node.port !== 'number' || node.port < 1 || node.port > 65535) {
    errors.push('Port must be a number between 1 and 65535');
  }
  
  if (!node.type || !isValidProxyType(node.type)) {
    errors.push('Invalid proxy type. Supported types: vless, vmess, trojan, ss, socks5, hy2, hy');
  }
  
  // 类型特定验证
  if (node.type) {
    switch (node.type) {
      case 'vless':
        validateVlessNode(node, errors);
        break;
      case 'vmess':
        validateVmessNode(node, errors);
        break;
      case 'trojan':
        validateTrojanNode(node, errors);
        break;
      case 'ss':
        validateShadowsocksNode(node, errors);
        break;
      case 'socks5':
        validateSocks5Node(node, errors);
        break;
      case 'hy2':
        validateHysteria2Node(node, errors);
        break;
      case 'hy':
        validateHysteriaNode(node, errors);
        break;
    }
  }
  
  // 网络类型验证
  if (node.network && !isValidNetworkType(node.network)) {
    errors.push('Invalid network type. Supported types: tcp, udp, ws, h2, grpc, quic');
  }
  
  // 安全类型验证
  if (node.security && !isValidSecurityType(node.security)) {
    errors.push('Invalid security type. Supported types: none, tls, reality, auto');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

// 验证 VLESS 节点
function validateVlessNode(node: any, errors: string[]): void {
  if (!node.uuid || typeof node.uuid !== 'string' || !isValidUUID(node.uuid)) {
    errors.push('Valid UUID is required for VLESS node');
  }
  
  if (node.encryption && !isValidEncryption(node.encryption)) {
    errors.push('Invalid encryption type for VLESS node');
  }
  
  if (node.flow && typeof node.flow !== 'string') {
    errors.push('Flow must be a string');
  }
  
  validateNetworkSettings(node, errors);
}

// 验证 VMess 节点
function validateVmessNode(node: any, errors: string[]): void {
  if (!node.uuid || typeof node.uuid !== 'string' || !isValidUUID(node.uuid)) {
    errors.push('Valid UUID is required for VMess node');
  }
  
  if (node.alterId !== undefined && (typeof node.alterId !== 'number' || node.alterId < 0)) {
    errors.push('AlterId must be a non-negative number');
  }
  
  if (node.security && !isValidVmessSecurity(node.security)) {
    errors.push('Invalid security type for VMess node');
  }
  
  validateNetworkSettings(node, errors);
}

// 验证 Trojan 节点
function validateTrojanNode(node: any, errors: string[]): void {
  if (!node.password || typeof node.password !== 'string' || node.password.trim().length === 0) {
    errors.push('Password is required for Trojan node');
  }
  
  validateNetworkSettings(node, errors);
}

// 验证 Shadowsocks 节点
function validateShadowsocksNode(node: any, errors: string[]): void {
  if (!node.method || typeof node.method !== 'string') {
    errors.push('Encryption method is required for Shadowsocks node');
  }
  
  if (!node.password || typeof node.password !== 'string' || node.password.trim().length === 0) {
    errors.push('Password is required for Shadowsocks node');
  }
  
  if (node.plugin && typeof node.plugin !== 'string') {
    errors.push('Plugin must be a string');
  }
  
  if (node.pluginOpts && typeof node.pluginOpts !== 'string') {
    errors.push('Plugin options must be a string');
  }
}

// 验证 SOCKS5 节点
function validateSocks5Node(node: any, errors: string[]): void {
  if (node.username && typeof node.username !== 'string') {
    errors.push('Username must be a string');
  }
  
  if (node.password && typeof node.password !== 'string') {
    errors.push('Password must be a string');
  }
}

// 验证 Hysteria2 节点
function validateHysteria2Node(node: any, errors: string[]): void {
  if (!node.password || typeof node.password !== 'string' || node.password.trim().length === 0) {
    errors.push('Password is required for Hysteria2 node');
  }
  
  if (node.obfs && typeof node.obfs !== 'string') {
    errors.push('Obfs must be a string');
  }
  
  if (node.upMbps && (typeof node.upMbps !== 'number' || node.upMbps <= 0)) {
    errors.push('Upload speed must be a positive number');
  }
  
  if (node.downMbps && (typeof node.downMbps !== 'number' || node.downMbps <= 0)) {
    errors.push('Download speed must be a positive number');
  }
}

// 验证 Hysteria 节点
function validateHysteriaNode(node: any, errors: string[]): void {
  if (node.auth && typeof node.auth !== 'string') {
    errors.push('Auth must be a string');
  }
  
  if (node.authStr && typeof node.authStr !== 'string') {
    errors.push('AuthStr must be a string');
  }
  
  if (node.protocol && !['udp', 'wechat-video', 'faketcp'].includes(node.protocol)) {
    errors.push('Invalid protocol for Hysteria node');
  }
  
  if (node.upMbps && (typeof node.upMbps !== 'number' || node.upMbps <= 0)) {
    errors.push('Upload speed must be a positive number');
  }
  
  if (node.downMbps && (typeof node.downMbps !== 'number' || node.downMbps <= 0)) {
    errors.push('Download speed must be a positive number');
  }
}

// 验证网络设置
function validateNetworkSettings(node: any, errors: string[]): void {
  if (node.network === 'ws') {
    if (node.wsPath && typeof node.wsPath !== 'string') {
      errors.push('WebSocket path must be a string');
    }
    
    if (node.wsHeaders && typeof node.wsHeaders !== 'object') {
      errors.push('WebSocket headers must be an object');
    }
  }
  
  if (node.network === 'h2') {
    if (node.h2Path && typeof node.h2Path !== 'string') {
      errors.push('HTTP/2 path must be a string');
    }
    
    if (node.h2Host && !Array.isArray(node.h2Host)) {
      errors.push('HTTP/2 host must be an array');
    }
  }
  
  if (node.network === 'grpc') {
    if (node.grpcServiceName && typeof node.grpcServiceName !== 'string') {
      errors.push('gRPC service name must be a string');
    }
    
    if (node.grpcMode && !['gun', 'multi'].includes(node.grpcMode)) {
      errors.push('Invalid gRPC mode');
    }
  }
  
  if (node.sni && typeof node.sni !== 'string') {
    errors.push('SNI must be a string');
  }
  
  if (node.alpn && !Array.isArray(node.alpn)) {
    errors.push('ALPN must be an array');
  }
}

// 辅助验证函数
function isValidProxyType(type: string): type is ProxyType {
  return ['vless', 'vmess', 'trojan', 'ss', 'socks5', 'hy2', 'hy'].includes(type);
}

function isValidNetworkType(network: string): boolean {
  return ['tcp', 'udp', 'ws', 'h2', 'grpc', 'quic'].includes(network);
}

function isValidSecurityType(security: string): boolean {
  return ['none', 'tls', 'reality', 'auto'].includes(security);
}

function isValidEncryption(encryption: string): boolean {
  return ['none', 'auto', 'aes-128-gcm', 'aes-256-gcm', 'chacha20-poly1305'].includes(encryption);
}

function isValidVmessSecurity(security: string): boolean {
  return ['auto', 'aes-128-gcm', 'aes-256-gcm', 'chacha20-poly1305', 'none'].includes(security);
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}
