import { apiClient } from './api';
import type { 
  CustomSubscription, 
  CreateCustomSubscriptionRequest, 
  CreateCustomSubscriptionResponse 
} from '@/types';

export const customSubscriptionService = {
  // 获取自定义订阅列表
  getCustomSubscriptions: async (): Promise<{ subscriptions: CustomSubscription[]; total: number }> => {
    try {
      const result = await apiClient.get('/api/subscriptions');
      console.log('订阅API响应:', result);

      // 处理新的分页响应格式
      if (result && result.items) {
        return {
          subscriptions: result.items,
          total: result.total || 0
        };
      }

      // 兼容旧格式
      return {
        subscriptions: result || [],
        total: result?.length || 0
      };
    } catch (error) {
      console.error('获取自定义订阅失败:', error);
      return {
        subscriptions: [],
        total: 0
      };
    }
  },

  // 创建自定义订阅
  createCustomSubscription: async (data: CreateCustomSubscriptionRequest): Promise<CreateCustomSubscriptionResponse> => {
    return apiClient.post('/api/subscriptions', data);
  },

  // 获取单个自定义订阅
  getCustomSubscription: async (uuid: string): Promise<{
    subscription: CustomSubscription;
    nodes: any[];
    statistics: {
      totalNodes: number;
      enabledNodes: number;
    };
  }> => {
    return apiClient.get(`/api/subscriptions/${uuid}`);
  },

  // 更新自定义订阅
  updateCustomSubscription: async (uuid: string, data: Partial<CreateCustomSubscriptionRequest>): Promise<{ subscription: CustomSubscription }> => {
    return apiClient.put(`/api/subscriptions/${uuid}`, data);
  },

  // 删除自定义订阅
  deleteCustomSubscription: async (uuid: string): Promise<{ uuid: string }> => {
    return apiClient.delete(`/api/subscriptions/${uuid}`);
  },

  // 生成订阅链接
  generateSubscriptionUrl: (uuid: string): string => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://substore-api.senmago231.workers.dev';
    return `${apiBaseUrl}/sub/custom/${uuid}`;
  },
};
