// 共享的自定义订阅存储
export interface CustomSubscriptionData {
  id: string;
  uuid: string;
  name: string;
  nodeIds: string[];
  format: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  accessCount: number;
  lastAccessAt?: string;
}

// 内存存储自定义订阅（生产环境应使用数据库）
export const customSubscriptions = new Map<string, CustomSubscriptionData>();

// 操作函数
export const getCustomSubscription = (uuid: string): CustomSubscriptionData | undefined => {
  return customSubscriptions.get(uuid);
};

export const setCustomSubscription = (uuid: string, subscription: CustomSubscriptionData): void => {
  customSubscriptions.set(uuid, subscription);
};

export const deleteCustomSubscription = (uuid: string): boolean => {
  return customSubscriptions.delete(uuid);
};

export const getAllCustomSubscriptions = (): CustomSubscriptionData[] => {
  return Array.from(customSubscriptions.values());
};

export const updateSubscriptionAccess = (uuid: string): void => {
  const subscription = customSubscriptions.get(uuid);
  if (subscription) {
    subscription.accessCount++;
    subscription.lastAccessAt = new Date().toISOString();
    customSubscriptions.set(uuid, subscription);
  }
};
