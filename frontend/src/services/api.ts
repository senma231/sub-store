import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { message } from 'antd';
import type { ApiResponse } from '@/types';

// API 基础配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://substore-api.senmago231.workers.dev';

// 创建 axios 实例
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 添加认证 token
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 添加请求时间戳
    if (config.params) {
      config.params._t = Date.now();
    } else {
      config.params = { _t: Date.now() };
    }
    
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // 检查业务状态码
    if (response.data && response.data.success === false) {
      const errorMessage = response.data.message || response.data.error || '请求失败';
      message.error(errorMessage);
      return Promise.reject(new Error(errorMessage));
    }
    
    return response;
  },
  (error) => {
    console.error('Response error:', error);
    
    // 处理网络错误
    if (!error.response) {
      message.error('网络连接失败，请检查网络设置');
      return Promise.reject(error);
    }
    
    const { status, data } = error.response;
    
    switch (status) {
      case 401:
        // 未授权，清除 token 并跳转到登录页
        localStorage.removeItem('auth_token');
        if (window.location.pathname !== '/login') {
          message.error('登录已过期，请重新登录');
          window.location.href = '/login';
        }
        break;
        
      case 403:
        message.error('权限不足，无法访问该资源');
        break;
        
      case 404:
        message.error('请求的资源不存在');
        break;
        
      case 429:
        message.error('请求过于频繁，请稍后再试');
        break;
        
      case 500:
        message.error('服务器内部错误，请稍后再试');
        break;
        
      case 502:
      case 503:
      case 504:
        message.error('服务暂时不可用，请稍后再试');
        break;
        
      default:
        const errorMessage = data?.message || data?.error || `请求失败 (${status})`;
        message.error(errorMessage);
    }
    
    return Promise.reject(error);
  }
);



// 通用 API 方法
export const apiClient = {
  // GET 请求
  get: <T = any>(url: string, params?: any): Promise<T> => {
    return api.get(url, { params }).then(response => response.data.data);
  },
  
  // POST 请求
  post: <T = any>(url: string, data?: any): Promise<T> => {
    return api.post(url, data).then(response => response.data.data);
  },
  
  // PUT 请求
  put: <T = any>(url: string, data?: any): Promise<T> => {
    return api.put(url, data).then(response => response.data.data);
  },
  
  // DELETE 请求
  delete: <T = any>(url: string): Promise<T> => {
    return api.delete(url).then(response => response.data.data);
  },
  
  // PATCH 请求
  patch: <T = any>(url: string, data?: any): Promise<T> => {
    return api.patch(url, data).then(response => response.data.data);
  },
  
  // 获取完整响应
  getResponse: <T = any>(url: string, params?: any): Promise<ApiResponse<T>> => {
    return api.get(url, { params }).then(response => response.data);
  },
  
  // 上传文件
  upload: <T = any>(url: string, file: File, onProgress?: (progress: number) => void): Promise<T> => {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    }).then(response => response.data.data);
  },
  
  // 下载文件
  download: (url: string, filename?: string): Promise<void> => {
    return api.get(url, {
      responseType: 'blob',
    }).then(response => {
      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    });
  },
};

export default api;
