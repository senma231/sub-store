import { apiClient } from './api';

export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
  expiresIn: number;
}

export interface VerifyTokenResponse {
  user: AuthUser;
  expiresAt: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export const authService = {
  // 登录
  login: async (username: string, password: string): Promise<LoginResponse> => {
    return apiClient.post('/auth/login', { username, password });
  },

  // 验证 token
  verifyToken: async (): Promise<VerifyTokenResponse> => {
    return apiClient.post('/auth/verify');
  },

  // 刷新 token
  refreshToken: async (): Promise<LoginResponse> => {
    return apiClient.post('/auth/refresh');
  },

  // 登出
  logout: async (): Promise<void> => {
    return apiClient.post('/auth/logout');
  },

  // 修改密码
  changePassword: async (data: ChangePasswordRequest): Promise<void> => {
    return apiClient.post('/auth/change-password', data);
  },
};
