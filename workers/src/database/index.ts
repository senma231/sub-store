import { DbNode, DbUser, DbSubscription, DbAccessLog, DbSetting, DbSession, DbResult, ProxyNode } from '../../../shared/types';

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
      enabled: node.enabled,
      tags: node.tags ? JSON.stringify(node.tags) : undefined,
      remark: node.remark,
      updated_at: new Date().toISOString(),
    };

    // 根据节点类型设置特定字段
    switch (node.type) {
      case 'vless':
        const vlessNode = node as any;
        Object.assign(dbNode, {
          uuid: vlessNode.uuid,
          encryption: vlessNode.encryption,
          flow: vlessNode.flow,
          network: vlessNode.network,
          security: vlessNode.security,
          sni: vlessNode.sni,
          alpn: vlessNode.alpn ? JSON.stringify(vlessNode.alpn) : undefined,
          fingerprint: vlessNode.fingerprint,
          ws_path: vlessNode.wsPath,
          ws_headers: vlessNode.wsHeaders ? JSON.stringify(vlessNode.wsHeaders) : undefined,
          h2_path: vlessNode.h2Path,
          h2_host: vlessNode.h2Host ? JSON.stringify(vlessNode.h2Host) : undefined,
          grpc_service_name: vlessNode.grpcServiceName,
          grpc_mode: vlessNode.grpcMode,
        });
        break;

      case 'vmess':
        const vmessNode = node as any;
        Object.assign(dbNode, {
          uuid: vmessNode.uuid,
          alter_id: vmessNode.alterId,
          security: vmessNode.security,
          network: vmessNode.network,
          tls: vmessNode.tls,
          sni: vmessNode.sni,
          alpn: vmessNode.alpn ? JSON.stringify(vmessNode.alpn) : undefined,
          ws_path: vmessNode.wsPath,
          ws_headers: vmessNode.wsHeaders ? JSON.stringify(vmessNode.wsHeaders) : undefined,
          h2_path: vmessNode.h2Path,
          h2_host: vmessNode.h2Host ? JSON.stringify(vmessNode.h2Host) : undefined,
          grpc_service_name: vmessNode.grpcServiceName,
          grpc_mode: vmessNode.grpcMode,
        });
        break;

      case 'trojan':
        const trojanNode = node as any;
        Object.assign(dbNode, {
          password: trojanNode.password,
          sni: trojanNode.sni,
          alpn: trojanNode.alpn ? JSON.stringify(trojanNode.alpn) : undefined,
          fingerprint: trojanNode.fingerprint,
          allow_insecure: trojanNode.allowInsecure,
          network: trojanNode.network,
          ws_path: trojanNode.wsPath,
          ws_headers: trojanNode.wsHeaders ? JSON.stringify(trojanNode.wsHeaders) : undefined,
          grpc_service_name: trojanNode.grpcServiceName,
          grpc_mode: trojanNode.grpcMode,
        });
        break;

      case 'ss':
        const ssNode = node as any;
        Object.assign(dbNode, {
          method: ssNode.method,
          password: ssNode.password,
          plugin: ssNode.plugin,
          plugin_opts: ssNode.pluginOpts,
        });
        break;

      case 'socks5':
        const socks5Node = node as any;
        Object.assign(dbNode, {
          username: socks5Node.username,
          password: socks5Node.password,
          tls: socks5Node.tls,
          sni: socks5Node.sni,
          fingerprint: socks5Node.fingerprint,
        });
        break;

      case 'hy2':
        const hy2Node = node as any;
        Object.assign(dbNode, {
          password: hy2Node.password,
          obfs: hy2Node.obfs,
          obfs_password: hy2Node.obfsPassword,
          sni: hy2Node.sni,
          alpn: hy2Node.alpn ? JSON.stringify(hy2Node.alpn) : undefined,
          fingerprint: hy2Node.fingerprint,
          allow_insecure: hy2Node.allowInsecure,
          up_mbps: hy2Node.upMbps,
          down_mbps: hy2Node.downMbps,
        });
        break;

      case 'hy':
        const hyNode = node as any;
        Object.assign(dbNode, {
          auth: hyNode.auth,
          auth_str: hyNode.authStr,
          obfs: hyNode.obfs,
          protocol: hyNode.protocol,
          sni: hyNode.sni,
          alpn: hyNode.alpn ? JSON.stringify(hyNode.alpn) : undefined,
          fingerprint: hyNode.fingerprint,
          allow_insecure: hyNode.allowInsecure,
          up_mbps: hyNode.upMbps,
          down_mbps: hyNode.downMbps,
        });
        break;
    }

    return dbNode;
  }
}
