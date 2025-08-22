import { apiClient } from './api';
import type {
  LoginResponse,
  VerifyTokenResponse,
  ChangePasswordRequest
} from '@/types';

export const authService = {
  // 登录 - 直接使用axios而不是apiClient，因为登录响应格式特殊
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const response = await fetch('https://sub-api.senma.io/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '登录失败');
    }

    const result = await response.json();
    return result.data; // 返回 { token, user }
  },

  // 验证 token
  verifyToken: async (): Promise<VerifyTokenResponse> => {
    return apiClient.post('/api/auth/verify');
  },

  // 刷新 token
  refreshToken: async (): Promise<LoginResponse> => {
    return apiClient.post('/api/auth/refresh');
  },

  // 登出
  logout: async (): Promise<void> => {
    return apiClient.post('/api/auth/logout');
  },

  // 修改密码
  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    return apiClient.post('/api/auth/change-password', data);
  },
};
