import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Input,
  Select,
  Popconfirm,
  message,
  Tooltip
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  ExportOutlined,
  ImportOutlined,
  CloudServerOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nodeService } from '../services/nodeService';
import { NodeModal } from '../components/NodeModal';
import { NodeImportModal } from '../components/NodeImportModal';
import { CustomSubscriptionModal } from '../components/CustomSubscriptionModal';
import type { ProxyNode, CreateCustomSubscriptionRequest, CreateCustomSubscriptionResponse } from '@/types';

const { Title, Text } = Typography;
const { Search } = Input;

// 辅助函数：获取国家旗帜emoji
const getCountryFlag = (countryCode?: string): string => {
  if (!countryCode || countryCode.length !== 2) {
    return '🌍';
  }

  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
};

// 辅助函数：格式化地理位置信息
const formatLocation = (record: any): string => {
  const parts: string[] = [];

  if (record.locationCountry) {
    parts.push(record.locationCountry);
  }

  if (record.locationRegion && record.locationRegion !== record.locationCountry) {
    parts.push(record.locationRegion);
  }

  if (record.locationCity && record.locationCity !== record.locationRegion) {
    parts.push(record.locationCity);
  }

  return parts.join(', ') || '未知';
};

const NodesPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNode, setEditingNode] = useState<ProxyNode | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [customSubModalVisible, setCustomSubModalVisible] = useState(false);

  const queryClient = useQueryClient();

  // 获取节点列表
  const { data: nodesData, isLoading, refetch } = useQuery({
    queryKey: ['nodes', {
      page: pagination.current,
      limit: pagination.pageSize,
      search: searchText,
      type: selectedType,
      enabled: selectedStatus ? selectedStatus === 'enabled' : undefined,
    }],
    queryFn: () => nodeService.getNodes({
      page: pagination.current,
      limit: pagination.pageSize,
      search: searchText || undefined,
      type: selectedType || undefined,
      enabled: selectedStatus ? selectedStatus === 'enabled' : undefined,
    }),
  });

  // 创建节点
  const createMutation = useMutation({
    mutationFn: nodeService.createNode,
    onSuccess: () => {
      message.success('节点创建成功');
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] }); // 刷新统计数据
      setModalVisible(false);
      setEditingNode(null);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '创建失败');
    },
  });

  // 更新节点
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProxyNode> }) =>
      nodeService.updateNode(id, data),
    onSuccess: () => {
      message.success('节点更新成功');
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] }); // 刷新统计数据
      setModalVisible(false);
      setEditingNode(null);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '更新失败');
    },
  });

  // 删除节点
  const deleteMutation = useMutation({
    mutationFn: nodeService.deleteNode,
    onSuccess: () => {
      message.success('节点删除成功');
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] }); // 刷新统计数据
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '删除失败');
    },
  });

  // 批量操作
  const batchMutation = useMutation({
    mutationFn: nodeService.batchOperation,
    onSuccess: (data) => {
      message.success(`批量操作成功，影响 ${data.affectedCount} 个节点`);
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] }); // 刷新统计数据
      setSelectedRowKeys([]);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '批量操作失败');
    },
  });

  // 导入节点
  const importMutation = useMutation({
    mutationFn: nodeService.importNodes,
    onSuccess: (data) => {
      message.success(`导入成功：${data.success} 个节点，失败 ${data.failed} 个`);
      if (data.errors && data.errors.length > 0) {
        console.warn('导入错误:', data.errors);
      }
      queryClient.invalidateQueries({ queryKey: ['nodes'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] }); // 刷新统计数据
      setImportModalVisible(false);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '导入失败');
    },
  });

  // 表格列定义
  const columns = [
    {
      title: '节点名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text: string, record: ProxyNode) => (
        <Space>
          <span>{text}</span>
          {!record.enabled && <Tag color="red">已禁用</Tag>}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (type: string) => (
        <Tag className={`node-type-tag ${type}`}>
          {type.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: '服务器',
      dataIndex: 'server',
      key: 'server',
      ellipsis: true,
      render: (server: string, record: ProxyNode) => (
        <Space direction="vertical" size={0}>
          <span>{server}</span>
          {(record as any).locationCountry && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
              {getCountryFlag((record as any).locationCountry)} {formatLocation(record as any)}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      width: 80,
    },
    {
      title: '来源',
      key: 'source',
      width: 100,
      render: (_: any, record: ProxyNode) => {
        const sourceType = (record as any).sourceType;
        if (sourceType === 'xui') {
          return <Tag color="blue" icon={<CloudServerOutlined />}>XUI</Tag>;
        } else if (sourceType === 'import') {
          return <Tag color="green" icon={<ImportOutlined />}>导入</Tag>;
        } else {
          return <Tag color="default" icon={<EditOutlined />}>手动</Tag>;
        }
      },
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 80,
      render: (enabled: boolean) => (
        <Space>
          <span className={`status-indicator ${enabled ? 'online' : 'offline'}`}></span>
          {enabled ? '启用' : '禁用'}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 150,
      render: (_: any, record: ProxyNode) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title={record.enabled ? '禁用' : '启用'}>
            <Button
              type="text"
              icon={record.enabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={() => handleToggleStatus(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个节点吗？"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                loading={deleteMutation.isPending}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 处理添加节点
  const handleAdd = () => {
    setEditingNode(null);
    setModalVisible(true);
  };

  // 处理编辑
  const handleEdit = (node: ProxyNode) => {
    setEditingNode(node);
    setModalVisible(true);
  };

  // 处理模态框确认
  const handleModalOk = (values: Partial<ProxyNode>) => {
    if (editingNode) {
      // 更新节点
      updateMutation.mutate({ id: editingNode.id, data: values });
    } else {
      // 创建节点
      createMutation.mutate(values as ProxyNode);
    }
  };

  // 处理模态框取消
  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingNode(null);
  };

  // 创建自定义订阅
  const createCustomSubscriptionMutation = useMutation({
    mutationFn: async (data: CreateCustomSubscriptionRequest): Promise<CreateCustomSubscriptionResponse> => {
      const { customSubscriptionService } = await import('@/services/customSubscriptionService');
      return customSubscriptionService.createCustomSubscription(data);
    },
    onSuccess: () => {
      message.success('自定义订阅创建成功');
      // 使自定义订阅列表缓存失效，触发重新获取
      queryClient.invalidateQueries({ queryKey: ['custom-subscriptions'] });
      // 关闭模态框
      setCustomSubModalVisible(false);
      // 清空选择
      setSelectedRowKeys([]);
    },
    onError: (error: any) => {
      console.error('创建自定义订阅失败:', error);
      const errorMessage = error.response?.data?.message || error.message || '创建自定义订阅失败';
      message.error(`创建失败: ${errorMessage}`);
    },
  });

  // 处理生成自定义订阅
  const handleCreateCustomSubscription = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要包含的节点');
      return;
    }
    setCustomSubModalVisible(true);
  };

  // 处理节点导入
  const handleImportNodes = async (nodes: Partial<ProxyNode>[]) => {
    // 过滤并转换为完整的节点数据
    const validNodes = nodes.filter(node =>
      node.name && node.type && node.server && node.port
    ) as ProxyNode[];

    if (validNodes.length === 0) {
      message.warning('没有有效的节点数据');
      return;
    }

    await importMutation.mutateAsync(validNodes);
  };

  // 处理状态切换
  const handleToggleStatus = (node: ProxyNode) => {
    batchMutation.mutate({
      action: node.enabled ? 'disable' : 'enable',
      nodeIds: [node.id],
    });
  };

  // 处理批量操作
  const handleBatchOperation = (action: 'enable' | 'disable' | 'delete') => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要操作的节点');
      return;
    }

    batchMutation.mutate({
      action,
      nodeIds: selectedRowKeys,
    });
  };

  // 表格选择配置
  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(selectedRowKeys as string[]);
    },
  };

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          节点管理
        </Title>
      </div>

      <Card>
        {/* 工具栏 */}
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <Space wrap>
            <Search
              placeholder="搜索节点名称或服务器"
              allowClear
              style={{ width: 250 }}
              onSearch={setSearchText}
            />
            <Select
              placeholder="选择类型"
              allowClear
              style={{ width: 120 }}
              value={selectedType || undefined}
              onChange={setSelectedType}
              options={[
                { label: 'VLESS', value: 'vless' },
                { label: 'VMess', value: 'vmess' },
                { label: 'Trojan', value: 'trojan' },
                { label: 'SS', value: 'ss' },
                { label: 'SOCKS5', value: 'socks5' },
                { label: 'HY2', value: 'hy2' },
                { label: 'HY', value: 'hy' },
              ]}
            />
            <Select
              placeholder="选择状态"
              allowClear
              style={{ width: 120 }}
              value={selectedStatus || undefined}
              onChange={setSelectedStatus}
              options={[
                { label: '启用', value: 'enabled' },
                { label: '禁用', value: 'disabled' },
              ]}
            />
          </Space>

          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              添加节点
            </Button>
            <Button
              icon={<ImportOutlined />}
              onClick={() => setImportModalVisible(true)}
            >
              导入
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={async () => {
                try {
                  await nodeService.exportNodes();
                  message.success('导出成功');
                } catch (error) {
                  console.error('Export error:', error);
                  message.error('导出失败，请检查网络连接');
                }
              }}
            >
              导出
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isLoading}
            >
              刷新
            </Button>
          </Space>
        </div>

        {/* 批量操作 */}
        {selectedRowKeys.length > 0 && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f0f2f5', borderRadius: 6 }}>
            <Space>
              <span>已选择 {selectedRowKeys.length} 个节点</span>
              <Button
                size="small"
                onClick={() => handleBatchOperation('enable')}
                loading={batchMutation.isPending}
              >
                批量启用
              </Button>
              <Button
                size="small"
                onClick={() => handleBatchOperation('disable')}
                loading={batchMutation.isPending}
              >
                批量禁用
              </Button>
              <Popconfirm
                title="确定要删除选中的节点吗？"
                onConfirm={() => handleBatchOperation('delete')}
                okText="确定"
                cancelText="取消"
              >
                <Button
                  size="small"
                  danger
                  loading={batchMutation.isPending}
                >
                  批量删除
                </Button>
              </Popconfirm>
              <Button
                size="small"
                type="primary"
                onClick={() => handleCreateCustomSubscription()}
              >
                生成自定义订阅
              </Button>
              <Button
                size="small"
                onClick={() => setSelectedRowKeys([])}
              >
                取消选择
              </Button>
            </Space>
          </div>
        )}

        {/* 节点表格 */}
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={nodesData?.items || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: nodesData?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPagination({ current: page, pageSize: pageSize || 20 });
            },
          }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* 节点编辑模态框 */}
      <NodeModal
        open={modalVisible}
        onCancel={handleModalCancel}
        onOk={handleModalOk}
        initialValues={editingNode || undefined}
        loading={createMutation.isPending || updateMutation.isPending}
        title={editingNode ? '编辑节点' : '添加节点'}
      />

      {/* 节点导入模态框 */}
      <NodeImportModal
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        onImport={handleImportNodes}
        loading={importMutation.isPending}
      />

      {/* 自定义订阅模态框 */}
      <CustomSubscriptionModal
        open={customSubModalVisible}
        onCancel={() => setCustomSubModalVisible(false)}
        selectedNodes={nodesData?.items?.filter(node => selectedRowKeys.includes(node.id)) || []}
        onCreateSubscription={createCustomSubscriptionMutation.mutateAsync}
        loading={createCustomSubscriptionMutation.isPending}
      />
    </div>
  );
};

export default NodesPage;
