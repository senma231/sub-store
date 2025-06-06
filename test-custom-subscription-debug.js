// 诊断自定义订阅创建功能的测试脚本
const API_BASE = 'https://substore-api.senmago231.workers.dev';
const ADMIN_TOKEN = 'Sz@2400104';

async function testLogin() {
  try {
    console.log('🔐 测试登录...');
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'admin',
        password: ADMIN_TOKEN
      })
    });
    
    const result = await response.json();
    if (result.success && result.data.token) {
      console.log('✅ 登录成功');
      return result.data.token;
    } else {
      console.log('❌ 登录失败:', result);
      return null;
    }
  } catch (error) {
    console.error('登录错误:', error);
    return null;
  }
}

async function testGetNodes(token) {
  try {
    console.log('\n📋 获取节点列表...');
    const response = await fetch(`${API_BASE}/api/nodes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    if (result.success && result.data.items) {
      console.log(`✅ 获取到 ${result.data.items.length} 个节点`);
      return result.data.items.slice(0, 3); // 返回前3个节点用于测试
    } else {
      console.log('❌ 获取节点失败:', result);
      return [];
    }
  } catch (error) {
    console.error('获取节点错误:', error);
    return [];
  }
}

async function testCreateCustomSubscription(token, nodes) {
  try {
    console.log('\n🔧 测试创建自定义订阅...');
    console.log('选择的节点ID:', nodes.map(n => n.id));
    
    const requestData = {
      name: '测试自定义订阅 - ' + new Date().toISOString(),
      nodeIds: nodes.map(n => n.id),
      format: 'v2ray',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7天后过期
    };
    
    console.log('请求数据:', JSON.stringify(requestData, null, 2));
    
    const response = await fetch(`${API_BASE}/api/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestData)
    });
    
    console.log('响应状态码:', response.status);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));
    
    const result = await response.text();
    console.log('响应内容:', result);
    
    try {
      const jsonResult = JSON.parse(result);
      if (jsonResult.success) {
        console.log('✅ 自定义订阅创建成功');
        console.log('订阅UUID:', jsonResult.data.subscription.uuid);
        console.log('订阅URL:', jsonResult.data.url);
        return jsonResult.data.subscription;
      } else {
        console.log('❌ 自定义订阅创建失败:', jsonResult.message);
        return null;
      }
    } catch (parseError) {
      console.log('❌ 响应不是有效的JSON:', parseError.message);
      return null;
    }
    
  } catch (error) {
    console.error('创建自定义订阅错误:', error);
    return null;
  }
}

async function testGetCustomSubscriptions(token) {
  try {
    console.log('\n📋 测试获取自定义订阅列表...');
    const response = await fetch(`${API_BASE}/api/subscriptions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('响应状态码:', response.status);
    const result = await response.json();
    console.log('响应内容:', result);
    
    if (result.success) {
      console.log(`✅ 获取到 ${result.data.length} 个自定义订阅`);
      return result.data;
    } else {
      console.log('❌ 获取自定义订阅列表失败:', result.message);
      return [];
    }
  } catch (error) {
    console.error('获取自定义订阅列表错误:', error);
    return [];
  }
}

async function testCustomSubscriptionAccess(subscription) {
  try {
    console.log('\n🔗 测试自定义订阅访问...');
    const response = await fetch(subscription.url || `${API_BASE}/sub/custom/${subscription.uuid}`);
    
    console.log('响应状态码:', response.status);
    console.log('响应头:', Object.fromEntries(response.headers.entries()));
    
    if (response.ok) {
      const content = await response.text();
      console.log('✅ 自定义订阅访问成功');
      console.log('内容长度:', content.length);
      
      // 验证V2Ray格式
      try {
        const decoded = atob(content);
        const lines = decoded.split('\n').filter(line => line.trim());
        console.log(`解码后包含 ${lines.length} 个节点链接`);
        console.log('示例链接:', lines[0]?.substring(0, 50) + '...');
      } catch (e) {
        console.log('内容不是base64格式或解码失败');
      }
    } else {
      const error = await response.text();
      console.log('❌ 自定义订阅访问失败:', error);
    }
  } catch (error) {
    console.error('自定义订阅访问错误:', error);
  }
}

async function testAPIEndpoints(token) {
  console.log('\n🔍 测试API端点可用性...');
  
  const endpoints = [
    { path: '/api/nodes', method: 'GET', description: '节点列表' },
    { path: '/api/subscriptions', method: 'GET', description: '自定义订阅列表' },
    { path: '/api/subscriptions', method: 'POST', description: '创建自定义订阅' },
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_BASE}${endpoint.path}`, {
        method: endpoint.method,
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        ...(endpoint.method === 'POST' && {
          body: JSON.stringify({
            name: 'test',
            nodeIds: ['test-id'],
            format: 'v2ray'
          })
        })
      });
      
      console.log(`${endpoint.method} ${endpoint.path} (${endpoint.description}): ${response.status}`);
    } catch (error) {
      console.log(`${endpoint.method} ${endpoint.path} (${endpoint.description}): ERROR - ${error.message}`);
    }
  }
}

async function main() {
  console.log('🚀 开始诊断自定义订阅创建功能...');
  console.log('API地址:', API_BASE);
  
  const token = await testLogin();
  if (!token) {
    console.log('❌ 无法获取认证令牌，停止测试');
    return;
  }
  
  // 测试API端点可用性
  await testAPIEndpoints(token);
  
  // 获取节点列表
  const nodes = await testGetNodes(token);
  if (nodes.length === 0) {
    console.log('❌ 没有可用节点，无法测试自定义订阅创建');
    return;
  }
  
  // 测试获取现有自定义订阅
  await testGetCustomSubscriptions(token);
  
  // 测试创建自定义订阅
  const subscription = await testCreateCustomSubscription(token, nodes);
  
  if (subscription) {
    // 测试访问创建的订阅
    await testCustomSubscriptionAccess(subscription);
    
    // 再次获取订阅列表，验证是否包含新创建的订阅
    console.log('\n🔄 验证新订阅是否在列表中...');
    const updatedSubscriptions = await testGetCustomSubscriptions(token);
    const found = updatedSubscriptions.find(s => s.uuid === subscription.uuid);
    if (found) {
      console.log('✅ 新创建的订阅已出现在列表中');
    } else {
      console.log('❌ 新创建的订阅未出现在列表中');
    }
  }
  
  console.log('\n🎉 自定义订阅功能诊断完成');
}

// 运行测试
main().catch(console.error);
