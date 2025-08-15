const https = require('https');

const testLogin = () => {
  const data = JSON.stringify({
    username: 'admin',
    password: 'Sz@2400104'
  });

  const options = {
    hostname: 'substore-api.senmago231.workers.dev',
    port: 443,
    path: '/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    },
    timeout: 30000
  };

  console.log('🚀 Testing login API...');
  console.log('URL:', `https://${options.hostname}${options.path}`);
  console.log('Data:', data);

  const req = https.request(options, (res) => {
    console.log(`✅ Status Code: ${res.statusCode}`);
    console.log('📋 Headers:', res.headers);

    let responseData = '';
    res.on('data', (chunk) => {
      responseData += chunk;
    });

    res.on('end', () => {
      console.log('📦 Response Body:', responseData);
      
      try {
        const parsed = JSON.parse(responseData);
        console.log('🔍 Parsed Response:', JSON.stringify(parsed, null, 2));
        
        if (parsed.success && parsed.data && parsed.data.token) {
          console.log('🎉 Login successful! Token received.');
          console.log('🔑 Token length:', parsed.data.token.length);
        } else {
          console.log('❌ Login failed or token missing');
        }
      } catch (e) {
        console.log('⚠️ Failed to parse JSON:', e.message);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request error:', error.message);
    console.error('🔍 Error details:', error);
  });

  req.on('timeout', () => {
    console.error('⏰ Request timeout');
    req.destroy();
  });

  req.write(data);
  req.end();
};

// 运行测试
testLogin();
