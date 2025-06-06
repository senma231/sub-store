// 获取真实的节点ID用于修复测试数据
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

async function getRealNodeIds(token) {
  try {
    const response = await fetch(`${API_BASE}/api/nodes`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const result = await response.json();
    if (result.success && result.data.items) {
      const enabledNodes = result.data.items.filter(node => node.enabled);
      console.log('启用的节点:');
      enabledNodes.slice(0, 5).forEach((node, index) => {
        console.log(`${index + 1}. ID: "${node.id}", 名称: "${node.name}", 类型: ${node.type}`);
      });
      return enabledNodes.slice(0, 3).map(node => node.id); // 返回前3个启用节点的ID
    }
    return [];
  } catch (error) {
    console.error('获取节点错误:', error);
    return [];
  }
}

async function main() {
  console.log('🚀 获取真实节点ID...');
  
  const token = await testLogin();
  if (!token) {
    console.log('❌ 登录失败');
    return;
  }
  
  const nodeIds = await getRealNodeIds(token);
  console.log('\n📋 建议的测试订阅节点ID:');
  console.log(JSON.stringify(nodeIds, null, 2));
  
  console.log('\n🔧 修复代码:');
  console.log(`nodeIds: ${JSON.stringify(nodeIds)},`);
}

main().catch(console.error);
