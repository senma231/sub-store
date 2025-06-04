#!/usr/bin/env node

/**
 * KV 到 D1 数据迁移脚本
 * 
 * 此脚本帮助用户将现有的 Cloudflare KV 数据迁移到新的 D1 数据库
 * 
 * 使用方法:
 * 1. 确保已安装 wrangler CLI 并登录
 * 2. 配置好新的 D1 数据库
 * 3. 运行: node scripts/migrate-kv-to-d1.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
  // KV 命名空间 (旧)
  KV_NAMESPACE: 'SUB_STORE_KV',
  
  // D1 数据库 (新)
  D1_DATABASE: 'sub-store-db',
  
  // 数据备份目录
  BACKUP_DIR: './migration-backup',
  
  // 迁移日志文件
  LOG_FILE: './migration.log'
};

class KVToD1Migrator {
  constructor() {
    this.log('='.repeat(60));
    this.log('Sub-Store KV 到 D1 数据迁移工具');
    this.log('='.repeat(60));
    
    // 创建备份目录
    if (!fs.existsSync(CONFIG.BACKUP_DIR)) {
      fs.mkdirSync(CONFIG.BACKUP_DIR, { recursive: true });
    }
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    // 写入日志文件
    fs.appendFileSync(CONFIG.LOG_FILE, logMessage + '\n');
  }

  error(message) {
    this.log(`❌ ERROR: ${message}`);
  }

  success(message) {
    this.log(`✅ SUCCESS: ${message}`);
  }

  warning(message) {
    this.log(`⚠️  WARNING: ${message}`);
  }

  // 执行命令并返回结果
  exec(command) {
    try {
      const result = execSync(command, { encoding: 'utf8' });
      return { success: true, output: result.trim() };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 检查环境
  async checkEnvironment() {
    this.log('检查环境...');

    // 检查 wrangler
    const wranglerCheck = this.exec('wrangler --version');
    if (!wranglerCheck.success) {
      this.error('Wrangler CLI 未安装或未在 PATH 中');
      return false;
    }
    this.success(`Wrangler 版本: ${wranglerCheck.output}`);

    // 检查登录状态
    const authCheck = this.exec('wrangler auth whoami');
    if (!authCheck.success) {
      this.error('未登录 Cloudflare，请运行: wrangler auth login');
      return false;
    }
    this.success(`已登录用户: ${authCheck.output}`);

    return true;
  }

  // 备份 KV 数据
  async backupKVData() {
    this.log('备份 KV 数据...');

    try {
      // 获取所有 KV 键
      const listResult = this.exec(`wrangler kv:key list --namespace-id ${CONFIG.KV_NAMESPACE}`);
      if (!listResult.success) {
        this.error(`无法列出 KV 键: ${listResult.error}`);
        return null;
      }

      const keys = JSON.parse(listResult.output);
      this.log(`发现 ${keys.length} 个 KV 键`);

      const kvData = {};
      let successCount = 0;
      let errorCount = 0;

      // 逐个获取键值
      for (const keyInfo of keys) {
        const key = keyInfo.name;
        this.log(`备份键: ${key}`);

        const getResult = this.exec(`wrangler kv:key get "${key}" --namespace-id ${CONFIG.KV_NAMESPACE}`);
        if (getResult.success) {
          try {
            kvData[key] = JSON.parse(getResult.output);
            successCount++;
          } catch (e) {
            // 如果不是 JSON，保存为字符串
            kvData[key] = getResult.output;
            successCount++;
          }
        } else {
          this.error(`无法获取键 ${key}: ${getResult.error}`);
          errorCount++;
        }
      }

      // 保存备份文件
      const backupFile = path.join(CONFIG.BACKUP_DIR, `kv-backup-${Date.now()}.json`);
      fs.writeFileSync(backupFile, JSON.stringify(kvData, null, 2));
      
      this.success(`KV 数据已备份到: ${backupFile}`);
      this.log(`成功备份: ${successCount} 个键，失败: ${errorCount} 个键`);

      return kvData;
    } catch (error) {
      this.error(`备份 KV 数据失败: ${error.message}`);
      return null;
    }
  }

  // 转换数据格式
  convertKVToD1Format(kvData) {
    this.log('转换数据格式...');

    const d1Data = {
      nodes: [],
      users: [],
      subscriptions: [],
      settings: []
    };

    try {
      // 转换节点数据
      if (kvData.nodes) {
        const nodes = Array.isArray(kvData.nodes) ? kvData.nodes : [kvData.nodes];
        d1Data.nodes = nodes.map(node => this.convertNodeToD1Format(node));
        this.log(`转换了 ${d1Data.nodes.length} 个节点`);
      }

      // 转换用户数据
      if (kvData.users) {
        const users = Array.isArray(kvData.users) ? kvData.users : [kvData.users];
        d1Data.users = users.map(user => this.convertUserToD1Format(user));
        this.log(`转换了 ${d1Data.users.length} 个用户`);
      }

      // 转换订阅数据
      if (kvData.subscriptions) {
        const subscriptions = Array.isArray(kvData.subscriptions) ? kvData.subscriptions : [kvData.subscriptions];
        d1Data.subscriptions = subscriptions.map(sub => this.convertSubscriptionToD1Format(sub));
        this.log(`转换了 ${d1Data.subscriptions.length} 个订阅`);
      }

      // 转换设置数据
      Object.keys(kvData).forEach(key => {
        if (!['nodes', 'users', 'subscriptions'].includes(key)) {
          d1Data.settings.push({
            key: key,
            value: typeof kvData[key] === 'string' ? kvData[key] : JSON.stringify(kvData[key]),
            description: `从 KV 迁移的设置: ${key}`,
            type: typeof kvData[key] === 'string' ? 'string' : 'json',
            updated_at: new Date().toISOString()
          });
        }
      });

      this.success('数据格式转换完成');
      return d1Data;
    } catch (error) {
      this.error(`数据格式转换失败: ${error.message}`);
      return null;
    }
  }

  // 转换节点格式
  convertNodeToD1Format(node) {
    const now = new Date().toISOString();
    return {
      id: node.id || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: node.name || 'Unknown Node',
      type: node.type || 'vless',
      server: node.server || 'example.com',
      port: node.port || 443,
      enabled: node.enabled !== false,
      tags: node.tags ? JSON.stringify(node.tags) : null,
      remark: node.remark || null,
      
      // 认证信息
      uuid: node.uuid || null,
      encryption: node.encryption || null,
      flow: node.flow || null,
      alter_id: node.alterId || null,
      security: node.security || null,
      password: node.password || null,
      method: node.method || null,
      username: node.username || null,
      
      // 网络配置
      network: node.network || 'tcp',
      tls: node.tls || false,
      sni: node.sni || null,
      alpn: node.alpn ? JSON.stringify(node.alpn) : null,
      fingerprint: node.fingerprint || null,
      allow_insecure: node.allowInsecure || false,
      
      // WebSocket 配置
      ws_path: node.wsPath || null,
      ws_headers: node.wsHeaders ? JSON.stringify(node.wsHeaders) : null,
      
      // HTTP/2 配置
      h2_path: node.h2Path || null,
      h2_host: node.h2Host ? JSON.stringify(node.h2Host) : null,
      
      // gRPC 配置
      grpc_service_name: node.grpcServiceName || null,
      grpc_mode: node.grpcMode || null,
      
      // 插件配置
      plugin: node.plugin || null,
      plugin_opts: node.pluginOpts || null,
      
      // Hysteria 配置
      obfs: node.obfs || null,
      obfs_password: node.obfsPassword || null,
      up_mbps: node.upMbps || null,
      down_mbps: node.downMbps || null,
      auth: node.auth || null,
      auth_str: node.authStr || null,
      protocol: node.protocol || null,
      
      // 统计信息
      total_requests: node.totalRequests || 0,
      last_used: node.lastUsed || null,
      
      // 时间戳
      created_at: node.createdAt || now,
      updated_at: node.updatedAt || now
    };
  }

  // 转换用户格式
  convertUserToD1Format(user) {
    const now = new Date().toISOString();
    return {
      id: user.id || `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      username: user.username || 'admin',
      password: user.password || 'change_me',
      role: user.role || 'admin',
      email: user.email || null,
      created_at: user.createdAt || now,
      updated_at: user.updatedAt || now,
      last_login: user.lastLogin || null,
      enabled: user.enabled !== false
    };
  }

  // 转换订阅格式
  convertSubscriptionToD1Format(subscription) {
    const now = new Date().toISOString();
    return {
      id: subscription.id || `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: subscription.name || 'Default Subscription',
      description: subscription.description || null,
      enabled: subscription.enabled !== false,
      
      // 过滤配置
      include_types: subscription.includeTypes ? JSON.stringify(subscription.includeTypes) : null,
      exclude_types: subscription.excludeTypes ? JSON.stringify(subscription.excludeTypes) : null,
      include_keywords: subscription.includeKeywords ? JSON.stringify(subscription.includeKeywords) : null,
      exclude_keywords: subscription.excludeKeywords ? JSON.stringify(subscription.excludeKeywords) : null,
      
      // 排序和分组
      sort_by: subscription.sortBy || 'name',
      sort_order: subscription.sortOrder || 'asc',
      group_enabled: subscription.groupEnabled || false,
      group_by: subscription.groupBy || 'type',
      
      // 重命名规则
      rename_rules: subscription.renameRules ? JSON.stringify(subscription.renameRules) : null,
      
      // 统计信息
      total_requests: subscription.totalRequests || 0,
      last_accessed: subscription.lastAccessed || null,
      
      // 时间戳
      created_at: subscription.createdAt || now,
      updated_at: subscription.updatedAt || now
    };
  }

  // 导入数据到 D1
  async importToD1(d1Data) {
    this.log('导入数据到 D1 数据库...');

    try {
      // 生成 SQL 插入语句
      const sqlFile = path.join(CONFIG.BACKUP_DIR, `migration-${Date.now()}.sql`);
      let sql = '-- Sub-Store 数据迁移 SQL\n\n';

      // 插入用户数据
      if (d1Data.users.length > 0) {
        sql += '-- 插入用户数据\n';
        for (const user of d1Data.users) {
          sql += this.generateUserInsertSQL(user) + '\n';
        }
        sql += '\n';
      }

      // 插入节点数据
      if (d1Data.nodes.length > 0) {
        sql += '-- 插入节点数据\n';
        for (const node of d1Data.nodes) {
          sql += this.generateNodeInsertSQL(node) + '\n';
        }
        sql += '\n';
      }

      // 插入订阅数据
      if (d1Data.subscriptions.length > 0) {
        sql += '-- 插入订阅数据\n';
        for (const subscription of d1Data.subscriptions) {
          sql += this.generateSubscriptionInsertSQL(subscription) + '\n';
        }
        sql += '\n';
      }

      // 插入设置数据
      if (d1Data.settings.length > 0) {
        sql += '-- 插入设置数据\n';
        for (const setting of d1Data.settings) {
          sql += this.generateSettingInsertSQL(setting) + '\n';
        }
        sql += '\n';
      }

      // 保存 SQL 文件
      fs.writeFileSync(sqlFile, sql);
      this.success(`SQL 文件已生成: ${sqlFile}`);

      // 执行 SQL
      const executeResult = this.exec(`wrangler d1 execute ${CONFIG.D1_DATABASE} --file="${sqlFile}"`);
      if (executeResult.success) {
        this.success('数据已成功导入到 D1 数据库');
        this.log(`导入结果: ${executeResult.output}`);
        return true;
      } else {
        this.error(`导入 D1 失败: ${executeResult.error}`);
        return false;
      }
    } catch (error) {
      this.error(`导入 D1 数据失败: ${error.message}`);
      return false;
    }
  }

  // 生成用户插入 SQL
  generateUserInsertSQL(user) {
    const values = [
      `'${user.id}'`,
      `'${user.username}'`,
      `'${user.password}'`,
      `'${user.role}'`,
      user.email ? `'${user.email}'` : 'NULL',
      `'${user.created_at}'`,
      `'${user.updated_at}'`,
      user.last_login ? `'${user.last_login}'` : 'NULL',
      user.enabled ? '1' : '0'
    ].join(', ');

    return `INSERT OR REPLACE INTO users (id, username, password, role, email, created_at, updated_at, last_login, enabled) VALUES (${values});`;
  }

  // 生成节点插入 SQL
  generateNodeInsertSQL(node) {
    const values = [
      `'${node.id}'`,
      `'${node.name}'`,
      `'${node.type}'`,
      `'${node.server}'`,
      node.port,
      node.enabled ? '1' : '0',
      node.tags ? `'${node.tags}'` : 'NULL',
      node.remark ? `'${node.remark}'` : 'NULL',
      node.uuid ? `'${node.uuid}'` : 'NULL',
      node.encryption ? `'${node.encryption}'` : 'NULL',
      node.flow ? `'${node.flow}'` : 'NULL',
      node.alter_id || 'NULL',
      node.security ? `'${node.security}'` : 'NULL',
      node.password ? `'${node.password}'` : 'NULL',
      node.method ? `'${node.method}'` : 'NULL',
      node.username ? `'${node.username}'` : 'NULL',
      node.network ? `'${node.network}'` : 'NULL',
      node.tls ? '1' : '0',
      node.sni ? `'${node.sni}'` : 'NULL',
      node.alpn ? `'${node.alpn}'` : 'NULL',
      node.fingerprint ? `'${node.fingerprint}'` : 'NULL',
      node.allow_insecure ? '1' : '0',
      node.ws_path ? `'${node.ws_path}'` : 'NULL',
      node.ws_headers ? `'${node.ws_headers}'` : 'NULL',
      node.h2_path ? `'${node.h2_path}'` : 'NULL',
      node.h2_host ? `'${node.h2_host}'` : 'NULL',
      node.grpc_service_name ? `'${node.grpc_service_name}'` : 'NULL',
      node.grpc_mode ? `'${node.grpc_mode}'` : 'NULL',
      node.plugin ? `'${node.plugin}'` : 'NULL',
      node.plugin_opts ? `'${node.plugin_opts}'` : 'NULL',
      node.obfs ? `'${node.obfs}'` : 'NULL',
      node.obfs_password ? `'${node.obfs_password}'` : 'NULL',
      node.up_mbps || 'NULL',
      node.down_mbps || 'NULL',
      node.auth ? `'${node.auth}'` : 'NULL',
      node.auth_str ? `'${node.auth_str}'` : 'NULL',
      node.protocol ? `'${node.protocol}'` : 'NULL',
      node.total_requests || 0,
      node.last_used ? `'${node.last_used}'` : 'NULL',
      `'${node.created_at}'`,
      `'${node.updated_at}'`
    ].join(', ');

    return `INSERT OR REPLACE INTO nodes (id, name, type, server, port, enabled, tags, remark, uuid, encryption, flow, alter_id, security, password, method, username, network, tls, sni, alpn, fingerprint, allow_insecure, ws_path, ws_headers, h2_path, h2_host, grpc_service_name, grpc_mode, plugin, plugin_opts, obfs, obfs_password, up_mbps, down_mbps, auth, auth_str, protocol, total_requests, last_used, created_at, updated_at) VALUES (${values});`;
  }

  // 生成订阅插入 SQL
  generateSubscriptionInsertSQL(subscription) {
    const values = [
      `'${subscription.id}'`,
      `'${subscription.name}'`,
      subscription.description ? `'${subscription.description}'` : 'NULL',
      subscription.enabled ? '1' : '0',
      subscription.include_types ? `'${subscription.include_types}'` : 'NULL',
      subscription.exclude_types ? `'${subscription.exclude_types}'` : 'NULL',
      subscription.include_keywords ? `'${subscription.include_keywords}'` : 'NULL',
      subscription.exclude_keywords ? `'${subscription.exclude_keywords}'` : 'NULL',
      `'${subscription.sort_by}'`,
      `'${subscription.sort_order}'`,
      subscription.group_enabled ? '1' : '0',
      `'${subscription.group_by}'`,
      subscription.rename_rules ? `'${subscription.rename_rules}'` : 'NULL',
      subscription.total_requests || 0,
      subscription.last_accessed ? `'${subscription.last_accessed}'` : 'NULL',
      `'${subscription.created_at}'`,
      `'${subscription.updated_at}'`
    ].join(', ');

    return `INSERT OR REPLACE INTO subscriptions (id, name, description, enabled, include_types, exclude_types, include_keywords, exclude_keywords, sort_by, sort_order, group_enabled, group_by, rename_rules, total_requests, last_accessed, created_at, updated_at) VALUES (${values});`;
  }

  // 生成设置插入 SQL
  generateSettingInsertSQL(setting) {
    const values = [
      `'${setting.key}'`,
      `'${setting.value}'`,
      setting.description ? `'${setting.description}'` : 'NULL',
      `'${setting.type}'`,
      `'${setting.updated_at}'`
    ].join(', ');

    return `INSERT OR REPLACE INTO settings (key, value, description, type, updated_at) VALUES (${values});`;
  }

  // 主迁移流程
  async migrate() {
    try {
      this.log('开始 KV 到 D1 数据迁移...');

      // 1. 检查环境
      if (!(await this.checkEnvironment())) {
        return false;
      }

      // 2. 备份 KV 数据
      const kvData = await this.backupKVData();
      if (!kvData) {
        return false;
      }

      // 3. 转换数据格式
      const d1Data = this.convertKVToD1Format(kvData);
      if (!d1Data) {
        return false;
      }

      // 4. 导入到 D1
      const importSuccess = await this.importToD1(d1Data);
      if (!importSuccess) {
        return false;
      }

      this.success('数据迁移完成！');
      this.log('='.repeat(60));
      this.log('迁移摘要:');
      this.log(`- 节点: ${d1Data.nodes.length} 个`);
      this.log(`- 用户: ${d1Data.users.length} 个`);
      this.log(`- 订阅: ${d1Data.subscriptions.length} 个`);
      this.log(`- 设置: ${d1Data.settings.length} 个`);
      this.log(`- 备份目录: ${CONFIG.BACKUP_DIR}`);
      this.log(`- 日志文件: ${CONFIG.LOG_FILE}`);
      this.log('='.repeat(60));

      return true;
    } catch (error) {
      this.error(`迁移失败: ${error.message}`);
      return false;
    }
  }
}

// 主函数
async function main() {
  const migrator = new KVToD1Migrator();
  const success = await migrator.migrate();
  process.exit(success ? 0 : 1);
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch(console.error);
}

module.exports = KVToD1Migrator;
