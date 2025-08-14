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

// D1 数据库相关类型

// 数据库用户表
export interface DbUser {
  id: string;
  username: string;
  password: string;
  role: string;
  email?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  enabled: boolean;
}

// 数据库节点表
export interface DbNode {
  id: string;
  name: string;
  type: ProxyType;
  server: string;
  port: number;
  enabled: boolean;
  tags?: string; // JSON 字符串
  remark?: string;

  // 认证配置
  uuid?: string;
  encryption?: string;
  flow?: string;
  alter_id?: number;
  security?: string;
  password?: string;
  method?: string;
  username?: string;

  // 网络配置
  network?: string;
  tls?: boolean;
  sni?: string;
  alpn?: string; // JSON 字符串
  fingerprint?: string;
  allow_insecure?: boolean;

  // WebSocket 配置
  ws_path?: string;
  ws_headers?: string; // JSON 字符串

  // HTTP/2 配置
  h2_path?: string;
  h2_host?: string; // JSON 字符串

  // gRPC 配置
  grpc_service_name?: string;
  grpc_mode?: string;

  // 插件配置
  plugin?: string;
  plugin_opts?: string;

  // Hysteria 配置
  obfs?: string;
  obfs_password?: string;
  up_mbps?: number;
  down_mbps?: number;
  auth?: string;
  auth_str?: string;
  protocol?: string;

  // 统计信息
  total_requests: number;
  last_used?: string;

  // 时间戳
  created_at: string;
  updated_at: string;
}

// 数据库订阅表
export interface DbSubscription {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;

  // 过滤配置
  include_types?: string; // JSON 字符串
  exclude_types?: string; // JSON 字符串
  include_keywords?: string; // JSON 字符串
  exclude_keywords?: string; // JSON 字符串

  // 排序和分组
  sort_by: string;
  sort_order: string;
  group_enabled: boolean;
  group_by: string;

  // 重命名规则
  rename_rules?: string; // JSON 字符串

  // 统计信息
  total_requests: number;
  last_accessed?: string;

  // 时间戳
  created_at: string;
  updated_at: string;
}

// 访问日志表
export interface DbAccessLog {
  id: number;
  type: string;
  endpoint: string;
  method: string;
  user_agent?: string;
  ip_address?: string;
  referer?: string;
  subscription_format?: string;
  node_count?: number;
  status_code?: number;
  response_time?: number;
  created_at: string;
}

// 系统设置表
export interface DbSetting {
  key: string;
  value: string;
  description?: string;
  type: string;
  updated_at: string;
}

// 会话表
export interface DbSession {
  id: string;
  user_id: string;
  token: string;
  expires_at: string;
  created_at: string;
}

// 数据库操作结果
export interface DbResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    changes?: number;
    duration?: number;
    rows_read?: number;
    rows_written?: number;
  };
}

// 流量管理相关类型
export interface TrafficStats {
  limit: number;           // 流量限制(字节)
  used: number;           // 已使用流量(字节)
  remaining: number;      // 剩余流量(字节)
  percentage: number;     // 使用百分比
  resetDate: string;      // 下次重置日期
  resetCycle: string;     // 重置周期
  enabled: boolean;       // 是否启用限制
}

export interface TrafficSettings {
  enabled: boolean;       // 是否启用流量限制
  limit: number;         // 流量限制(字节)
  resetCycle: string;    // 重置周期: daily/weekly/monthly/manual
}

export type TrafficResetCycle = 'daily' | 'weekly' | 'monthly' | 'manual';

// 流量管理组件属性（注意：CustomSubscription类型在前端定义）
export interface TrafficManagementProps {
  subscription: any; // 使用any类型避免循环依赖，实际类型为CustomSubscription
  onUpdate?: () => void;
}
