#!/usr/bin/env node

/**
 * Sub-Store 配置检查脚本
 * 用于验证所有必需的环境变量和配置是否正确设置
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// 配置检查项
const CONFIG_CHECKS = {
  github_secrets: [
    'CLOUDFLARE_API_TOKEN',
    'ADMIN_TOKEN', 
    'JWT_SECRET',
    'CORS_ORIGINS'
  ],
  workers_env: [
    'ADMIN_TOKEN',
    'JWT_SECRET', 
    'CORS_ORIGINS',
    'ENVIRONMENT',
    'APP_NAME'
  ],
  frontend_env: [
    'VITE_API_BASE_URL'
  ]
};

// API 端点
const API_ENDPOINTS = {
  workers: 'https://substore-api.senmago231.workers.dev',
  frontend: 'https://sub-store-frontend.pages.dev'
};

console.log('🔍 Sub-Store 配置检查开始...\n');

// 1. 检查本地文件配置
function checkLocalFiles() {
  console.log('📁 检查本地配置文件...');
  
  const files = [
    'frontend/.env.production',
    'workers/wrangler.toml',
    '.github/workflows/deploy.yml'
  ];
  
  files.forEach(file => {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      console.log(`  ✅ ${file} - 存在`);
    } else {
      console.log(`  ❌ ${file} - 缺失`);
    }
  });
  
  console.log();
}

// 2. 检查 API 健康状态
function checkAPIHealth() {
  console.log('🌐 检查 API 健康状态...');
  
  return new Promise((resolve) => {
    const req = https.get(`${API_ENDPOINTS.workers}/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`  ✅ Workers API - 状态: ${res.statusCode}`);
          console.log(`  📊 响应: ${JSON.stringify(response, null, 2)}`);
        } catch (e) {
          console.log(`  ⚠️ Workers API - 响应解析失败: ${data}`);
        }
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log(`  ❌ Workers API - 连接失败: ${err.message}`);
      resolve();
    });
    
    req.setTimeout(5000, () => {
      console.log(`  ⏰ Workers API - 请求超时`);
      req.destroy();
      resolve();
    });
  });
}

// 3. 测试登录端点
function testLoginEndpoint() {
  console.log('🔐 测试登录端点...');
  
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      username: 'test',
      password: 'test'
    });
    
    const options = {
      hostname: 'substore-api.senmago231.workers.dev',
      port: 443,
      path: '/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`  📡 登录端点状态码: ${res.statusCode}`);
        if (res.statusCode === 405) {
          console.log(`  ❌ 405 错误 - 方法不允许，可能是路由配置问题`);
        } else if (res.statusCode === 401) {
          console.log(`  ✅ 401 错误 - 端点正常，凭据无效（预期行为）`);
        } else {
          console.log(`  📄 响应: ${data}`);
        }
        resolve();
      });
    });
    
    req.on('error', (err) => {
      console.log(`  ❌ 登录端点测试失败: ${err.message}`);
      resolve();
    });
    
    req.setTimeout(5000, () => {
      console.log(`  ⏰ 登录端点测试超时`);
      req.destroy();
      resolve();
    });
    
    req.write(postData);
    req.end();
  });
}

// 4. 检查前端部署
function checkFrontendDeployment() {
  console.log('🎨 检查前端部署...');
  
  return new Promise((resolve) => {
    const req = https.get(API_ENDPOINTS.frontend, (res) => {
      console.log(`  📱 前端状态码: ${res.statusCode}`);
      if (res.statusCode === 200) {
        console.log(`  ✅ 前端部署正常`);
      } else {
        console.log(`  ⚠️ 前端可能存在问题`);
      }
      resolve();
    });
    
    req.on('error', (err) => {
      console.log(`  ❌ 前端检查失败: ${err.message}`);
      resolve();
    });
    
    req.setTimeout(5000, () => {
      console.log(`  ⏰ 前端检查超时`);
      req.destroy();
      resolve();
    });
  });
}

// 主函数
async function main() {
  checkLocalFiles();
  await checkAPIHealth();
  console.log();
  await testLoginEndpoint();
  console.log();
  await checkFrontendDeployment();
  
  console.log('\n📋 配置检查完成！');
  console.log('\n🔧 如果发现问题，请检查：');
  console.log('  1. GitHub Secrets 是否正确配置');
  console.log('  2. Cloudflare Workers 环境变量是否设置');
  console.log('  3. 最新代码是否已部署');
  console.log('  4. CORS 配置是否包含前端域名');
}

main().catch(console.error);
