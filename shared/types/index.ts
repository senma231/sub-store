// 代理协议类型
export type ProxyType = 'vless' | 'vmess' | 'trojan' | 'ss' | 'socks5' | 'hy2' | 'hy';

// 网络类型
export type NetworkType = 'tcp' | 'udp' | 'ws' | 'h2' | 'grpc' | 'quic';

// 安全类型
export type SecurityType = 'none' | 'tls' | 'reality' | 'auto';

// 加密方式
export type EncryptionType = 'none' | 'auto' | 'aes-128-gcm' | 'aes-256-gcm' | 'chacha20-poly1305';

// 基础节点接口
export interface BaseNode {
  id: string;
  name: string;
  type: ProxyType;
  server: string;
  port: number;
  enabled: boolean;
  tags?: string[];
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

// VLESS 节点
export interface VlessNode extends BaseNode {
  type: 'vless';
  uuid: string;
  encryption: EncryptionType;
  flow?: string;
  network: NetworkType;
  security: SecurityType;
  sni?: string;
  alpn?: string[];
  fingerprint?: string;
  publicKey?: string;
  shortId?: string;
  spiderX?: string;
  // WebSocket 配置
  wsPath?: string;
  wsHeaders?: Record<string, string>;
  // HTTP/2 配置
  h2Path?: string;
  h2Host?: string[];
  // gRPC 配置
  grpcServiceName?: string;
  grpcMode?: 'gun' | 'multi';
}

// VMess 节点
export interface VmessNode extends BaseNode {
  type: 'vmess';
  uuid: string;
  alterId: number;
  security: 'auto' | 'aes-128-gcm' | 'aes-256-gcm' | 'chacha20-poly1305' | 'none';
  network: NetworkType;
  tls?: boolean;
  sni?: string;
  alpn?: string[];
  // WebSocket 配置
  wsPath?: string;
  wsHeaders?: Record<string, string>;
  // HTTP/2 配置
  h2Path?: string;
  h2Host?: string[];
  // gRPC 配置
  grpcServiceName?: string;
  grpcMode?: 'gun' | 'multi';
}

// Trojan 节点
export interface TrojanNode extends BaseNode {
  type: 'trojan';
  password: string;
  sni?: string;
  alpn?: string[];
  fingerprint?: string;
  allowInsecure?: boolean;
  network?: NetworkType;
  // WebSocket 配置
  wsPath?: string;
  wsHeaders?: Record<string, string>;
  // gRPC 配置
  grpcServiceName?: string;
  grpcMode?: 'gun' | 'multi';
}

// Shadowsocks 节点
export interface ShadowsocksNode extends BaseNode {
  type: 'ss';
  method: string;
  password: string;
  plugin?: string;
  pluginOpts?: string;
}

// SOCKS5 节点
export interface Socks5Node extends BaseNode {
  type: 'socks5';
  username?: string;
  password?: string;
  tls?: boolean;
  sni?: string;
  fingerprint?: string;
}

// Hysteria2 节点
export interface Hysteria2Node extends BaseNode {
  type: 'hy2';
  password: string;
  obfs?: string;
  obfsPassword?: string;
  sni?: string;
  alpn?: string[];
  fingerprint?: string;
  allowInsecure?: boolean;
  upMbps?: number;
  downMbps?: number;
}

// Hysteria 节点
export interface HysteriaNode extends BaseNode {
  type: 'hy';
  auth?: string;
  authStr?: string;
  obfs?: string;
  protocol?: 'udp' | 'wechat-video' | 'faketcp';
  sni?: string;
  alpn?: string[];
  fingerprint?: string;
  allowInsecure?: boolean;
  upMbps?: number;
  downMbps?: number;
  recvWindowConn?: number;
  recvWindow?: number;
  disableMtuDiscovery?: boolean;
}

// 联合类型
export type ProxyNode = VlessNode | VmessNode | TrojanNode | ShadowsocksNode | Socks5Node | Hysteria2Node | HysteriaNode;

// 订阅配置
export interface SubscriptionConfig {
  id: string;
  name: string;
  description?: string;
  nodeIds: string[];
  filters?: NodeFilter[];
  rules?: NodeRule[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// 节点过滤器
export interface NodeFilter {
  type: 'include' | 'exclude';
  field: 'name' | 'server' | 'tags' | 'type';
  operator: 'contains' | 'equals' | 'regex' | 'startsWith' | 'endsWith';
  value: string;
}

// 节点规则
export interface NodeRule {
  type: 'rename' | 'sort' | 'group';
  pattern?: string;
  replacement?: string;
  order?: 'asc' | 'desc';
  groupBy?: 'type' | 'tags' | 'server';
}

// 客户端格式类型
export type ClientFormat = 'v2ray' | 'clash' | 'shadowrocket' | 'quantumult-x' | 'surge' | 'base64';

// API 响应
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 分页参数
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 分页响应
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 统计信息
export interface Statistics {
  totalNodes: number;
  totalSubscriptions: number;
  totalRequests: number;
  activeNodes: number;
  requestsByFormat: Record<ClientFormat, number>;
  requestsByDate: Record<string, number>;
  topNodes: Array<{ nodeId: string; requests: number }>;
}

// 节点健康检查结果
export interface NodeHealthCheck {
  nodeId: string;
  status: 'online' | 'offline' | 'timeout' | 'error';
  latency?: number;
  lastCheck: string;
  error?: string;
}

// 用户认证
export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
  permissions: string[];
  createdAt: string;
  lastLogin?: string;
}

// JWT 载荷
export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
  iat: number;
  exp: number;
}
