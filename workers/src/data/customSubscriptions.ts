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

// 初始化一些测试数据
const initTestData = () => {
  if (customSubscriptions.size === 0) {
    const testSubscription: CustomSubscriptionData = {
      id: 'test-subscription-1',
      uuid: 'test-uuid-123',
      name: '测试自定义订阅',
      nodeIds: ["SGL_vless+ws|rlvU.love@xray.com","JPL-04o3ee06","JP自用"],
      format: 'v2ray',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      accessCount: 5,
      lastAccessAt: new Date().toISOString(),
    };
    customSubscriptions.set(testSubscription.uuid, testSubscription);
  }
};

// 初始化测试数据
initTestData();

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
