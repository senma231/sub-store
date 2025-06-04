import { apiClient } from './api';

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

export const subscriptionService = {
  // 获取支持的订阅格式
  getFormats: async (): Promise<SubscriptionListResponse> => {
    return apiClient.get('/sub');
  },

  // 获取订阅信息
  getSubscriptionInfo: async (format: string): Promise<SubscriptionInfo> => {
    return apiClient.get(`/sub/${format}/info`);
  },

  // 生成订阅链接
  generateSubscriptionUrl: (format: string, options?: {
    token?: string;
    filename?: string;
    types?: string[];
    include?: string[];
    exclude?: string[];
    sort?: string;
    group?: boolean;
    groupBy?: string;
    rename?: Array<{ pattern: string; replacement: string }>;
  }): string => {
    const baseUrl = window.location.origin;
    const url = new URL(`/sub/${format}`, baseUrl);
    
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            if (key === 'rename') {
              url.searchParams.set(key, encodeURIComponent(JSON.stringify(value)));
            } else {
              url.searchParams.set(key, value.join(','));
            }
          } else if (typeof value === 'boolean') {
            url.searchParams.set(key, value.toString());
          } else {
            url.searchParams.set(key, value.toString());
          }
        }
      });
    }
    
    return url.toString();
  },

  // 预览订阅内容
  previewSubscription: async (format: string, options?: any): Promise<string> => {
    const params = new URLSearchParams();
    if (options) {
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            if (key === 'rename') {
              params.set(key, encodeURIComponent(JSON.stringify(value)));
            } else {
              params.set(key, value.join(','));
            }
          } else if (typeof value === 'boolean') {
            params.set(key, value.toString());
          } else {
            params.set(key, value.toString());
          }
        }
      });
    }
    
    const response = await fetch(`/sub/${format}?${params.toString()}`);
    return response.text();
  },

  // 下载订阅文件
  downloadSubscription: async (format: string, options?: any): Promise<void> => {
    const url = subscriptionService.generateSubscriptionUrl(format, options);
    const response = await fetch(url);
    const blob = await response.blob();
    
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    
    // 从响应头获取文件名
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `subscription.${format}`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  },
};
