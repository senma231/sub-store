#!/usr/bin/env node

/**
 * D1 数据库设置脚本
 * 用于创建和配置 Cloudflare D1 数据库
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 开始设置 D1 数据库...\n');

// 检查 wrangler 是否已安装
try {
  execSync('wrangler --version', { stdio: 'pipe' });
  console.log('✅ Wrangler CLI 已安装');
} catch (error) {
  console.error('❌ Wrangler CLI 未安装，请先安装：npm install -g wrangler');
  process.exit(1);
}

// 检查是否已登录
try {
  execSync('wrangler whoami', { stdio: 'pipe' });
  console.log('✅ 已登录 Cloudflare 账户');
} catch (error) {
  console.error('❌ 未登录 Cloudflare，请先登录：wrangler login');
  process.exit(1);
}

// 创建 D1 数据库
console.log('\n📊 创建 D1 数据库...');
try {
  const createOutput = execSync('wrangler d1 create sub-store-db', { 
    encoding: 'utf8',
    cwd: path.join(__dirname, '../workers')
  });
  
  console.log('✅ D1 数据库创建成功！');
  console.log(createOutput);
  
  // 提取 database_id
  const databaseIdMatch = createOutput.match(/database_id = "([^"]+)"/);
  if (databaseIdMatch) {
    const databaseId = databaseIdMatch[1];
    console.log(`\n📋 数据库 ID: ${databaseId}`);
    
    // 更新 wrangler.toml
    const wranglerTomlPath = path.join(__dirname, '../workers/wrangler.toml');
    let wranglerContent = fs.readFileSync(wranglerTomlPath, 'utf8');
    
    // 取消注释并更新配置
    wranglerContent = wranglerContent.replace(
      /# \[\[d1_databases\]\]\n# binding = "DB"\n# database_name = "sub-store-db"\n# database_id = "YOUR_REAL_DATABASE_ID_HERE"/,
      `[[d1_databases]]\nbinding = "DB"\ndatabase_name = "sub-store-db"\ndatabase_id = "${databaseId}"`
    );
    
    fs.writeFileSync(wranglerTomlPath, wranglerContent);
    console.log('✅ wrangler.toml 已更新');
    
    // 运行数据库迁移
    console.log('\n🔄 运行数据库迁移...');
    const migrateOutput = execSync(`wrangler d1 execute sub-store-db --file=./schema.sql`, {
      encoding: 'utf8',
      cwd: path.join(__dirname, '../workers')
    });
    
    console.log('✅ 数据库迁移完成！');
    console.log(migrateOutput);
    
    // 验证数据库
    console.log('\n🔍 验证数据库结构...');
    const verifyOutput = execSync(`wrangler d1 execute sub-store-db --command="SELECT name FROM sqlite_master WHERE type='table';"`, {
      encoding: 'utf8',
      cwd: path.join(__dirname, '../workers')
    });
    
    console.log('✅ 数据库表结构验证：');
    console.log(verifyOutput);
    
    console.log('\n🎉 D1 数据库设置完成！');
    console.log('\n📋 下一步：');
    console.log('1. 提交更新的 wrangler.toml');
    console.log('2. 推送到 GitHub 触发重新部署');
    console.log('3. 验证完整功能');
    
    // 生成 GitHub Secrets 配置
    console.log('\n🔐 GitHub Secrets 配置：');
    console.log(`CF_D1_DATABASE_NAME=sub-store-db`);
    console.log(`CF_D1_DATABASE_ID=${databaseId}`);
    
  } else {
    console.error('❌ 无法提取数据库 ID');
    process.exit(1);
  }
  
} catch (error) {
  console.error('❌ 创建数据库失败：', error.message);
  
  // 检查是否数据库已存在
  if (error.message.includes('already exists')) {
    console.log('\n📋 数据库可能已存在，尝试列出现有数据库...');
    try {
      const listOutput = execSync('wrangler d1 list', { 
        encoding: 'utf8',
        cwd: path.join(__dirname, '../workers')
      });
      console.log(listOutput);
    } catch (listError) {
      console.error('❌ 无法列出数据库：', listError.message);
    }
  }
  
  process.exit(1);
}
