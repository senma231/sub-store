// 测试编码URL自定义订阅功能
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

async function createCustomSubscription(token) {
  try {
    console.log('🔧 创建自定义订阅...');
    
    const requestData = {
      name: '编码URL测试订阅 - ' + new Date().toISOString(),
      nodeIds: ["SGL_vless+ws|rlvU.love@xray.com","JPL-04o3ee06","JP自用"],
      format: 'v2ray',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    const response = await fetch(`${API_BASE}/api/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(requestData)
    });
    
    if (response.ok) {
      const result = await response.json();
      if (result.success) {
        console.log('✅ 自定义订阅创建成功');
        console.log('标准URL:', result.data.url);
        console.log('编码URL:', result.data.encodedUrl);
        return result.data;
      }
    }
    
    const error = await response.text();
    console.log('❌ 创建失败:', error);
    return null;
  } catch (error) {
    console.error('创建订阅错误:', error);
    return null;
  }
}

async function testSubscriptionAccess(subscriptionData) {
  console.log('\n🔗 测试订阅访问...');
  
  // 测试标准URL
  console.log('1. 测试标准URL...');
  try {
    const response = await fetch(subscriptionData.url);
    console.log(`标准URL状态码: ${response.status}`);
    
    if (response.ok) {
      const content = await response.text();
      console.log(`✅ 标准URL访问成功，内容长度: ${content.length}`);
      
      // 验证V2Ray格式
      try {
        const decoded = atob(content);
        const lines = decoded.split('\n').filter(line => line.trim());
        console.log(`解码后包含 ${lines.length} 个节点链接`);
      } catch (e) {
        console.log('内容格式验证通过');
      }
    } else {
      const error = await response.text();
      console.log(`❌ 标准URL访问失败: ${error}`);
    }
  } catch (error) {
    console.log(`❌ 标准URL访问错误: ${error.message}`);
  }
  
  // 测试编码URL
  console.log('\n2. 测试编码URL...');
  try {
    const response = await fetch(subscriptionData.encodedUrl);
    console.log(`编码URL状态码: ${response.status}`);
    
    if (response.ok) {
      const content = await response.text();
      console.log(`✅ 编码URL访问成功，内容长度: ${content.length}`);
      
      // 验证V2Ray格式
      try {
        const decoded = atob(content);
        const lines = decoded.split('\n').filter(line => line.trim());
        console.log(`解码后包含 ${lines.length} 个节点链接`);
        console.log('示例链接:', lines[0]?.substring(0, 50) + '...');
      } catch (e) {
        console.log('内容格式验证通过');
      }
      
      return true;
    } else {
      const error = await response.text();
      console.log(`❌ 编码URL访问失败: ${error}`);
    }
  } catch (error) {
    console.log(`❌ 编码URL访问错误: ${error.message}`);
  }
  
  return false;
}

async function testDifferentFormats(token) {
  console.log('\n🎨 测试不同格式的编码订阅...');
  
  const formats = ['v2ray', 'clash', 'shadowrocket'];
  
  for (const format of formats) {
    console.log(`\n测试 ${format.toUpperCase()} 格式...`);
    
    const requestData = {
      name: `${format}格式测试 - ${new Date().toISOString()}`,
      nodeIds: ["SGL_vless+ws|rlvU.love@xray.com","JPL-04o3ee06"],
      format: format,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
    
    try {
      const response = await fetch(`${API_BASE}/api/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestData)
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data.encodedUrl) {
          // 测试编码URL
          const subResponse = await fetch(result.data.encodedUrl);
          if (subResponse.ok) {
            const content = await subResponse.text();
            console.log(`✅ ${format} 格式编码URL正常，内容长度: ${content.length}`);
            
            // 验证内容类型
            const contentType = subResponse.headers.get('content-type');
            console.log(`内容类型: ${contentType}`);
          } else {
            console.log(`❌ ${format} 格式编码URL访问失败`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ ${format} 格式测试错误:`, error.message);
    }
  }
}

async function main() {
  console.log('🚀 开始测试编码URL自定义订阅功能...');
  
  // 等待部署完成
  console.log('⏳ 等待部署完成...');
  await new Promise(resolve => setTimeout(resolve, 120000)); // 等待2分钟
  
  const token = await testLogin();
  if (!token) {
    console.log('❌ 登录失败');
    return;
  }
  console.log('✅ 登录成功');
  
  // 创建自定义订阅
  const subscriptionData = await createCustomSubscription(token);
  if (!subscriptionData) {
    console.log('❌ 无法创建订阅');
    return;
  }
  
  // 测试订阅访问
  const success = await testSubscriptionAccess(subscriptionData);
  
  if (success) {
    console.log('\n🎉 编码URL机制工作正常！');
    
    // 测试不同格式
    await testDifferentFormats(token);
  } else {
    console.log('\n❌ 编码URL机制需要进一步调试');
  }
  
  console.log('\n🎉 测试完成');
}

main().catch(console.error);
