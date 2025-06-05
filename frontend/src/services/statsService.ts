import { apiClient } from './api';
import type { Statistics, DetailedStatistics, CleanupResponse } from '@/types';

export const statsService = {
  // 获取基础统计信息
  getStatistics: async (): Promise<Statistics> => {
    return apiClient.get('/api/stats');
  },

  // 获取详细统计信息
  getDetailedStatistics: async (days?: number): Promise<DetailedStatistics> => {
    const params = days ? { days } : undefined;
    return apiClient.get('/api/stats/detailed', params);
  },

  // 清理旧统计数据
  cleanupStatistics: async (retentionDays?: number): Promise<CleanupResponse> => {
    const url = retentionDays ? `/api/stats/cleanup?retention_days=${retentionDays}` : '/api/stats/cleanup';
    return apiClient.delete(url);
  },
};
