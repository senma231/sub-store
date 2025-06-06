// 简化的节点类型定义
export interface SimpleNode {
  id: string;
  name: string;
  type: 'vless' | 'vmess' | 'trojan' | 'ss' | 'socks5' | 'hy2' | 'hy';
  server: string;
  port: number;
  enabled: boolean;
  remark?: string;
  createdAt: string;
  updatedAt: string;
  // 协议特定字段
  uuid?: string;
  password?: string;
  method?: string;
  [key: string]: any;
}

// 环境变量类型
export interface Env extends Record<string, unknown> {
  DB: D1Database;
  ADMIN_TOKEN: string;
  JWT_SECRET: string;
  CLOUDFLARE_API_TOKEN?: string;
  ENVIRONMENT: string;
  APP_NAME: string;
  CORS_ORIGINS: string;
}
