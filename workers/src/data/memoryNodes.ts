import type { SimpleNode } from '../types';

// 内存存储的节点数据（演示用）
let memoryNodes: SimpleNode[] = [
  {
    id: 'SGL_vless+ws|rlvU.love@xray.com',
    name: 'SGL_vless+ws|rlvU.love@xray.com',
    type: 'vless',
    server: 'ahknat.909981.xyz',
    port: 21492,
    enabled: true,
    uuid: '12345678-1234-1234-1234-123456789abc',
    remark: 'SGL节点',
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  },
  {
    id: 'JPL-04o3ee06',
    name: 'JPL-04o3ee06',
    type: 'vless',
    server: '193.246.161.46',
    port: 33287,
    enabled: true,
    uuid: '87654321-4321-4321-4321-cba987654321',
    remark: 'JPL节点',
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  },
  {
    id: 'JP自用',
    name: 'JP自用',
    type: 'vless',
    server: '18bc772c-8bf7-489e-a739-c12eccb13cf7.909981.xyz',
    port: 48888,
    enabled: true,
    uuid: '18bc772c-8bf7-489e-a739-c12eccb13cf7',
    remark: 'JP自用节点',
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  },
  {
    id: 'HKL|Z1bQ.love@xray.com',
    name: 'HKL|Z1bQ.love@xray.com',
    type: 'vless',
    server: '156.226.170.68',
    port: 52653,
    enabled: true,
    uuid: 'hkl-uuid-1234-5678-9abc',
    remark: 'HKL节点',
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  },
  {
    id: 'HK | 移动专线 HKB3',
    name: 'HK | 移动专线 HKB3',
    type: 'vless',
    server: 'api-cf-cname.523383.xyz',
    port: 2053,
    enabled: true,
    uuid: 'hkb3-uuid-1234-5678-9abc',
    remark: 'HK移动专线',
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  },
  {
    id: 'Ali-HK|Rvsu.love@xray.com',
    name: 'Ali-HK|Rvsu.love@xray.com',
    type: 'vless',
    server: '8.217.26.196',
    port: 10402,
    enabled: true,
    uuid: 'ali-hk-uuid-1234-5678',
    remark: 'Ali HK节点',
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  },
  {
    id: 'Akile | JPP-One | WS',
    name: 'Akile | JPP-One | WS',
    type: 'vless',
    server: 'api-cf-cname.523383.xyz',
    port: 2052,
    enabled: true,
    uuid: 'akile-jpp-uuid-1234',
    remark: 'Akile JPP节点',
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  },
  {
    id: '自用CLAW',
    name: '自用CLAW',
    type: 'vless',
    server: '84d0e921-669b-46d0-a327-6be5bf4eed5a.909981.xyz',
    port: 17909,
    enabled: true,
    uuid: '84d0e921-669b-46d0-a327-6be5bf4eed5a',
    remark: '自用CLAW节点',
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  },
  {
    id: '英国 - 01',
    name: '英国 - 01',
    type: 'vless',
    server: '8e8f9df6-eb26-4f6f-a5b8-a3bba94ca11d.909981.xyz',
    port: 30006,
    enabled: true,
    uuid: '8e8f9df6-eb26-4f6f-a5b8-a3bba94ca11d',
    remark: '英国节点01',
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  },
  {
    id: '新加坡 - 02',
    name: '新加坡 - 02',
    type: 'vless',
    server: '8e8f9df6-eb26-4f6f-a5b8-a3bba94ca11d.909981.xyz',
    port: 30003,
    enabled: true,
    uuid: '8e8f9df6-eb26-4f6f-a5b8-a3bba94ca11d',
    remark: '新加坡节点02',
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  }
];

// 添加更多节点以达到31个
const additionalNodes: SimpleNode[] = [
  {
    id: '新加坡 - 01',
    name: '新加坡 - 01',
    type: 'vless',
    server: '8e8f9df6-eb26-4f6f-a5b8-a3bba94ca11d.909981.xyz',
    port: 30002,
    enabled: true,
    uuid: '8e8f9df6-eb26-4f6f-a5b8-a3bba94ca11d',
    remark: '新加坡节点01',
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  },
  {
    id: '香港HK | 1080P',
    name: '香港HK | 1080P',
    type: 'vless',
    server: '107.148.52.87',
    port: 57609,
    enabled: true,
    uuid: 'hk-1080p-uuid-1234',
    remark: '香港1080P节点',
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  },
  {
    id: '香港 ipv6 | 广港IPEL',
    name: '香港 ipv6 | 广港IPEL',
    type: 'vless',
    server: '82ebf39a-b624-463d-a4da-3d644a4749a9.nnr.909981.xyz',
    port: 26232,
    enabled: true,
    uuid: '82ebf39a-b624-463d-a4da-3d644a4749a9',
    remark: '香港IPv6节点',
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  },
  {
    id: '香港 | HKB10G口',
    name: '香港 | HKB10G口',
    type: 'vless',
    server: '84d0e921-669b-46d0-a327-6be5bf4eed5a.909981.xyz',
    port: 10007,
    enabled: true,
    uuid: '84d0e921-669b-46d0-a327-6be5bf4eed5a',
    remark: '香港HKB10G节点',
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  },
  {
    id: '香港 | Ducky',
    name: '香港 | Ducky',
    type: 'vless',
    server: '84d0e921-669b-46d0-a327-6be5bf4eed5a.909981.xyz',
    port: 10006,
    enabled: true,
    uuid: '84d0e921-669b-46d0-a327-6be5bf4eed5a',
    remark: '香港Ducky节点',
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  }
];

// 合并所有节点
memoryNodes = [...memoryNodes, ...additionalNodes];

// 继续添加更多节点以达到31个
for (let i = memoryNodes.length; i < 31; i++) {
  memoryNodes.push({
    id: `node-${i + 1}`,
    name: `节点 ${i + 1}`,
    type: 'vless',
    server: `node${i + 1}.example.com`,
    port: 443 + i,
    enabled: true,
    uuid: `uuid-${i + 1}-1234-5678-9abc-def012345678`,
    remark: `节点${i + 1}备注`,
    createdAt: '2025-06-06T00:00:00.000Z',
    updatedAt: '2025-06-06T00:00:00.000Z',
  });
}

// 导出节点数据和操作函数
export { memoryNodes };

// 导出操作函数
export const getMemoryNodes = () => memoryNodes;
export const addNode = (node: SimpleNode) => memoryNodes.push(node);
export const updateNode = (id: string, updates: Partial<SimpleNode>) => {
  const index = memoryNodes.findIndex(n => n.id === id);
  if (index !== -1) {
    memoryNodes[index] = { ...memoryNodes[index], ...updates };
    return memoryNodes[index];
  }
  return null;
};
export const deleteNode = (id: string) => {
  const index = memoryNodes.findIndex(n => n.id === id);
  if (index !== -1) {
    return memoryNodes.splice(index, 1)[0];
  }
  return null;
};
