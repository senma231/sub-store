import React, { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  List,
  Tag,
  Space,
  Typography,
  message,
  Button,
  Divider,
  Alert
} from 'antd';
import {
  CopyOutlined,
  QrcodeOutlined,
  LinkOutlined
} from '@ant-design/icons';
import QRCode from 'qrcode.react';
import copy from 'copy-to-clipboard';
import dayjs from 'dayjs';
import type { ProxyNode, CreateCustomSubscriptionRequest, CreateCustomSubscriptionResponse } from '@/types';

const { Text, Title } = Typography;

interface CustomSubscriptionModalProps {
  open: boolean;
  onCancel: () => void;
  selectedNodes: ProxyNode[];
  onCreateSubscription: (data: CreateCustomSubscriptionRequest) => Promise<CreateCustomSubscriptionResponse>;
  loading?: boolean;
}

export const CustomSubscriptionModal: React.FC<CustomSubscriptionModalProps> = ({
  open,
  onCancel,
  selectedNodes,
  onCreateSubscription,
  loading = false
}) => {
  const [form] = Form.useForm();
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [subscriptionResult, setSubscriptionResult] = useState<CreateCustomSubscriptionResponse | null>(null);
  const [qrVisible, setQrVisible] = useState(false);

  const formatOptions = [
    { label: 'V2Ray', value: 'v2ray', description: 'V2Ray/V2RayN Base64 格式' },
    { label: 'Clash', value: 'clash', description: 'Clash YAML 配置格式' },
    { label: 'Shadowrocket', value: 'shadowrocket', description: 'Shadowrocket Base64 格式' },
  ];

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const requestData: CreateCustomSubscriptionRequest = {
        name: values.name,
        nodeIds: selectedNodes.map(node => node.id),
        format: values.format,
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : undefined,
      };

      const result = await onCreateSubscription(requestData);
      setSubscriptionResult(result);
      setStep('result');
    } catch (error) {
      message.error('创建自定义订阅失败');
    }
  };

  const handleCopy = (text: string) => {
    copy(text);
    message.success('已复制到剪贴板');
  };

  const handleClose = () => {
    setStep('form');
    setSubscriptionResult(null);
    setQrVisible(false);
    form.resetFields();
    onCancel();
  };

  const renderFormStep = () => (
    <>
      <Alert
        message="创建自定义订阅链接"
        description={`将为选中的 ${selectedNodes.length} 个节点生成专用的订阅链接，您可以设置有效期和自定义名称。`}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          format: 'v2ray',
          name: `自定义订阅 - ${dayjs().format('YYYY-MM-DD HH:mm')}`
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
          <Select
            placeholder="请选择订阅格式"
            dropdownStyle={{ minWidth: 300 }}
            optionLabelProp="label"
          >
            {formatOptions.map(option => (
              <Select.Option
                key={option.value}
                value={option.value}
                label={option.label}
              >
                <div style={{ padding: '4px 0' }}>
                  <div style={{ fontWeight: 500 }}>{option.label}</div>
                  <Text type="secondary" style={{ fontSize: 12, lineHeight: 1.2 }}>
                    {option.description}
                  </Text>
                </div>
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
      </Form>

      <Divider>包含的节点</Divider>

      <List
        size="small"
        dataSource={selectedNodes}
        renderItem={(node) => (
          <List.Item>
            <Space>
              <Tag color="blue">{node.type.toUpperCase()}</Tag>
              <Text>{node.name}</Text>
              <Text type="secondary">{node.server}:{node.port}</Text>
            </Space>
          </List.Item>
        )}
        style={{ maxHeight: 200, overflow: 'auto' }}
      />
    </>
  );

  const renderResultStep = () => {
    if (!subscriptionResult) return null;

    return (
      <>
        <Alert
          message="自定义订阅创建成功！"
          description="您的专属订阅链接已生成，请妥善保存。"
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Title level={5}>订阅信息</Title>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <div>
                <Text strong>名称：</Text>
                <Text>{subscriptionResult.subscription.name}</Text>
              </div>
              <div>
                <Text strong>格式：</Text>
                <Tag color="blue">{subscriptionResult.subscription.format.toUpperCase()}</Tag>
              </div>
              <div>
                <Text strong>节点数量：</Text>
                <Text>{subscriptionResult.subscription.nodeIds.length}</Text>
              </div>
              <div>
                <Text strong>UUID：</Text>
                <Text code>{subscriptionResult.subscription.uuid}</Text>
              </div>
              {subscriptionResult.subscription.expiresAt && (
                <div>
                  <Text strong>过期时间：</Text>
                  <Text>{dayjs(subscriptionResult.subscription.expiresAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
                </div>
              )}
            </Space>
          </div>

          <div>
            <Title level={5}>订阅链接</Title>
            <Input.Group compact>
              <Input
                value={subscriptionResult.url}
                readOnly
                style={{ flex: 1 }}
              />
              <Button
                icon={<CopyOutlined />}
                onClick={() => handleCopy(subscriptionResult.url)}
              >
                复制
              </Button>
              <Button
                icon={<QrcodeOutlined />}
                onClick={() => setQrVisible(true)}
              >
                二维码
              </Button>
            </Input.Group>
          </div>

          <div>
            <Title level={5}>使用说明</Title>
            <Text type="secondary">
              1. 复制上方的订阅链接<br/>
              2. 在您的代理客户端中添加订阅<br/>
              3. 客户端会自动获取选中的节点列表<br/>
              4. 此链接仅包含您选择的 {subscriptionResult.subscription.nodeIds.length} 个节点
            </Text>
          </div>
        </Space>

        {/* 二维码模态框 */}
        <Modal
          title="订阅链接二维码"
          open={qrVisible}
          onCancel={() => setQrVisible(false)}
          footer={null}
          width={400}
        >
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <QRCode
              value={subscriptionResult.url}
              size={256}
              level="M"
              includeMargin
            />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">
                使用客户端扫描二维码添加订阅
              </Text>
            </div>
          </div>
        </Modal>
      </>
    );
  };

  return (
    <Modal
      title={step === 'form' ? '生成自定义订阅' : '订阅创建成功'}
      open={open}
      onCancel={handleClose}
      footer={
        step === 'form' ? [
          <Button key="cancel" onClick={handleClose}>
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={loading}
            onClick={handleSubmit}
            icon={<LinkOutlined />}
          >
            生成订阅
          </Button>
        ] : [
          <Button key="close" type="primary" onClick={handleClose}>
            完成
          </Button>
        ]
      }
      width={600}
      destroyOnClose
    >
      {step === 'form' ? renderFormStep() : renderResultStep()}
    </Modal>
  );
};
