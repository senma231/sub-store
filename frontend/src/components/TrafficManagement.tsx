import React, { useState, useEffect } from 'react';
import {
  Modal,
  Card,
  Descriptions,
  Progress,
  Button,
  Form,
  InputNumber,
  Select,
  Switch,
  message,
  Space,
  Typography,
  Divider,
  Statistic,
  Row,
  Col,
  Alert,
  Input
} from 'antd';
import {
  BarChartOutlined,
  ReloadOutlined,
  SettingOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { TrafficStats, TrafficSettings, TrafficResetCycle, CustomSubscription } from '../types';
import api from '../services/api';

const { Title, Text } = Typography;
const { Option } = Select;

interface TrafficManagementProps {
  subscription: CustomSubscription;
  visible: boolean;
  onClose: () => void;
  onUpdate?: () => void;
}

const TrafficManagement: React.FC<TrafficManagementProps> = ({
  subscription,
  visible,
  onClose,
  onUpdate
}) => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<TrafficStats | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [form] = Form.useForm();

  // 格式化流量显示
  const formatTraffic = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
  };

  // 解析流量字符串为字节数
  const parseTraffic = (trafficStr: string): number => {
    const match = trafficStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB)$/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    const multipliers: { [key: string]: number } = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    };
    
    return Math.floor(value * (multipliers[unit] || 0));
  };

  // 获取流量统计
  const fetchTrafficStats = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/subscriptions/${subscription.uuid}/traffic`);
      if (response.data.success) {
        setStats(response.data.data);
      } else {
        message.error('获取流量统计失败');
      }
    } catch (error) {
      console.error('获取流量统计失败:', error);
      message.error('获取流量统计失败');
    } finally {
      setLoading(false);
    }
  };

  // 更新流量设置
  const updateTrafficSettings = async (values: any) => {
    try {
      setLoading(true);
      
      // 转换流量限制为字节数
      let limitBytes = 0;
      if (values.enabled && values.limitValue && values.limitUnit) {
        const limitStr = `${values.limitValue} ${values.limitUnit}`;
        limitBytes = parseTraffic(limitStr);
      }

      const settings: TrafficSettings = {
        enabled: values.enabled || false,
        limit: limitBytes,
        resetCycle: values.resetCycle || 'monthly'
      };

      const response = await api.put(`/api/subscriptions/${subscription.uuid}/traffic`, settings);
      
      if (response.data.success) {
        message.success('流量设置更新成功');
        setSettingsVisible(false);
        await fetchTrafficStats();
        onUpdate?.();
      } else {
        message.error(response.data.message || '更新流量设置失败');
      }
    } catch (error) {
      console.error('更新流量设置失败:', error);
      message.error('更新流量设置失败');
    } finally {
      setLoading(false);
    }
  };

  // 重置流量
  const resetTraffic = async () => {
    try {
      setLoading(true);
      const response = await api.post(`/api/subscriptions/${subscription.uuid}/traffic/reset`);
      
      if (response.data.success) {
        message.success('流量重置成功');
        await fetchTrafficStats();
        onUpdate?.();
      } else {
        message.error(response.data.message || '重置流量失败');
      }
    } catch (error) {
      console.error('重置流量失败:', error);
      message.error('重置流量失败');
    } finally {
      setLoading(false);
    }
  };

  // 打开设置模态框
  const openSettings = () => {
    if (stats) {
      // 解析当前限制为数值和单位
      let limitValue = 0;
      let limitUnit = 'GB';
      
      if (stats.limit > 0) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const k = 1024;
        const i = Math.floor(Math.log(stats.limit) / Math.log(k));
        limitValue = parseFloat((stats.limit / Math.pow(k, i)).toFixed(2));
        limitUnit = units[i];
      }

      form.setFieldsValue({
        enabled: stats.enabled,
        limitValue: limitValue || 1,
        limitUnit: limitUnit,
        resetCycle: stats.resetCycle
      });
    }
    setSettingsVisible(true);
  };

  // 获取进度条颜色
  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return '#ff4d4f';
    if (percentage >= 70) return '#faad14';
    return '#52c41a';
  };

  // 获取重置周期显示文本
  const getResetCycleText = (cycle: string) => {
    const cycleMap: { [key: string]: string } = {
      'daily': '每日',
      'weekly': '每周',
      'monthly': '每月',
      'manual': '手动'
    };
    return cycleMap[cycle] || cycle;
  };

  useEffect(() => {
    if (visible) {
      fetchTrafficStats();
    }
  }, [visible]);

  return (
    <>
      <Modal
        title={
          <Space>
            <BarChartOutlined />
            流量管理 - {subscription.name}
          </Space>
        }
        open={visible}
        onCancel={onClose}
        footer={[
          <Button key="refresh" icon={<ReloadOutlined />} onClick={fetchTrafficStats} loading={loading}>
            刷新
          </Button>,
          <Button key="settings" icon={<SettingOutlined />} onClick={openSettings}>
            设置
          </Button>,
          <Button key="reset" danger onClick={resetTraffic} loading={loading}>
            重置流量
          </Button>,
          <Button key="close" onClick={onClose}>
            关闭
          </Button>
        ]}
        width={600}
      >
        {stats ? (
          <div>
            {/* 流量统计卡片 */}
            <Card style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic
                    title="已使用"
                    value={formatTraffic(stats.used)}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="总限制"
                    value={stats.enabled ? formatTraffic(stats.limit) : '无限制'}
                    valueStyle={{ color: '#52c41a' }}
                  />
                </Col>
                <Col span={8}>
                  <Statistic
                    title="剩余"
                    value={stats.enabled ? formatTraffic(stats.remaining) : '无限制'}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Col>
              </Row>
            </Card>

            {/* 使用进度 */}
            {stats.enabled && stats.limit > 0 && (
              <Card title="使用进度" style={{ marginBottom: 16 }}>
                <Progress
                  percent={stats.percentage}
                  strokeColor={getProgressColor(stats.percentage)}
                  format={(percent) => `${percent}%`}
                />
                {stats.percentage >= 90 && (
                  <Alert
                    message="流量使用警告"
                    description="流量使用已超过90%，请注意控制使用或增加配额"
                    type="warning"
                    showIcon
                    style={{ marginTop: 12 }}
                  />
                )}
              </Card>
            )}

            {/* 详细信息 */}
            <Card title="详细信息">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="流量限制">
                  {stats.enabled ? '已启用' : '未启用'}
                </Descriptions.Item>
                <Descriptions.Item label="重置周期">
                  {getResetCycleText(stats.resetCycle)}
                </Descriptions.Item>
                {stats.resetDate && (
                  <Descriptions.Item label="下次重置">
                    {new Date(stats.resetDate).toLocaleString()}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="使用率">
                  {stats.percentage}%
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">加载中...</Text>
          </div>
        )}
      </Modal>

      {/* 设置模态框 */}
      <Modal
        title="流量设置"
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={loading}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={updateTrafficSettings}
          initialValues={{
            enabled: false,
            limitValue: 1,
            limitUnit: 'GB',
            resetCycle: 'monthly'
          }}
        >
          <Form.Item
            name="enabled"
            valuePropName="checked"
          >
            <Switch checkedChildren="启用流量限制" unCheckedChildren="禁用流量限制" />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.enabled !== currentValues.enabled}
          >
            {({ getFieldValue }) =>
              getFieldValue('enabled') ? (
                <>
                  <Form.Item label="流量限制">
                    <Input.Group compact>
                      <Form.Item
                        name="limitValue"
                        noStyle
                        rules={[{ required: true, message: '请输入流量限制' }]}
                      >
                        <InputNumber
                          min={0.1}
                          step={0.1}
                          precision={2}
                          style={{ width: '60%' }}
                          placeholder="输入数值"
                        />
                      </Form.Item>
                      <Form.Item
                        name="limitUnit"
                        noStyle
                        rules={[{ required: true, message: '请选择单位' }]}
                      >
                        <Select style={{ width: '40%' }}>
                          <Option value="MB">MB</Option>
                          <Option value="GB">GB</Option>
                          <Option value="TB">TB</Option>
                        </Select>
                      </Form.Item>
                    </Input.Group>
                  </Form.Item>

                  <Form.Item
                    name="resetCycle"
                    label="重置周期"
                    rules={[{ required: true, message: '请选择重置周期' }]}
                  >
                    <Select>
                      <Option value="daily">每日重置</Option>
                      <Option value="weekly">每周重置</Option>
                      <Option value="monthly">每月重置</Option>
                      <Option value="manual">手动重置</Option>
                    </Select>
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>

          <Alert
            message="提示"
            description="启用流量限制后，当订阅访问流量超过设定值时，将返回空的订阅内容。"
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        </Form>
      </Modal>
    </>
  );
};

export default TrafficManagement;
