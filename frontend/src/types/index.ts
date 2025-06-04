// 重新导出 shared 类型
export * from '../../../shared/types';

// 前端特有的类型定义
export interface NodeListParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  enabled?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface BatchOperationRequest {
  action: 'enable' | 'disable' | 'delete';
  nodeIds: string[];
}

export interface BatchOperationResponse {
  action: string;
  affectedCount: number;
  affectedNodes: any[];
}

export interface SubscriptionFormat {
  format: string;
  name: string;
  description: string;
  extension: string;
  contentType: string;
  url: string;
}

export interface SubscriptionInfo {
  format: SubscriptionFormat;
  statistics: {
    totalNodes: number;
    enabledNodes: number;
    nodeTypes: Record<string, number>;
  };
  lastUpdated: number;
}

export interface SubscriptionListResponse {
  formats: SubscriptionFormat[];
  parameters: Record<string, string>;
  examples: Record<string, string>;
}

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
