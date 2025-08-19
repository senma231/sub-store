/**
 * 订阅链接安全功能测试脚本
 * 测试访问频率限制和User-Agent检测
 */

const API_BASE_URL = 'https://sub-api.senma.io';

// 测试用的订阅UUID（请替换为实际的UUID）
const TEST_UUID = 'test-subscription-uuid';

// 先创建一个测试订阅
async function createTestSubscription() {
  console.log('🔧 创建测试订阅...');

  try {
    const response = await fetch(`${API_BASE_URL}/api/custom-subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'Sz@2400104'}`
      },
      body: JSON.stringify({
        name: '安全测试订阅',
        format: 'v2ray',
        nodeIds: [], // 空节点列表用于测试
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时后过期
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ 测试订阅创建成功:', result.data.uuid);
      return result.data.uuid;
    } else {
      console.log('❌ 创建测试订阅失败:', response.status);
      return null;
    }

  } catch (error) {
    console.error('创建测试订阅失败:', error.message);
    return null;
  }
}

// 测试访问频率限制
async function testRateLimit() {
  console.log('🧪 测试访问频率限制...');

  const testUuid = global.TEST_UUID || TEST_UUID;
  const testUrl = `${API_BASE_URL}/sub/custom/${testUuid}`;

  // 快速发送多个请求
  for (let i = 1; i <= 65; i++) {
    try {
      const response = await fetch(testUrl, {
        headers: {
          'User-Agent': 'v2rayN/6.23'
        }
      });

      console.log(`请求 ${i}: ${response.status} ${response.statusText}`);

      if (response.status === 429) {
        console.log('✅ 访问频率限制生效！');
        const retryAfter = response.headers.get('Retry-After');
        console.log(`Retry-After: ${retryAfter} 秒`);
        break;
      }

      // 短暂延迟避免过快请求
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`请求 ${i} 失败:`, error.message);
    }
  }
}

// 测试User-Agent检测
async function testUserAgentDetection() {
  console.log('🧪 测试User-Agent检测...');

  const testUuid = global.TEST_UUID || TEST_UUID;
  const testUrl = `${API_BASE_URL}/sub/custom/${testUuid}`;

  // 测试可疑User-Agent
  const suspiciousUserAgents = [
    'curl/7.68.0',
    'wget/1.20.3',
    'python-requests/2.25.1',
    'PostmanRuntime/7.28.0'
  ];

  for (const userAgent of suspiciousUserAgents) {
    try {
      const response = await fetch(testUrl, {
        headers: {
          'User-Agent': userAgent
        }
      });

      const content = await response.text();
      console.log(`UA: ${userAgent} - 状态: ${response.status} - 内容长度: ${content.length}`);

      if (content.length === 0 && response.status === 200) {
        console.log('✅ 可疑User-Agent被正确拦截！');
      }

    } catch (error) {
      console.error(`测试 ${userAgent} 失败:`, error.message);
    }
  }

  // 测试正常User-Agent
  const validUserAgents = [
    'v2rayN/6.23',
    'Clash/1.18.0',
    'Shadowrocket/1.0'
  ];

  for (const userAgent of validUserAgents) {
    try {
      const response = await fetch(testUrl, {
        headers: {
          'User-Agent': userAgent
        }
      });

      console.log(`UA: ${userAgent} - 状态: ${response.status}`);

      if (response.status === 200) {
        console.log('✅ 正常User-Agent通过检测！');
      }

    } catch (error) {
      console.error(`测试 ${userAgent} 失败:`, error.message);
    }
  }
}

// 测试安全订阅链接
async function testSecureSubscription() {
  console.log('🧪 测试安全订阅链接...');

  try {
    const testUuid = global.TEST_UUID || TEST_UUID;

    // 生成安全链接
    const generateResponse = await fetch(`${API_BASE_URL}/secure/generate-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ADMIN_TOKEN || 'Sz@2400104'}`
      },
      body: JSON.stringify({
        uuid: testUuid,
        format: 'v2ray'
      })
    });

    if (generateResponse.ok) {
      const result = await generateResponse.json();
      console.log('✅ 安全链接生成成功:', result.data.secureUrl);

      // 测试访问安全链接
      const accessResponse = await fetch(result.data.secureUrl, {
        headers: {
          'User-Agent': 'v2rayN/6.23'
        }
      });

      console.log(`安全链接访问: ${accessResponse.status} ${accessResponse.statusText}`);

    } else {
      console.log('❌ 安全链接生成失败:', generateResponse.status);
    }

  } catch (error) {
    console.error('测试安全订阅链接失败:', error.message);
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('🚀 开始订阅链接安全功能测试...\n');

  // 先创建测试订阅
  const testUuid = await createTestSubscription();
  if (!testUuid) {
    console.log('❌ 无法创建测试订阅，跳过测试');
    return;
  }

  // 更新全局测试UUID
  global.TEST_UUID = testUuid;

  await testUserAgentDetection();
  console.log('\n' + '='.repeat(50) + '\n');

  await testSecureSubscription();
  console.log('\n' + '='.repeat(50) + '\n');

  await testRateLimit();

  console.log('\n✅ 所有测试完成！');
}

// 如果直接运行此脚本
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  testRateLimit,
  testUserAgentDetection,
  testSecureSubscription,
  runAllTests
};
