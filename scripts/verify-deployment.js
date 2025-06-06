#!/usr/bin/env node

/**
 * 部署验证脚本
 * 验证 Sub-Store API 的完整功能
 */

const https = require('https');
const http = require('http');

const API_BASE_URL = 'https://substore-api.senmago231.workers.dev';
const ADMIN_TOKEN = 'Sz@2400104'; // 从用户记忆中获取

console.log('🔍 开始验证 Sub-Store 部署...\n');

// HTTP 请求工具函数
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Sub-Store-Verification/1.0',
        ...options.headers
      }
    };

    const req = (urlObj.protocol === 'https:' ? https : http).request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData, headers: res.headers });
        } catch (error) {
          resolve({ status: res.statusCode, data: data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    
    req.end();
  });
}

// 验证测试
async function runVerification() {
  const tests = [];

  // 1. 健康检查
  console.log('1️⃣ 健康检查...');
  try {
    const health = await makeRequest(`${API_BASE_URL}/health`);
    if (health.status === 200) {
      console.log('✅ 健康检查通过');
      console.log(`   状态: ${health.data.status}`);
      console.log(`   数据库: ${health.data.services?.database || 'unknown'}`);
      console.log(`   节点数: ${health.data.database?.nodeCount || 0}`);
      console.log(`   订阅数: ${health.data.database?.subscriptionCount || 0}`);
      tests.push({ name: 'Health Check', status: 'PASS' });
    } else {
      console.log('❌ 健康检查失败');
      tests.push({ name: 'Health Check', status: 'FAIL', error: health.data });
    }
  } catch (error) {
    console.log('❌ 健康检查错误:', error.message);
    tests.push({ name: 'Health Check', status: 'ERROR', error: error.message });
  }

  // 2. 根路径检查
  console.log('\n2️⃣ 根路径检查...');
  try {
    const root = await makeRequest(`${API_BASE_URL}/`);
    if (root.status === 200) {
      console.log('✅ 根路径响应正常');
      console.log(`   应用名: ${root.data.name}`);
      console.log(`   版本: ${root.data.version}`);
      console.log(`   环境: ${root.data.environment}`);
      tests.push({ name: 'Root Path', status: 'PASS' });
    } else {
      console.log('❌ 根路径检查失败');
      tests.push({ name: 'Root Path', status: 'FAIL', error: root.data });
    }
  } catch (error) {
    console.log('❌ 根路径错误:', error.message);
    tests.push({ name: 'Root Path', status: 'ERROR', error: error.message });
  }

  // 3. 认证测试
  console.log('\n3️⃣ 认证系统测试...');
  try {
    const auth = await makeRequest(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      body: {
        username: 'admin',
        password: ADMIN_TOKEN
      }
    });
    
    if (auth.status === 200 && auth.data.success) {
      console.log('✅ 认证系统正常');
      console.log(`   令牌: ${auth.data.token ? '已生成' : '未生成'}`);
      tests.push({ name: 'Authentication', status: 'PASS' });
      
      // 4. 节点 API 测试 (需要认证)
      if (auth.data.token) {
        console.log('\n4️⃣ 节点 API 测试...');
        try {
          const nodes = await makeRequest(`${API_BASE_URL}/api/nodes`, {
            headers: {
              'Authorization': `Bearer ${auth.data.token}`
            }
          });
          
          if (nodes.status === 200) {
            console.log('✅ 节点 API 正常');
            console.log(`   节点数量: ${nodes.data.data?.items?.length || 0}`);
            tests.push({ name: 'Nodes API', status: 'PASS' });
          } else {
            console.log('❌ 节点 API 失败');
            tests.push({ name: 'Nodes API', status: 'FAIL', error: nodes.data });
          }
        } catch (error) {
          console.log('❌ 节点 API 错误:', error.message);
          tests.push({ name: 'Nodes API', status: 'ERROR', error: error.message });
        }
      }
      
    } else {
      console.log('❌ 认证失败');
      tests.push({ name: 'Authentication', status: 'FAIL', error: auth.data });
    }
  } catch (error) {
    console.log('❌ 认证错误:', error.message);
    tests.push({ name: 'Authentication', status: 'ERROR', error: error.message });
  }

  // 5. CORS 检查
  console.log('\n5️⃣ CORS 配置检查...');
  try {
    const cors = await makeRequest(`${API_BASE_URL}/health`, {
      headers: {
        'Origin': 'https://sub-store-frontend.pages.dev'
      }
    });
    
    if (cors.headers['access-control-allow-origin']) {
      console.log('✅ CORS 配置正常');
      console.log(`   允许源: ${cors.headers['access-control-allow-origin']}`);
      tests.push({ name: 'CORS', status: 'PASS' });
    } else {
      console.log('⚠️ CORS 配置可能有问题');
      tests.push({ name: 'CORS', status: 'WARN' });
    }
  } catch (error) {
    console.log('❌ CORS 检查错误:', error.message);
    tests.push({ name: 'CORS', status: 'ERROR', error: error.message });
  }

  // 生成报告
  console.log('\n📊 验证报告');
  console.log('='.repeat(50));
  
  const passed = tests.filter(t => t.status === 'PASS').length;
  const failed = tests.filter(t => t.status === 'FAIL').length;
  const errors = tests.filter(t => t.status === 'ERROR').length;
  const warnings = tests.filter(t => t.status === 'WARN').length;
  
  tests.forEach(test => {
    const icon = {
      'PASS': '✅',
      'FAIL': '❌', 
      'ERROR': '💥',
      'WARN': '⚠️'
    }[test.status];
    
    console.log(`${icon} ${test.name}: ${test.status}`);
    if (test.error) {
      console.log(`   错误: ${JSON.stringify(test.error, null, 2)}`);
    }
  });
  
  console.log('\n📈 统计:');
  console.log(`   通过: ${passed}`);
  console.log(`   失败: ${failed}`);
  console.log(`   错误: ${errors}`);
  console.log(`   警告: ${warnings}`);
  
  if (failed === 0 && errors === 0) {
    console.log('\n🎉 所有核心功能验证通过！');
    return true;
  } else {
    console.log('\n⚠️ 部分功能需要修复');
    return false;
  }
}

// 运行验证
runVerification().catch(console.error);
