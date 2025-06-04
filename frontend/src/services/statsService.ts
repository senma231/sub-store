import { apiClient } from './api';
import { Statistics } from '../../../shared/types';

export interface DetailedStatistics {
  summary: {
    totalNodes: number;
    activeNodes: number;
    totalRequests: number;
    avgDailyRequests: number;
  };
  nodes: {
    typeStats: Record<string, number>;
    statusStats: {
      enabled: number;
      disabled: number;
    };
    recent: Array<{
      id: string;
      name: string;
      type: string;
      createdAt: string;
    }>;
  };
  requests: {
    daily: Array<{
      date: string;
      totalRequests: number;
      formatStats: Record<string, number>;
      userAgentStats: Record<string, number>;
      ipStats: Record<string, number>;
    }>;
    byFormat: Record<string, number>;
    topUserAgents: Array<{
      userAgent: string;
      requests: number;
    }>;
    topIPs: Array<{
      ip: string;
      requests: number;
    }>;
  };
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
}

export interface CleanupResponse {
  deletedCount: number;
  retentionDays: number;
  cutoffDate: string;
}

export const statsService = {
  // 获取基础统计信息
  getStatistics: async (): Promise<Statistics> => {
    return apiClient.get('/stats');
  },

  // 获取详细统计信息
  getDetailedStatistics: async (days?: number): Promise<DetailedStatistics> => {
    const params = days ? { days } : undefined;
    return apiClient.get('/stats/detailed', params);
  },

  // 清理旧统计数据
  cleanupStatistics: async (retentionDays?: number): Promise<CleanupResponse> => {
    const params = retentionDays ? { retention_days: retentionDays } : undefined;
    return apiClient.delete('/stats/cleanup', params);
  },
};
