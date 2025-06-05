import { apiClient } from './api';
import type {
  ProxyNode,
  PaginatedResponse,
  NodeListParams,
  BatchOperationRequest,
  BatchOperationResponse
} from '@/types';

export const nodeService = {
  // 获取节点列表
  getNodes: async (params?: NodeListParams): Promise<PaginatedResponse<ProxyNode>> => {
    return apiClient.get('/api/nodes', params);
  },

  // 获取单个节点
  getNode: async (id: string): Promise<ProxyNode> => {
    return apiClient.get(`/api/nodes/${id}`);
  },

  // 创建节点
  createNode: async (node: Omit<ProxyNode, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProxyNode> => {
    return apiClient.post('/api/nodes', node);
  },

  // 更新节点
  updateNode: async (id: string, node: Partial<ProxyNode>): Promise<ProxyNode> => {
    return apiClient.put(`/api/nodes/${id}`, node);
  },

  // 删除节点
  deleteNode: async (id: string): Promise<ProxyNode> => {
    return apiClient.delete(`/api/nodes/${id}`);
  },

  // 批量操作
  batchOperation: async (request: BatchOperationRequest): Promise<BatchOperationResponse> => {
    return apiClient.post('/api/nodes/batch', request);
  },

  // 导入节点
  importNodes: async (nodes: ProxyNode[]): Promise<{ success: number; failed: number; errors: string[] }> => {
    return apiClient.post('/api/nodes/import', { nodes });
  },

  // 导出节点
  exportNodes: async (format: 'json' | 'csv' = 'json'): Promise<void> => {
    return apiClient.download(`/api/nodes/export?format=${format}`, `nodes.${format}`);
  },

  // 测试节点连接
  testNode: async (id: string): Promise<{ status: string; latency?: number; error?: string }> => {
    return apiClient.post(`/api/nodes/${id}/test`);
  },

  // 批量测试节点
  testNodes: async (nodeIds: string[]): Promise<Record<string, { status: string; latency?: number; error?: string }>> => {
    return apiClient.post('/api/nodes/test-batch', { nodeIds });
  },
};
