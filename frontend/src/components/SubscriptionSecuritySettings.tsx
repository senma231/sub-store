import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  InputNumber,
  Switch,
  Button,
  Space,
  Alert,
  Statistic,
  Row,
  Col,
  Table,
  Tag,
  message,
  Modal
} from 'antd';
import {
  SecurityScanOutlined,
  EyeOutlined,
  ReloadOutlined,
  DeleteOutlined
} from '@ant-design/icons';

interface SecurityConfig {
  rateLimitEnabled: boolean;
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  blockDurationMinutes: number;
  userAgentCheckEnabled: boolean;
  geoRestrictionEnabled: boolean;
  allowedCountries: string[];
  logRetentionDays: number;
}

interface AccessLog {
  id: string;
  ip: string;
  userAgent: string;
  country: string;
  timestamp: string;
  status: 'allowed' | 'blocked' | 'suspicious';
  reason?: string;
  subscriptionId?: string;
}

interface SecurityStats {
  totalRequests: number;
  blockedRequests: number;
  suspiciousRequests: number;
  uniqueIPs: number;
  topCountries: Array<{ country: string; count: number }>;
  topUserAgents: Array<{ userAgent: string; count: number }>;
}

const SubscriptionSecuritySettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<SecurityConfig>({
    rateLimitEnabled: true,
    maxRequestsPerHour: 60,
    maxRequestsPerDay: 500,
    blockDurationMinutes: 60,
    userAgentCheckEnabled: true,
    geoRestrictionEnabled: false,
    allowedCountries: [],
    logRetentionDays: 30
  });
  
  const [stats, setStats] = useState<SecurityStats>({
    totalRequests: 0,
    blockedRequests: 0,
    suspiciousRequests: 0,
    uniqueIPs: 0,
    topCountries: [],
    topUserAgents: []
  });
  
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [logsVisible, setLogsVisible] = useState(false);

  // 加载安全配置
  const loadSecurityConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/security/config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        form.setFieldsValue(data);
      }
    } catch (error) {
      message.error('加载安全配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 保存安全配置
  const saveSecurityConfig = async (values: SecurityConfig) => {
    try {
      setLoading(true);
      const response = await fetch('/api/security/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(values)
      });
      
      if (response.ok) {
        setConfig(values);
        message.success('安全配置保存成功');
      } else {
        message.error('保存安全配置失败');
      }
    } catch (error) {
      message.error('保存安全配置失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载安全统计
  const loadSecurityStats = async () => {
    try {
      const response = await fetch('/api/security/stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('加载安全统计失败:', error);
    }
  };

  // 加载访问日志
  const loadAccessLogs = async () => {
    try {
      const response = await fetch('/api/security/logs?limit=100', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAccessLogs(data);
      }
    } catch (error) {
      message.error('加载访问日志失败');
    }
  };

  // 清除访问日志
  const clearAccessLogs = async () => {
    Modal.confirm({
      title: '确认清除访问日志',
      content: '此操作将清除所有访问日志，无法恢复。确定继续吗？',
      onOk: async () => {
        try {
          const response = await fetch('/api/security/logs', {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          if (response.ok) {
            setAccessLogs([]);
            message.success('访问日志已清除');
            loadSecurityStats();
          } else {
            message.error('清除访问日志失败');
          }
        } catch (error) {
          message.error('清除访问日志失败');
        }
      }
    });
  };

  useEffect(() => {
    loadSecurityConfig();
    loadSecurityStats();
  }, []);

  // 访问日志表格列定义
  const logColumns = [
    {
      title: 'IP地址',
      dataIndex: 'ip',
      key: 'ip',
      width: 120,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: string) => {
        const colors = {
          allowed: 'green',
          blocked: 'red',
          suspicious: 'orange'
        };
        const labels = {
          allowed: '允许',
          blocked: '阻止',
          suspicious: '可疑'
        };
        return <Tag color={colors[status as keyof typeof colors]}>{labels[status as keyof typeof labels]}</Tag>;
      }
    },
    {
      title: 'User-Agent',
      dataIndex: 'userAgent',
      key: 'userAgent',
      ellipsis: true,
    },
    {
      title: '国家',
      dataIndex: 'country',
      key: 'country',
      width: 80,
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 160,
      render: (timestamp: string) => new Date(timestamp).toLocaleString()
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card title={<><SecurityScanOutlined /> 订阅链接安全设置</>}>
        
        {/* 安全统计 */}
        <Alert
          message="安全防护状态"
          description={
            <Row gutter={16} style={{ marginTop: 16 }}>
              <Col span={6}>
                <Statistic title="总请求数" value={stats.totalRequests} />
              </Col>
              <Col span={6}>
                <Statistic 
                  title="阻止请求" 
                  value={stats.blockedRequests} 
                  valueStyle={{ color: '#cf1322' }}
                />
              </Col>
              <Col span={6}>
                <Statistic 
                  title="可疑请求" 
                  value={stats.suspiciousRequests}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Col>
              <Col span={6}>
                <Statistic title="独立IP" value={stats.uniqueIPs} />
              </Col>
            </Row>
          }
          type="info"
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          layout="vertical"
          initialValues={config}
          onFinish={saveSecurityConfig}
        >
          {/* 访问频率限制 */}
          <Card size="small" title="访问频率限制" style={{ marginBottom: 16 }}>
            <Form.Item name="rateLimitEnabled" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
            
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  name="maxRequestsPerHour"
                  label="每小时最大请求数"
                  rules={[{ required: true, message: '请输入每小时最大请求数' }]}
                >
                  <InputNumber min={1} max={1000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="maxRequestsPerDay"
                  label="每天最大请求数"
                  rules={[{ required: true, message: '请输入每天最大请求数' }]}
                >
                  <InputNumber min={1} max={10000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="blockDurationMinutes"
                  label="阻止时长(分钟)"
                  rules={[{ required: true, message: '请输入阻止时长' }]}
                >
                  <InputNumber min={1} max={1440} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* User-Agent检测 */}
          <Card size="small" title="User-Agent检测" style={{ marginBottom: 16 }}>
            <Form.Item name="userAgentCheckEnabled" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="禁用" />
            </Form.Item>
            <Alert
              message="已知的合法代理客户端将被允许访问，可疑的User-Agent将被阻止"
              type="info"
              showIcon
            />
          </Card>

          {/* 日志设置 */}
          <Card size="small" title="日志设置" style={{ marginBottom: 16 }}>
            <Form.Item
              name="logRetentionDays"
              label="日志保留天数"
              rules={[{ required: true, message: '请输入日志保留天数' }]}
            >
              <InputNumber min={1} max={365} style={{ width: 200 }} />
            </Form.Item>
          </Card>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                保存配置
              </Button>
              <Button icon={<ReloadOutlined />} onClick={loadSecurityStats}>
                刷新统计
              </Button>
              <Button icon={<EyeOutlined />} onClick={() => {
                setLogsVisible(true);
                loadAccessLogs();
              }}>
                查看访问日志
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      {/* 访问日志模态框 */}
      <Modal
        title="访问日志"
        open={logsVisible}
        onCancel={() => setLogsVisible(false)}
        width={1000}
        footer={[
          <Button key="clear" danger icon={<DeleteOutlined />} onClick={clearAccessLogs}>
            清除日志
          </Button>,
          <Button key="close" onClick={() => setLogsVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <Table
          columns={logColumns}
          dataSource={accessLogs}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10 }}
          scroll={{ y: 400 }}
        />
      </Modal>
    </div>
  );
};

export default SubscriptionSecuritySettings;
