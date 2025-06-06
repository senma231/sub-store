#!/usr/bin/env node

/**
 * Sub-Store Cloudflare D1数据库配置验证脚本
 * 验证D1数据库配置是否正确
 */

const https = require('https');
const { execSync } = require('child_process');

// 配置
const API_BASE = 'https://substore-api.senmago231.workers.dev';
const REPO_OWNER = 'senma231';
const REPO_NAME = 'sub-store';

// 颜色定义
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// HTTP 请求函数
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', reject);
    req.end();
  });
}

// 检查GitHub CLI是否可用
function checkGitHubCLI() {
  log('🔍 检查GitHub CLI...', 'blue');
  
  try {
    execSync('gh --version', { stdio: 'pipe' });
    log('✅ GitHub CLI 可用', 'green');
    return true;
  } catch (error) {
    log('❌ GitHub CLI 不可用', 'red');
    log('请安装 GitHub CLI: https://cli.github.com/', 'yellow');
    return false;
  }
}

// 检查GitHub Repository Secrets
function checkRepositorySecrets() {
  log('🔐 检查GitHub Repository Secrets...', 'blue');
  
  const requiredSecrets = [
    'CF_D1_DATABASE_NAME',
    'CF_D1_DATABASE_ID',
    'CLOUDFLARE_API_TOKEN',
    'ADMIN_TOKEN'
  ];
  
  try {
    const output = execSync(`gh secret list --repo ${REPO_OWNER}/${REPO_NAME}`, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const existingSecrets = output.split('\n')
      .filter(line => line.trim())
      .map(line => line.split('\t')[0]);
    
    log('📋 现有的Secrets:', 'blue');
    existingSecrets.forEach(secret => {
      log(`  - ${secret}`, 'blue');
    });
    
    // 检查必需的Secrets
    const missingRequired = requiredSecrets.filter(secret => 
      !existingSecrets.includes(secret)
    );
    
    if (missingRequired.length === 0) {
      log('✅ 所有必需的D1相关Secrets都已配置', 'green');
      return true;
    } else {
      log('❌ 缺失必需的D1相关Secrets:', 'red');
      missingRequired.forEach(secret => {
        log(`  - ${secret}`, 'red');
      });
      return false;
    }
    
  } catch (error) {
    log('❌ 无法获取Repository Secrets', 'red');
    log(`错误: ${error.message}`, 'red');
    return false;
  }
}

// 检查最新的GitHub Actions运行状态
function checkLatestWorkflowRun() {
  log('🔄 检查最新的GitHub Actions运行状态...', 'blue');
  
  try {
    const output = execSync(`gh run list --repo ${REPO_OWNER}/${REPO_NAME} --limit 1 --json status,conclusion,workflowName,createdAt`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const runs = JSON.parse(output);
    if (runs.length === 0) {
      log('⚠️ 没有找到GitHub Actions运行记录', 'yellow');
      return false;
    }
    
    const latestRun = runs[0];
    log(`📋 最新运行: ${latestRun.workflowName}`, 'blue');
    log(`📅 创建时间: ${latestRun.createdAt}`, 'blue');
    log(`📊 状态: ${latestRun.status}`, 'blue');
    
    if (latestRun.conclusion) {
      const color = latestRun.conclusion === 'success' ? 'green' : 'red';
      log(`🎯 结果: ${latestRun.conclusion}`, color);
      
      if (latestRun.conclusion === 'failure') {
        log('💡 提示: 如果失败是由于D1数据库配置错误，请按照指南配置Secrets', 'yellow');
      }
      
      return latestRun.conclusion === 'success';
    } else {
      log('🔄 运行中...', 'yellow');
      return false;
    }
    
  } catch (error) {
    log('❌ 无法获取GitHub Actions状态', 'red');
    log(`错误: ${error.message}`, 'red');
    return false;
  }
}

// 检查Workers API健康状态
async function checkWorkersHealth() {
  log('🏥 检查Workers API健康状态...', 'blue');
  
  try {
    const response = await httpRequest(`${API_BASE}/health`);
    
    if (response.status === 200 && response.data) {
      log('✅ Workers API 响应正常', 'green');
      
      const health = response.data;
      log(`📊 状态: ${health.status}`, health.status === 'healthy' ? 'green' : 'yellow');
      log(`🌍 环境: ${health.environment}`, 'blue');
      log(`📦 版本: ${health.version}`, 'blue');
      
      // 检查数据库健康状态
      if (health.database) {
        const dbHealthy = health.database.healthy;
        log(`🗄️ 数据库状态: ${dbHealthy ? '健康' : '不健康'}`, dbHealthy ? 'green' : 'red');
        
        if (health.database.stats) {
          const stats = health.database.stats;
          log(`📋 节点数量: ${stats.nodes?.total || 0}`, 'blue');
          log(`📋 启用节点: ${stats.nodes?.enabled || 0}`, 'blue');
          log(`📋 订阅数量: ${stats.subscriptions?.total || 0}`, 'blue');
        }
        
        if (health.database.error) {
          log(`❌ 数据库错误: ${health.database.error}`, 'red');
        }
        
        return dbHealthy;
      } else {
        log('⚠️ 数据库健康信息不可用', 'yellow');
        log('💡 这可能表示D1数据库配置有问题', 'yellow');
        return false;
      }
    } else {
      log(`❌ Workers API 响应异常: ${response.status}`, 'red');
      
      if (response.status === 500 && typeof response.data === 'string') {
        if (response.data.includes('database_id')) {
          log('💡 检测到D1数据库配置错误', 'yellow');
          log('请按照 D1_DATABASE_CONFIGURATION_GUIDE.md 配置数据库', 'yellow');
        }
      }
      
      return false;
    }
    
  } catch (error) {
    log('❌ 无法连接到Workers API', 'red');
    log(`错误: ${error.message}`, 'red');
    log('💡 这可能是由于D1数据库配置错误导致的部署失败', 'yellow');
    return false;
  }
}

// 检查wrangler.toml配置
function checkWranglerConfig() {
  log('📋 检查wrangler.toml配置...', 'blue');
  
  try {
    const fs = require('fs');
    const path = require('path');
    
    const wranglerPath = path.join(process.cwd(), 'workers', 'wrangler.toml');
    
    if (!fs.existsSync(wranglerPath)) {
      log('❌ wrangler.toml文件不存在', 'red');
      return false;
    }
    
    const content = fs.readFileSync(wranglerPath, 'utf8');
    
    // 检查D1数据库配置
    if (content.includes('${CF_D1_DATABASE_NAME}') && content.includes('${CF_D1_DATABASE_ID}')) {
      log('✅ wrangler.toml包含正确的环境变量占位符', 'green');
      log('  - database_name = "${CF_D1_DATABASE_NAME}"', 'blue');
      log('  - database_id = "${CF_D1_DATABASE_ID}"', 'blue');
      return true;
    } else {
      log('❌ wrangler.toml缺少D1数据库环境变量配置', 'red');
      return false;
    }
    
  } catch (error) {
    log('❌ 无法读取wrangler.toml文件', 'red');
    log(`错误: ${error.message}`, 'red');
    return false;
  }
}

// 生成配置报告
function generateReport(results) {
  log('\n📋 D1数据库配置验证报告', 'blue');
  log('===============================', 'blue');
  
  const checks = [
    { name: 'GitHub CLI', status: results.githubCLI },
    { name: 'Repository Secrets', status: results.secrets },
    { name: 'wrangler.toml配置', status: results.wranglerConfig },
    { name: 'GitHub Actions', status: results.workflow },
    { name: 'Workers API', status: results.workersHealth },
    { name: 'D1数据库连接', status: results.databaseConnection }
  ];
  
  checks.forEach(check => {
    const icon = check.status ? '✅' : '❌';
    const color = check.status ? 'green' : 'red';
    log(`${icon} ${check.name}`, color);
  });
  
  const allPassed = checks.every(check => check.status);
  
  log('\n🎯 总体状态', 'blue');
  if (allPassed) {
    log('✅ 所有检查通过！D1数据库配置正确', 'green');
    log('🎉 Sub-Store系统已准备就绪', 'green');
  } else {
    log('❌ 部分检查失败，需要修复D1数据库配置', 'red');
    log('📚 请参考: D1_DATABASE_CONFIGURATION_GUIDE.md', 'yellow');
    
    // 提供具体的修复建议
    if (!results.secrets) {
      log('\n🔧 修复建议:', 'yellow');
      log('1. 创建Cloudflare D1数据库: wrangler d1 create sub-store-db', 'yellow');
      log('2. 配置GitHub Secrets: CF_D1_DATABASE_NAME 和 CF_D1_DATABASE_ID', 'yellow');
      log('3. 重新部署: git push origin master', 'yellow');
    }
  }
  
  return allPassed;
}

// 主函数
async function main() {
  log('🚀 Sub-Store D1数据库配置验证', 'blue');
  log('================================\n', 'blue');
  
  const results = {};
  
  // 执行所有检查
  results.githubCLI = checkGitHubCLI();
  results.wranglerConfig = checkWranglerConfig();
  
  if (results.githubCLI) {
    results.secrets = checkRepositorySecrets();
    results.workflow = checkLatestWorkflowRun();
  } else {
    results.secrets = false;
    results.workflow = false;
  }
  
  results.workersHealth = await checkWorkersHealth();
  results.databaseConnection = results.workersHealth; // 如果API健康，数据库连接也正常
  
  // 生成报告
  const success = generateReport(results);
  
  // 退出码
  process.exit(success ? 0 : 1);
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    log(`❌ 验证过程中发生错误: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { main };
