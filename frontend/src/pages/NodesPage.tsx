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
  ImportOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nodeService } from '../services/nodeService';
import { NodeModal } from '../components/NodeModal';
import type { ProxyNode } from '@/types';

const { Title } = Typography;
const { Search } = Input;

const NodesPage: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [modalVisible, setModalVisible] = useState(false);
  const [editingNode, setEditingNode] = useState<ProxyNode | null>(null);

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
      setSelectedRowKeys([]);
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || '批量操作失败');
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
    },
    {
      title: '端口',
      dataIndex: 'port',
      key: 'port',
      width: 80,
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
    <div style={{ padding: '0 16px' }}>
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
              onClick={() => {/* TODO: 导入节点 */}}
            >
              导入
            </Button>
            <Button
              icon={<ExportOutlined />}
              onClick={() => nodeService.exportNodes()}
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
    </div>
  );
};

export default NodesPage;
