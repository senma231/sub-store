import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { message } from 'antd';
import { authService, AuthUser } from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // 初始化认证状态
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const userData = await authService.verifyToken();
          setUser(userData.user);
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        localStorage.removeItem('auth_token');
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // 登录
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await authService.login(username, password);
      
      localStorage.setItem('auth_token', response.token);
      setUser(response.user);
      
      message.success('登录成功');
      return true;
    } catch (error: any) {
      console.error('Login failed:', error);
      message.error(error.response?.data?.message || '登录失败');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // 登出
  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    message.success('已退出登录');
  };

  // 刷新 token
  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await authService.refreshToken();
      localStorage.setItem('auth_token', response.token);
      setUser(response.user);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return false;
    }
  };

  // 自动刷新 token
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(async () => {
      await refreshToken();
    }, 23 * 60 * 60 * 1000); // 23小时刷新一次

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
