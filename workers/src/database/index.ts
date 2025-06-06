// 基础类型定义
export interface DbResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: any;
}

export interface ProxyNode {
  id: string;
  name: string;
  type: string;
  server: string;
  port: number;
  enabled: boolean;
  tags?: string[];
  remark?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DbNode {
  id: string;
  name: string;
  type: string;
  server: string;
  port: number;
  enabled: boolean;
  tags?: string;
  remark?: string;
  created_at: string;
  updated_at: string;
  // 协议特定字段
  uuid?: string;
  password?: string;
  method?: string;
  encryption?: string;
  flow?: string;
  network?: string;
  security?: string;
  sni?: string;
  alpn?: string;
  fingerprint?: string;
  ws_path?: string;
  ws_headers?: string;
  h2_path?: string;
  h2_host?: string;
  grpc_service_name?: string;
  grpc_mode?: string;
  alter_id?: number;
  tls?: boolean;
  allow_insecure?: boolean;
  username?: string;
  plugin?: string;
  plugin_opts?: string;
  obfs?: string;
  obfs_password?: string;
  up_mbps?: number;
  down_mbps?: number;
  auth?: string;
  auth_str?: string;
  protocol?: string;
}

export interface DatabaseEnv {
  DB: D1Database;
}

export class Database {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  // 初始化数据库
  async init(): Promise<DbResult<void>> {
    try {
      // 这里可以执行一些初始化检查
      const result = await this.db.prepare('SELECT 1').first();
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: `Database initialization failed: ${error}` 
      };
    }
  }

