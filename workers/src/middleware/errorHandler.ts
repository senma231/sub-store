import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';

export function errorHandler(err: Error, c: Context) {
  console.error('Error occurred:', err);
  
  // 处理 HTTP 异常
  if (err instanceof HTTPException) {
    return c.json({
      success: false,
      error: err.message,
      status: err.status,
    }, err.status);
  }
  
  // 处理验证错误
  if (err.name === 'ValidationError') {
    return c.json({
      success: false,
      error: 'Validation Error',
      message: err.message,
    }, 400);
  }
  
  // 处理 JSON 解析错误
  if (err instanceof SyntaxError && err.message.includes('JSON')) {
    return c.json({
      success: false,
      error: 'Invalid JSON',
      message: 'Request body contains invalid JSON',
    }, 400);
  }
  
  // 处理 KV 存储错误
  if (err.message.includes('KV')) {
    return c.json({
      success: false,
      error: 'Storage Error',
      message: 'Failed to access storage',
    }, 500);
  }
  
  // 处理网络错误
  if (err.message.includes('fetch') || err.message.includes('network')) {
    return c.json({
      success: false,
      error: 'Network Error',
      message: 'Failed to connect to external service',
    }, 502);
  }
  
  // 默认内部服务器错误
  return c.json({
    success: false,
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    ...(c.env?.ENVIRONMENT === 'development' && { stack: err.stack }),
  }, 500);
}
