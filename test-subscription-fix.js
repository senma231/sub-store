// 测试Sub-Store订阅功能修复的脚本
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
      console.log('❌ 登录失败');
      return null;
    }
  } catch (error) {
    console.error('登录错误:', error);
    return null;
  }
}

async function testStandardSubscriptions(token) {
  console.log('\n📋 测试标准订阅功能...');
  
  const formats = ['v2ray', 'clash', 'shadowrocket'];
  
  for (const format of formats) {
    try {
      console.log(`\n🔍 测试 ${format.toUpperCase()} 格式订阅...`);
      
      const response = await fetch(`${API_BASE}/sub/${format}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });
      
      console.log(`状态码: ${response.status}`);
      console.log(`Content-Type: ${response.headers.get('Content-Type')}`);
      console.log(`Content-Disposition: ${response.headers.get('Content-Disposition')}`);
      
      if (response.ok) {
        const content = await response.text();
        console.log(`✅ ${format} 订阅获取成功`);
        console.log(`内容长度: ${content.length} 字符`);
        
        // 验证V2Ray格式是否为base64编码
        if (format === 'v2ray') {
          try {
            const decoded = atob(content);
            const lines = decoded.split('\n').filter(line => line.trim());
            console.log(`解码后包含 ${lines.length} 个节点链接`);
            console.log(`示例链接: ${lines[0]?.substring(0, 50)}...`);
          } catch (e) {
            console.log('❌ V2Ray内容不是有效的base64编码');
          }
        }
        
        // 验证Clash格式是否为YAML
        if (format === 'clash') {
          if (content.includes('proxies:') && content.includes('proxy-groups:')) {
            console.log('✅ Clash配置格式正确');
          } else {
            console.log('❌ Clash配置格式不正确');
          }
        }
        
      } else {
        const error = await response.text();
        console.log(`❌ ${format} 订阅获取失败: ${error}`);
      }
    } catch (error) {
      console.error(`${format} 订阅测试错误:`, error);
    }
  }
}

async function testCustomSubscription(token) {
  console.log('\n📝 测试自定义订阅功能...');
  
  try {
    // 1. 获取节点列表
    console.log('获取节点列表...');
    const nodesResponse = await fetch(`${API_BASE}/api/nodes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const nodesResult = await nodesResponse.json();
    
    if (!nodesResult.success || !nodesResult.data.items.length) {
      console.log('❌ 没有可用节点，跳过自定义订阅测试');
      return;
    }
    
    const nodes = nodesResult.data.items;
    console.log(`找到 ${nodes.length} 个节点`);
    
    // 2. 创建自定义订阅
    console.log('创建自定义订阅...');
    const createResponse = await fetch(`${API_BASE}/api/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: '测试订阅修复',
        nodeIds: nodes.slice(0, 3).map(n => n.id), // 选择前3个节点
        format: 'v2ray'
      })
    });
    
    const createResult = await createResponse.json();
    if (!createResult.success) {
      console.log('❌ 创建自定义订阅失败:', createResult.message);
      return;
    }
    
    const subscription = createResult.data.subscription;
    console.log(`✅ 自定义订阅创建成功，UUID: ${subscription.uuid}`);
    
    // 3. 测试自定义订阅访问
    console.log('测试自定义订阅访问...');
    const subResponse = await fetch(`${API_BASE}/sub/custom/${subscription.uuid}`);
    
    console.log(`状态码: ${subResponse.status}`);
    console.log(`Content-Type: ${subResponse.headers.get('Content-Type')}`);
    
    if (subResponse.ok) {
      const content = await subResponse.text();
      console.log('✅ 自定义订阅访问成功');
      console.log(`内容长度: ${content.length} 字符`);
      
      // 验证内容
      try {
        const decoded = atob(content);
        const lines = decoded.split('\n').filter(line => line.trim());
        console.log(`✅ 包含 ${lines.length} 个节点链接`);
        console.log(`示例链接: ${lines[0]?.substring(0, 50)}...`);
      } catch (e) {
        console.log('❌ 自定义订阅内容不是有效的base64编码');
      }
    } else {
      const error = await subResponse.text();
      console.log(`❌ 自定义订阅访问失败: ${error}`);
    }
    
    // 4. 清理测试数据
    console.log('清理测试数据...');
    await fetch(`${API_BASE}/api/subscriptions/${subscription.uuid}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
  } catch (error) {
    console.error('自定义订阅测试错误:', error);
  }
}

async function testSubscriptionInfo(token) {
  console.log('\n📊 测试订阅信息接口...');
  
  try {
    const response = await fetch(`${API_BASE}/sub/v2ray/info`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('✅ 订阅信息获取成功');
      console.log(`总节点数: ${result.data.statistics.totalNodes}`);
      console.log(`启用节点数: ${result.data.statistics.enabledNodes}`);
      console.log('节点类型分布:', result.data.statistics.nodeTypes);
    } else {
      console.log('❌ 订阅信息获取失败');
    }
  } catch (error) {
    console.error('订阅信息测试错误:', error);
  }
}

async function main() {
  console.log('🚀 开始测试Sub-Store订阅功能修复...');
  console.log('API地址:', API_BASE);
  
  const token = await testLogin();
  if (!token) {
    console.log('❌ 无法获取认证令牌，停止测试');
    return;
  }
  
  await testStandardSubscriptions(token);
  await testCustomSubscription(token);
  await testSubscriptionInfo(token);
  
  console.log('\n🎉 订阅功能测试完成');
}

// 运行测试
main().catch(console.error);
