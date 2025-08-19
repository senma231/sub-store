import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  message,
  Tag,
  Tooltip,
  Popconfirm,
  Badge,
  Typography
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SyncOutlined,
  WifiOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { apiClient } from '@/services/api';

const { Option } = Select;
const { Text } = Typography;

interface XUIPanel {
  id: string;
  name: string;
  host: string;
  port: number;
  basePath?: string;
  username: string;
  password: string;
  protocol: 'http' | 'https';
  enabled: boolean;
  lastSyncAt?: string;
  syncStatus: 'pending' | 'success' | 'failed';
  syncError?: string;
  createdAt: string;
  updatedAt: string;
}

const XUIPanelManagerSimple: React.FC = () => {
  const [panels, setPanels] = useState<XUIPanel[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPanel, setEditingPanel] = useState<XUIPanel | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [syncingPanel, setSyncingPanel] = useState<string | null>(null);
  const [form] = Form.useForm();

  // 加载面板列表
  const loadPanels = async () => {
    try {
      setLoading(true);
      const panels = await apiClient.get<XUIPanel[]>('/api/xui-panels');
      setPanels(panels || []);
    } catch (error) {
      message.error('加载X-UI面板列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存面板
  const savePanel = async (values: any) => {
    try {
      if (editingPanel) {
        await apiClient.put(`/api/xui-panels/${editingPanel.id}`, values);
        message.success('面板更新成功');
      } else {
        await apiClient.post('/api/xui-panels', values);
        message.success('面板创建成功');
      }

      setModalVisible(false);
      setEditingPanel(null);
      form.resetFields();
      loadPanels();
    } catch (error) {
      message.error('保存失败');
    }
  };

  // 删除面板
  const deletePanel = async (id: string) => {
    try {
      await apiClient.delete(`/api/xui-panels/${id}`);
      message.success('面板删除成功');
      loadPanels();
    } catch (error) {
      message.error('删除失败');
    }
  };

  // 测试连接
  const testConnection = async (panel: XUIPanel) => {
    try {
      setTestingConnection(panel.id);
      const result = await apiClient.post(`/api/xui-panels/${panel.id}/test`);

      if (result.connected) {
        message.success(`连接成功！延迟: ${result.latency}ms`);
      } else {
        message.error(`连接失败: ${result.error}`);
      }
    } catch (error) {
      message.error('测试连接失败');
    } finally {
      setTestingConnection(null);
    }
  };

  // 同步节点
  const syncNodes = async (panel: XUIPanel) => {
    try {
      setSyncingPanel(panel.id);
      const result = await apiClient.post(`/api/xui-panels/${panel.id}/sync`);

      message.success(
        `同步完成！发现${result.nodesFound}个节点，` +
        `导入${result.nodesImported}个，更新${result.nodesUpdated}个`
      );
      loadPanels();
    } catch (error) {
      message.error('同步失败');
    } finally {
      setSyncingPanel(null);
    }
  };

  // 打开编辑模态框
  const openEditModal = (panel?: XUIPanel) => {
    setEditingPanel(panel || null);
    if (panel) {
      form.setFieldsValue({
        ...panel,
        password: '***' // 不显示真实密码
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  useEffect(() => {
    loadPanels();
  }, []);

  // 状态标签渲染
  const renderStatusTag = (status: string, error?: string) => {
    const statusConfig = {
      pending: { color: 'default', icon: <ClockCircleOutlined />, text: '待同步' },
      success: { color: 'success', icon: <CheckCircleOutlined />, text: '同步成功' },
      failed: { color: 'error', icon: <ExclamationCircleOutlined />, text: '同步失败' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;

    return (
      <Tooltip title={error || config.text}>
        <Tag color={config.color} icon={config.icon}>
          {config.text}
        </Tag>
      </Tooltip>
    );
  };

  // 表格列定义
  const columns = [
    {
      title: '面板名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: XUIPanel) => (
        <Space>
          <Text strong>{text}</Text>
          {!record.enabled && <Badge status="default" text="已禁用" />}
        </Space>
      )
    },
    {
      title: '地址',
      key: 'address',
      render: (record: XUIPanel) => {
        const basePath = record.basePath ? `/${record.basePath}` : '';
        return (
          <Text code>{record.protocol}://{record.host}:{record.port}{basePath}</Text>
        );
      }
    },
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username'
    },
    {
      title: '同步状态',
      key: 'syncStatus',
      render: (record: XUIPanel) => renderStatusTag(record.syncStatus, record.syncError)
    },
    {
      title: '最后同步',
      dataIndex: 'lastSyncAt',
      key: 'lastSyncAt',
      render: (text: string) => text ? new Date(text).toLocaleString() : '-'
    },
    {
      title: '操作',
      key: 'actions',
      render: (record: XUIPanel) => (
        <Space>
          <Tooltip title="测试连接">
            <Button
              type="text"
              icon={<WifiOutlined />}
              loading={testingConnection === record.id}
              onClick={() => testConnection(record)}
            />
          </Tooltip>
          <Tooltip title="同步节点">
            <Button
              type="text"
              icon={<SyncOutlined />}
              loading={syncingPanel === record.id}
              onClick={() => syncNodes(record)}
              disabled={!record.enabled}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个面板吗？"
            onConfirm={() => deletePanel(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card
        title="X-UI面板管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => openEditModal()}
          >
            添加面板
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={panels}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      {/* 添加/编辑面板模态框 */}
      <Modal
        title={editingPanel ? '编辑X-UI面板' : '添加X-UI面板'}
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingPanel(null);
          form.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={savePanel}
          initialValues={{
            protocol: 'https',
            enabled: true
          }}
        >
          <Form.Item
            name="name"
            label="面板名称"
            rules={[{ required: true, message: '请输入面板名称' }]}
          >
            <Input placeholder="例如：主服务器X-UI" />
          </Form.Item>

          <Form.Item
            name="host"
            label="服务器地址"
            rules={[{ required: true, message: '请输入服务器地址' }]}
          >
            <Input placeholder="例如：192.168.1.100 或 example.com" />
          </Form.Item>

          <Form.Item
            name="port"
            label="端口"
            rules={[
              { required: true, message: '请输入端口' },
              { type: 'number', min: 1, max: 65535, message: '端口范围：1-65535' }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="例如：54321"
              min={1}
              max={65535}
            />
          </Form.Item>

          <Form.Item
            name="basePath"
            label="URL根路径（可选）"
            help="如果X-UI面板有自定义路径，请填写。例如：xui 或 panel"
          >
            <Input placeholder="例如：xui（不需要前后斜杠）" />
          </Form.Item>

          <Form.Item
            name="protocol"
            label="协议"
            rules={[{ required: true, message: '请选择协议' }]}
          >
            <Select>
              <Option value="https">HTTPS</Option>
              <Option value="http">HTTP</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="X-UI面板登录用户名" />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="X-UI面板登录密码" />
          </Form.Item>

          <Form.Item
            name="enabled"
            label="启用状态"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingPanel ? '更新' : '创建'}
              </Button>
              <Button onClick={() => {
                setModalVisible(false);
                setEditingPanel(null);
                form.resetFields();
              }}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default XUIPanelManagerSimple;
