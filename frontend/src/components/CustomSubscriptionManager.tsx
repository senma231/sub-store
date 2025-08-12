import React, { useState } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Tooltip,
  Popconfirm,
  message,
  Modal,
  Input,
  Statistic,
  Row,
  Col,
  Alert,
  Form,
  Select,
  DatePicker
} from 'antd';
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  QrcodeOutlined,
  LinkOutlined,
  BarChartOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QRCode from 'qrcode.react';
import copy from 'copy-to-clipboard';
import dayjs from 'dayjs';
import type { CustomSubscription } from '@/types';

const { Text } = Typography;
const { TextArea } = Input;

// 编辑订阅表单组件
interface EditSubscriptionFormProps {
  subscription: CustomSubscription;
  onSubmit: (data: any) => void;
  loading: boolean;
  onCancel: () => void;
}

const EditSubscriptionForm: React.FC<EditSubscriptionFormProps> = ({
  subscription,
  onSubmit,
  loading,
  onCancel
}) => {
  const [form] = Form.useForm();

  const formatOptions = [
    { label: 'V2Ray', value: 'v2ray' },
    { label: 'Clash', value: 'clash' },
    { label: 'Shadowrocket', value: 'shadowrocket' },
  ];

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const submitData: any = {};

      if (values.name !== subscription.name) {
        submitData.name = values.name;
      }

      if (values.format !== subscription.format) {
        submitData.format = values.format;
      }

      const newExpiresAt = values.expiresAt ? values.expiresAt.toISOString() : null;
      if (newExpiresAt !== subscription.expiresAt) {
        submitData.expiresAt = newExpiresAt;
      }

      onSubmit(submitData);
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        name: subscription.name,
        format: subscription.format,
        expiresAt: subscription.expiresAt ? dayjs(subscription.expiresAt) : undefined,
      }}
    >
      <Form.Item
        label="订阅名称"
        name="name"
        rules={[{ required: true, message: '请输入订阅名称' }]}
      >
        <Input placeholder="请输入订阅名称" />
      </Form.Item>

      <Form.Item
        label="订阅格式"
        name="format"
        rules={[{ required: true, message: '请选择订阅格式' }]}
      >
        <Select placeholder="请选择订阅格式">
          {formatOptions.map(option => (
            <Select.Option key={option.value} value={option.value}>
              {option.label}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        label="有效期"
        name="expiresAt"
        help="留空表示永不过期"
      >
        <DatePicker
          showTime
          placeholder="选择过期时间（可选）"
          style={{ width: '100%' }}
          disabledDate={(current) => current && current < dayjs().endOf('day')}
        />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button onClick={onCancel}>
            取消
          </Button>
          <Button type="primary" loading={loading} onClick={handleSubmit}>
            保存
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};

interface CustomSubscriptionManagerProps {
  className?: string;
}

export const CustomSubscriptionManager: React.FC<CustomSubscriptionManagerProps> = ({
  className
}) => {
  const [selectedSubscription, setSelectedSubscription] = useState<CustomSubscription | null>(null);
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const queryClient = useQueryClient();

  // 获取自定义订阅列表
  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['custom-subscriptions'],
    queryFn: async () => {
      // 这里应该调用实际的API
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://substore-api.senmago231.workers.dev';
      const response = await fetch(`${apiBaseUrl}/api/subscriptions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      const result = await response.json();
      return result.data || [];
    },
  });

  // 更新自定义订阅
  const updateMutation = useMutation({
    mutationFn: async ({ uuid, data }: { uuid: string; data: any }) => {
      const { customSubscriptionService } = await import('@/services/customSubscriptionService');
      return customSubscriptionService.updateCustomSubscription(uuid, data);
    },
    onSuccess: () => {
      message.success('自定义订阅更新成功');
      queryClient.invalidateQueries({ queryKey: ['custom-subscriptions'] });
      setEditModalVisible(false);
      setSelectedSubscription(null);
    },
    onError: (error: any) => {
      console.error('更新自定义订阅失败:', error);
      const errorMessage = error.response?.data?.message || error.message || '更新失败';
      message.error(`更新失败: ${errorMessage}`);
    },
  });

  // 删除自定义订阅
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://substore-api.senmago231.workers.dev';
      const response = await fetch(`${apiBaseUrl}/api/subscriptions/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
      });
      if (!response.ok) {
        throw new Error('删除失败');
      }
      return response.json();
    },
    onSuccess: () => {
      message.success('自定义订阅删除成功');
      queryClient.invalidateQueries({ queryKey: ['custom-subscriptions'] });
    },
    onError: () => {
      message.error('删除失败');
    },
  });

  // 生成订阅链接
  const generateSubscriptionUrl = (subscription: CustomSubscription): string => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'https://substore-api.senmago231.workers.dev';
    return `${apiBaseUrl}/sub/custom/${subscription.uuid}`;
  };

  // 复制订阅链接
  const handleCopyUrl = (subscription: CustomSubscription) => {
    const url = generateSubscriptionUrl(subscription);
    copy(url);
    message.success('订阅链接已复制到剪贴板');
  };

  // 显示二维码
  const handleShowQRCode = (subscription: CustomSubscription) => {
    setSelectedSubscription(subscription);
    setQrCodeVisible(true);
  };

  // 显示详情
  const handleShowDetail = (subscription: CustomSubscription) => {
    setSelectedSubscription(subscription);
    setDetailModalVisible(true);
  };

  // 编辑订阅
  const handleEdit = (subscription: CustomSubscription) => {
    setSelectedSubscription(subscription);
    setEditModalVisible(true);
  };

  // 表格列定义
  const columns = [
    {
      title: '订阅名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (text: string, record: CustomSubscription) => (
        <Space>
          <span>{text}</span>
          <Tag color="blue">{record.format.toUpperCase()}</Tag>
        </Space>
      ),
    },
    {
      title: '节点数量',
      dataIndex: 'nodeIds',
      key: 'nodeCount',
      width: 100,
      render: (nodeIds: string[]) => (
        <Tag color="green">{nodeIds.length} 个</Tag>
      ),
    },
    {
      title: '访问次数',
      dataIndex: 'accessCount',
      key: 'accessCount',
      width: 100,
      render: (count: number) => (
        <Text>{count}</Text>
      ),
    },
    {
      title: '最后访问',
      dataIndex: 'lastAccessAt',
      key: 'lastAccessAt',
      width: 150,
      render: (date: string) => (
        date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '从未访问'
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '有效期',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 120,
      render: (date: string) => {
        if (!date) return <Tag color="green">永久</Tag>;
        const isExpired = dayjs(date).isBefore(dayjs());
        return (
          <Tag color={isExpired ? 'red' : 'orange'}>
            {isExpired ? '已过期' : dayjs(date).format('MM-DD')}
          </Tag>
        );
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: CustomSubscription) => (
        <Space size="small">
          <Tooltip title="复制链接">
            <Button
              type="text"
              icon={<CopyOutlined />}
              onClick={() => handleCopyUrl(record)}
            />
          </Tooltip>
          <Tooltip title="二维码">
            <Button
              type="text"
              icon={<QrcodeOutlined />}
              onClick={() => handleShowQRCode(record)}
            />
          </Tooltip>
          <Tooltip title="详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleShowDetail(record)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个自定义订阅吗？"
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

  // 统计数据
  const totalSubscriptions = subscriptions?.length || 0;
  const totalAccess = subscriptions?.reduce((sum: number, sub: CustomSubscription) => sum + sub.accessCount, 0) || 0;
  const activeSubscriptions = subscriptions?.filter((sub: CustomSubscription) => 
    !sub.expiresAt || dayjs(sub.expiresAt).isAfter(dayjs())
  ).length || 0;

  return (
    <div className={className}>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="总订阅数"
              value={totalSubscriptions}
              prefix={<LinkOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="活跃订阅"
              value={activeSubscriptions}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="总访问次数"
              value={totalAccess}
              prefix={<EyeOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 自定义订阅列表 */}
      <Card title="自定义订阅列表">
        {totalSubscriptions === 0 ? (
          <Alert
            message="暂无自定义订阅"
            description="您可以在节点管理页面选择节点后创建自定义订阅"
            type="info"
            showIcon
            style={{ margin: '20px 0' }}
          />
        ) : (
          <Table
            columns={columns}
            dataSource={subscriptions}
            rowKey="id"
            loading={isLoading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            }}
            scroll={{ x: 800 }}
          />
        )}
      </Card>

      {/* 二维码模态框 */}
      <Modal
        title="订阅链接二维码"
        open={qrCodeVisible}
        onCancel={() => setQrCodeVisible(false)}
        footer={null}
        width={400}
      >
        {selectedSubscription && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <QRCode
              value={generateSubscriptionUrl(selectedSubscription)}
              size={256}
              level="M"
              includeMargin
            />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                {selectedSubscription.name}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                使用客户端扫描二维码添加订阅
              </Text>
            </div>
          </div>
        )}
      </Modal>

      {/* 详情模态框 */}
      <Modal
        title="订阅详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedSubscription && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text strong>订阅名称：</Text>
              <Text>{selectedSubscription.name}</Text>
            </div>
            <div>
              <Text strong>订阅格式：</Text>
              <Tag color="blue">{selectedSubscription.format.toUpperCase()}</Tag>
            </div>
            <div>
              <Text strong>节点数量：</Text>
              <Text>{selectedSubscription.nodeIds.length} 个</Text>
            </div>
            <div>
              <Text strong>访问统计：</Text>
              <Text>{selectedSubscription.accessCount} 次</Text>
            </div>
            <div>
              <Text strong>订阅链接：</Text>
              <TextArea
                value={generateSubscriptionUrl(selectedSubscription)}
                readOnly
                rows={3}
                style={{ marginTop: 8 }}
              />
            </div>
            <div>
              <Button
                type="primary"
                icon={<CopyOutlined />}
                onClick={() => handleCopyUrl(selectedSubscription)}
                block
              >
                复制订阅链接
              </Button>
            </div>
          </Space>
        )}
      </Modal>

      {/* 编辑模态框 */}
      <Modal
        title="编辑自定义订阅"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setSelectedSubscription(null);
        }}
        footer={null}
        width={600}
      >
        {selectedSubscription && (
          <EditSubscriptionForm
            subscription={selectedSubscription}
            onSubmit={(data) => updateMutation.mutate({ uuid: selectedSubscription.uuid, data })}
            loading={updateMutation.isPending}
            onCancel={() => {
              setEditModalVisible(false);
              setSelectedSubscription(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
};
