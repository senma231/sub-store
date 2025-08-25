/**
 * Bridge Proxy Worker
 * 代理请求到VPS上的Bridge服务
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // 健康检查
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'Bridge Proxy',
        timestamp: new Date().toISOString(),
        bridgeUrl: env.BRIDGE_SERVER_URL
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 代理所有其他请求到Bridge服务器
    try {
      const bridgeUrl = `${env.BRIDGE_SERVER_URL}${url.pathname}${url.search}`;
      
      console.log(`代理请求到: ${bridgeUrl}`);
      
      // 创建新的请求
      const bridgeRequest = new Request(bridgeUrl, {
        method: request.method,
        headers: request.headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null
      });

      // 发送请求到Bridge服务器
      const response = await fetch(bridgeRequest);
      
      // 创建新的响应，添加CORS头
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...Object.fromEntries(response.headers),
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });

      return newResponse;
      
    } catch (error) {
      console.error('Bridge代理错误:', error);
      
      return new Response(JSON.stringify({
        success: false,
        error: '无法连接到Bridge服务器',
        details: error.message
      }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};
