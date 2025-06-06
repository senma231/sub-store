// 专门测试自定义订阅访问的调试脚本
const API_BASE = 'https://substore-api.senmago231.workers.dev';
const ADMIN_TOKEN = 'Sz@2400104';

async function testLogin() {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: ADMIN_TOKEN })
    });
    
    const result = await response.json();
    return result.success ? result.data.token : null;
  } catch (error) {
    console.error('登录错误:', error);
    return null;
  }
}

async function testSubscriptionAccess(uuid, token) {
  console.log(`\n🔗 测试订阅访问: ${uuid}`);
  
  try {
    // 1. 直接访问订阅链接
    console.log('1. 直接访问订阅链接...');
    const directResponse = await fetch(`${API_BASE}/sub/custom/${uuid}`);
    console.log(`直接访问状态码: ${directResponse.status}`);
    
    if (directResponse.ok) {
      const content = await directResponse.text();
      console.log(`✅ 直接访问成功，内容长度: ${content.length}`);
      return true;
    } else {
      const error = await directResponse.text();
      console.log(`❌ 直接访问失败: ${error}`);
    }
    
    // 2. 带认证头访问
    console.log('2. 带认证头访问...');
    const authResponse = await fetch(`${API_BASE}/sub/custom/${uuid}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`带认证访问状态码: ${authResponse.status}`);
    
    if (authResponse.ok) {
      const content = await authResponse.text();
      console.log(`✅ 带认证访问成功，内容长度: ${content.length}`);
      return true;
    } else {
      const error = await authResponse.text();
      console.log(`❌ 带认证访问失败: ${error}`);
    }
    
    // 3. 通过API获取订阅详情
    console.log('3. 通过API获取订阅详情...');
    const apiResponse = await fetch(`${API_BASE}/api/subscriptions/${uuid}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log(`API访问状态码: ${apiResponse.status}`);
    
    if (apiResponse.ok) {
      const result = await apiResponse.json();
      console.log(`✅ API访问成功:`, result.success);
      if (result.success) {
        console.log('订阅详情:', {
          name: result.data.subscription.name,
          nodeCount: result.data.subscription.nodeIds.length,
          format: result.data.subscription.format
        });
      }
    } else {
      const error = await apiResponse.text();
      console.log(`❌ API访问失败: ${error}`);
    }
    
    return false;
  } catch (error) {
    console.error('测试订阅访问错误:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 开始测试自定义订阅访问...');
  
  const token = await testLogin();
  if (!token) {
    console.log('❌ 登录失败');
    return;
  }
  console.log('✅ 登录成功');
  
  // 获取现有订阅列表
  console.log('\n📋 获取现有订阅列表...');
  const listResponse = await fetch(`${API_BASE}/api/subscriptions`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (listResponse.ok) {
    const result = await listResponse.json();
    if (result.success && result.data.length > 0) {
      console.log(`找到 ${result.data.length} 个订阅`);
      
      // 测试每个订阅的访问
      for (const subscription of result.data) {
        const success = await testSubscriptionAccess(subscription.uuid, token);
        console.log(`订阅 ${subscription.name} (${subscription.uuid}): ${success ? '✅ 成功' : '❌ 失败'}`);
      }
    } else {
      console.log('没有找到订阅');
    }
  } else {
    console.log('获取订阅列表失败');
  }
  
  console.log('\n🎉 测试完成');
}

main().catch(console.error);