  // 执行原始 SQL 查询
  async query<T = any>(sql: string, params: any[] = []): Promise<DbResult<T[]>> {
    try {
      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...params).all();
      
      return {
        success: true,
        data: result.results as T[],
        meta: result.meta
      };
    } catch (error) {
      return {
        success: false,
        error: `Query failed: ${error}`,
        data: []
      };
    }
  }

  // 执行单个查询
  async queryFirst<T = any>(sql: string, params: any[] = []): Promise<DbResult<T | null>> {
    try {
      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...params).first();
      
      return {
        success: true,
        data: result as T | null,
        meta: { rows_read: result ? 1 : 0 }
      };
    } catch (error) {
      return {
        success: false,
        error: `Query failed: ${error}`,
        data: null
      };
    }
  }

  // 执行写入操作
  async execute(sql: string, params: any[] = []): Promise<DbResult<void>> {
    try {
      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...params).run();
      
      return {
        success: result.success,
        meta: result.meta
      };
    } catch (error) {
      return {
        success: false,
        error: `Execute failed: ${error}`
      };
    }
  }

  // 批量执行
  async batch(statements: { sql: string; params?: any[] }[]): Promise<DbResult<void>> {
    try {
      const stmts = statements.map(({ sql, params = [] }) => 
        this.db.prepare(sql).bind(...params)
      );
      
      const results = await this.db.batch(stmts);
      const allSuccess = results.every(r => r.success);
      
      return {
        success: allSuccess,
        meta: {
          changes: results.reduce((sum, r) => sum + (r.meta?.changes || 0), 0)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Batch execute failed: ${error}`
      };
    }
  }

  // 开始事务
  async transaction<T>(callback: (db: Database) => Promise<T>): Promise<DbResult<T>> {
    try {
      // D1 目前不支持显式事务，但我们可以使用 batch 来模拟
      const result = await callback(this);
      return { success: true, data: result };
    } catch (error) {
      return {
        success: false,
        error: `Transaction failed: ${error}`
      };
    }
  }

  // 数据库转换辅助方法
  static dbNodeToProxyNode(dbNode: DbNode): ProxyNode {
    const baseNode = {
      id: dbNode.id,
      name: dbNode.name,
      type: dbNode.type,
      server: dbNode.server,
      port: dbNode.port,
      enabled: dbNode.enabled,
      tags: dbNode.tags ? JSON.parse(dbNode.tags) : undefined,
      remark: dbNode.remark,
      createdAt: dbNode.created_at,
      updatedAt: dbNode.updated_at,
    };

    // 根据类型构造特定的节点对象
    switch (dbNode.type) {
      case 'vless':
        return {
          ...baseNode,
          type: 'vless',
          uuid: dbNode.uuid!,
          encryption: dbNode.encryption as any,
          flow: dbNode.flow,
          network: dbNode.network as any,
          security: dbNode.security as any,
          sni: dbNode.sni,
          alpn: dbNode.alpn ? JSON.parse(dbNode.alpn) : undefined,
          fingerprint: dbNode.fingerprint,
          wsPath: dbNode.ws_path,
          wsHeaders: dbNode.ws_headers ? JSON.parse(dbNode.ws_headers) : undefined,
          h2Path: dbNode.h2_path,
          h2Host: dbNode.h2_host ? JSON.parse(dbNode.h2_host) : undefined,
          grpcServiceName: dbNode.grpc_service_name,
          grpcMode: dbNode.grpc_mode as any,
        } as any;

      case 'vmess':
        return {
          ...baseNode,
          type: 'vmess',
          uuid: dbNode.uuid!,
          alterId: dbNode.alter_id || 0,
          security: dbNode.security as any,
          network: dbNode.network as any,
          tls: dbNode.tls,
          sni: dbNode.sni,
          alpn: dbNode.alpn ? JSON.parse(dbNode.alpn) : undefined,
          wsPath: dbNode.ws_path,
          wsHeaders: dbNode.ws_headers ? JSON.parse(dbNode.ws_headers) : undefined,
          h2Path: dbNode.h2_path,
          h2Host: dbNode.h2_host ? JSON.parse(dbNode.h2_host) : undefined,
          grpcServiceName: dbNode.grpc_service_name,
          grpcMode: dbNode.grpc_mode as any,
        } as any;

      case 'trojan':
        return {
          ...baseNode,
          type: 'trojan',
          password: dbNode.password!,
          sni: dbNode.sni,
          alpn: dbNode.alpn ? JSON.parse(dbNode.alpn) : undefined,
          fingerprint: dbNode.fingerprint,
          allowInsecure: dbNode.allow_insecure,
          network: dbNode.network as any,
          wsPath: dbNode.ws_path,
          wsHeaders: dbNode.ws_headers ? JSON.parse(dbNode.ws_headers) : undefined,
          grpcServiceName: dbNode.grpc_service_name,
          grpcMode: dbNode.grpc_mode as any,
        } as any;

      case 'ss':
        return {
          ...baseNode,
          type: 'ss',
          method: dbNode.method!,
          password: dbNode.password!,
          plugin: dbNode.plugin,
          pluginOpts: dbNode.plugin_opts,
        } as any;

      case 'socks5':
        return {
          ...baseNode,
          type: 'socks5',
          username: dbNode.username,
          password: dbNode.password,
          tls: dbNode.tls,
          sni: dbNode.sni,
          fingerprint: dbNode.fingerprint,
        } as any;

      case 'hy2':
        return {
          ...baseNode,
          type: 'hy2',
          password: dbNode.password!,
          obfs: dbNode.obfs,
          obfsPassword: dbNode.obfs_password,
          sni: dbNode.sni,
          alpn: dbNode.alpn ? JSON.parse(dbNode.alpn) : undefined,
          fingerprint: dbNode.fingerprint,
          allowInsecure: dbNode.allow_insecure,
          upMbps: dbNode.up_mbps,
          downMbps: dbNode.down_mbps,
        } as any;

      case 'hy':
        return {
          ...baseNode,
          type: 'hy',
          auth: dbNode.auth,
          authStr: dbNode.auth_str,
          obfs: dbNode.obfs,
          protocol: dbNode.protocol as any,
          sni: dbNode.sni,
          alpn: dbNode.alpn ? JSON.parse(dbNode.alpn) : undefined,
          fingerprint: dbNode.fingerprint,
          allowInsecure: dbNode.allow_insecure,
          upMbps: dbNode.up_mbps,
          downMbps: dbNode.down_mbps,
        } as any;

      default:
        return baseNode as any;
    }
  }

  static proxyNodeToDbNode(node: ProxyNode): Partial<DbNode> {
    const dbNode: Partial<DbNode> = {
      id: node.id,
      name: node.name,
      type: node.type,
      server: node.server,
      port: node.port,
      enabled: node.enabled !== undefined ? node.enabled : true,
      tags: node.tags ? JSON.stringify(node.tags) : null,
      remark: node.remark || null,
      updated_at: new Date().toISOString(),
    };

    // 根据节点类型设置特定字段，为缺失的必需字段提供默认值
    switch (node.type) {
      case 'vless':
        const vlessNode = node as any;
        Object.assign(dbNode, {
          uuid: vlessNode.uuid || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          encryption: vlessNode.encryption || 'none',
          flow: vlessNode.flow || null,
          network: vlessNode.network || 'tcp',
          security: vlessNode.security || 'none',
          sni: vlessNode.sni || null,
          alpn: vlessNode.alpn ? JSON.stringify(vlessNode.alpn) : null,
          fingerprint: vlessNode.fingerprint || null,
          ws_path: vlessNode.wsPath || null,
          ws_headers: vlessNode.wsHeaders ? JSON.stringify(vlessNode.wsHeaders) : null,
          h2_path: vlessNode.h2Path || null,
          h2_host: vlessNode.h2Host ? JSON.stringify(vlessNode.h2Host) : null,
          grpc_service_name: vlessNode.grpcServiceName || null,
          grpc_mode: vlessNode.grpcMode || null,
        });
        break;

      case 'vmess':
        const vmessNode = node as any;
        Object.assign(dbNode, {
          uuid: vmessNode.uuid || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          alter_id: vmessNode.alterId || 0,
          security: vmessNode.security || 'auto',
          network: vmessNode.network || 'tcp',
          tls: vmessNode.tls || false,
          sni: vmessNode.sni || null,
          alpn: vmessNode.alpn ? JSON.stringify(vmessNode.alpn) : null,
          ws_path: vmessNode.wsPath || null,
          ws_headers: vmessNode.wsHeaders ? JSON.stringify(vmessNode.wsHeaders) : null,
          h2_path: vmessNode.h2Path || null,
          h2_host: vmessNode.h2Host ? JSON.stringify(vmessNode.h2Host) : null,
          grpc_service_name: vmessNode.grpcServiceName || null,
          grpc_mode: vmessNode.grpcMode || null,
        });
        break;

      case 'trojan':
        const trojanNode = node as any;
        Object.assign(dbNode, {
          password: trojanNode.password || 'default-password',
          sni: trojanNode.sni || null,
          alpn: trojanNode.alpn ? JSON.stringify(trojanNode.alpn) : null,
          fingerprint: trojanNode.fingerprint || null,
          allow_insecure: trojanNode.allowInsecure || false,
          network: trojanNode.network || 'tcp',
          ws_path: trojanNode.wsPath || null,
          ws_headers: trojanNode.wsHeaders ? JSON.stringify(trojanNode.wsHeaders) : null,
          grpc_service_name: trojanNode.grpcServiceName || null,
          grpc_mode: trojanNode.grpcMode || null,
        });
        break;

      case 'ss':
        const ssNode = node as any;
        Object.assign(dbNode, {
          method: ssNode.method || 'aes-256-gcm',
          password: ssNode.password || 'default-password',
          plugin: ssNode.plugin || null,
          plugin_opts: ssNode.pluginOpts || null,
        });
        break;

      case 'socks5':
        const socks5Node = node as any;
        Object.assign(dbNode, {
          username: socks5Node.username || null,
          password: socks5Node.password || null,
          tls: socks5Node.tls || false,
          sni: socks5Node.sni || null,
          fingerprint: socks5Node.fingerprint || null,
        });
        break;

      case 'hy2':
        const hy2Node = node as any;
        Object.assign(dbNode, {
          password: hy2Node.password || 'default-password',
          obfs: hy2Node.obfs || null,
          obfs_password: hy2Node.obfsPassword || null,
          sni: hy2Node.sni || null,
          alpn: hy2Node.alpn ? JSON.stringify(hy2Node.alpn) : null,
          fingerprint: hy2Node.fingerprint || null,
          allow_insecure: hy2Node.allowInsecure || false,
          up_mbps: hy2Node.upMbps || null,
          down_mbps: hy2Node.downMbps || null,
        });
        break;

      case 'hy':
        const hyNode = node as any;
        Object.assign(dbNode, {
          auth: hyNode.auth || null,
          auth_str: hyNode.authStr || null,
          obfs: hyNode.obfs || null,
          protocol: hyNode.protocol || null,
          sni: hyNode.sni || null,
          alpn: hyNode.alpn ? JSON.stringify(hyNode.alpn) : null,
          fingerprint: hyNode.fingerprint || null,
          allow_insecure: hyNode.allowInsecure || false,
          up_mbps: hyNode.upMbps || null,
          down_mbps: hyNode.downMbps || null,
        });
        break;
    }

    return dbNode;
  }
}
