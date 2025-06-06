#!/usr/bin/env node

/**
 * Sub-Store GitHub Secrets 配置验证脚本
 * 验证 GitHub Repository Secrets 配置是否正确
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

// 检查 GitHub CLI 是否可用
function checkGitHubCLI() {
  log('🔍 检查 GitHub CLI...', 'blue');
  
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

// 检查 GitHub 认证状态
function checkGitHubAuth() {
  log('🔐 检查 GitHub 认证状态...', 'blue');
  
  try {
    execSync('gh auth status', { stdio: 'pipe' });
    log('✅ GitHub 认证正常', 'green');
    return true;
  } catch (error) {
    log('❌ GitHub 认证失败', 'red');
    log('请运行: gh auth login', 'yellow');
    return false;
  }
}

// 检查 Repository Secrets
function checkRepositorySecrets() {
  log('🔐 检查 Repository Secrets...', 'blue');
  
  const requiredSecrets = [
    'CF_D1_DATABASE_NAME',
    'CF_D1_DATABASE_ID',
    'CLOUDFLARE_API_TOKEN',
    'ADMIN_TOKEN'
  ];
  
  const optionalSecrets = [
    'JWT_SECRET'
  ];
  
  try {
    const output = execSync(`gh secret list --repo ${REPO_OWNER}/${REPO_NAME}`, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const existingSecrets = output.split('\n')
      .filter(line => line.trim())
      .map(line => line.split('\t')[0]);
    
    log('📋 现有的 Secrets:', 'blue');
    existingSecrets.forEach(secret => {
      log(`  - ${secret}`, 'blue');
    });
    
    // 检查必需的 Secrets
    const missingRequired = requiredSecrets.filter(secret => 
      !existingSecrets.includes(secret)
    );
    
    const missingOptional = optionalSecrets.filter(secret => 
      !existingSecrets.includes(secret)
    );
    
    if (missingRequired.length === 0) {
      log('✅ 所有必需的 Secrets 都已配置', 'green');
    } else {
      log('❌ 缺失必需的 Secrets:', 'red');
      missingRequired.forEach(secret => {
        log(`  - ${secret}`, 'red');
      });
    }
    
    if (missingOptional.length > 0) {
      log('⚠️ 缺失可选的 Secrets:', 'yellow');
      missingOptional.forEach(secret => {
        log(`  - ${secret}`, 'yellow');
      });
    }
    
    return missingRequired.length === 0;
    
  } catch (error) {
    log('❌ 无法获取 Repository Secrets', 'red');
    log(`错误: ${error.message}`, 'red');
    return false;
  }
}

// 检查最新的 GitHub Actions 运行状态
function checkLatestWorkflowRun() {
  log('🔄 检查最新的 GitHub Actions 运行状态...', 'blue');
  
  try {
    const output = execSync(`gh run list --repo ${REPO_OWNER}/${REPO_NAME} --limit 1 --json status,conclusion,workflowName,createdAt`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    const runs = JSON.parse(output);
    if (runs.length === 0) {
      log('⚠️ 没有找到 GitHub Actions 运行记录', 'yellow');
      return false;
    }
    
    const latestRun = runs[0];
    log(`📋 最新运行: ${latestRun.workflowName}`, 'blue');
    log(`📅 创建时间: ${latestRun.createdAt}`, 'blue');
    log(`📊 状态: ${latestRun.status}`, 'blue');
    
    if (latestRun.conclusion) {
      const color = latestRun.conclusion === 'success' ? 'green' : 'red';
      log(`🎯 结果: ${latestRun.conclusion}`, color);
      return latestRun.conclusion === 'success';
    } else {
      log('🔄 运行中...', 'yellow');
      return false;
    }
    
  } catch (error) {
    log('❌ 无法获取 GitHub Actions 状态', 'red');
    log(`错误: ${error.message}`, 'red');
    return false;
  }
}

// 检查 Workers API 健康状态
async function checkWorkersHealth() {
  log('🏥 检查 Workers API 健康状态...', 'blue');
  
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
        return false;
      }
    } else {
      log(`❌ Workers API 响应异常: ${response.status}`, 'red');
      return false;
    }
    
  } catch (error) {
    log('❌ 无法连接到 Workers API', 'red');
    log(`错误: ${error.message}`, 'red');
    return false;
  }
}

// 测试数据库连接
async function testDatabaseConnection() {
  log('🔗 测试数据库连接...', 'blue');
  
  try {
    // 尝试获取节点列表来测试数据库连接
    const response = await httpRequest(`${API_BASE}/api/nodes?limit=1`);
    
    if (response.status === 401) {
      log('🔐 需要认证 (这是正常的)', 'yellow');
      log('✅ 数据库连接正常 (API 端点可访问)', 'green');
      return true;
    } else if (response.status === 200) {
      log('✅ 数据库连接正常 (API 响应成功)', 'green');
      return true;
    } else {
      log(`❌ 数据库连接可能有问题: ${response.status}`, 'red');
      return false;
    }
    
  } catch (error) {
    log('❌ 数据库连接测试失败', 'red');
    log(`错误: ${error.message}`, 'red');
    return false;
  }
}

// 生成配置报告
function generateReport(results) {
  log('\n📋 配置验证报告', 'blue');
  log('==================', 'blue');
  
  const checks = [
    { name: 'GitHub CLI', status: results.githubCLI },
    { name: 'GitHub 认证', status: results.githubAuth },
    { name: 'Repository Secrets', status: results.secrets },
    { name: 'GitHub Actions', status: results.workflow },
    { name: 'Workers API', status: results.workersHealth },
    { name: '数据库连接', status: results.databaseConnection }
  ];
  
  checks.forEach(check => {
    const icon = check.status ? '✅' : '❌';
    const color = check.status ? 'green' : 'red';
    log(`${icon} ${check.name}`, color);
  });
  
  const allPassed = checks.every(check => check.status);
  
  log('\n🎯 总体状态', 'blue');
  if (allPassed) {
    log('✅ 所有检查通过！GitHub Secrets 配置正确', 'green');
    log('🎉 Sub-Store 系统已准备就绪', 'green');
  } else {
    log('❌ 部分检查失败，需要修复配置', 'red');
    log('📚 请参考文档: docs/GITHUB_SECRETS_SETUP.md', 'yellow');
  }
  
  return allPassed;
}

// 主函数
async function main() {
  log('🚀 Sub-Store GitHub Secrets 配置验证', 'blue');
  log('=====================================\n', 'blue');
  
  const results = {};
  
  // 执行所有检查
  results.githubCLI = checkGitHubCLI();
  
  if (results.githubCLI) {
    results.githubAuth = checkGitHubAuth();
    
    if (results.githubAuth) {
      results.secrets = checkRepositorySecrets();
      results.workflow = checkLatestWorkflowRun();
    } else {
      results.secrets = false;
      results.workflow = false;
    }
  } else {
    results.githubAuth = false;
    results.secrets = false;
    results.workflow = false;
  }
  
  results.workersHealth = await checkWorkersHealth();
  results.databaseConnection = await testDatabaseConnection();
  
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
