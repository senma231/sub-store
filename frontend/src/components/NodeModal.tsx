import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Tabs,
  Row,
  Col,
  message
} from 'antd';
import type { ProxyNode } from '@/types';

interface NodeModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: (values: Partial<ProxyNode>) => void;
  initialValues?: Partial<ProxyNode>;
  loading?: boolean;
  title?: string;
}

const { TextArea } = Input;
const { TabPane } = Tabs;

export const NodeModal: React.FC<NodeModalProps> = ({
  open,
  onCancel,
  onOk,
  initialValues,
  loading = false,
  title = '添加节点'
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      if (initialValues) {
        form.setFieldsValue(initialValues);
      } else {
        form.resetFields();
      }
    }
  }, [open, initialValues, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onOk(values);
    } catch (error) {
      message.error('请检查表单输入');
    }
  };

  const nodeTypeOptions = [
    { label: 'VLESS', value: 'vless' },
    { label: 'VMess', value: 'vmess' },
    { label: 'Trojan', value: 'trojan' },
    { label: 'Shadowsocks', value: 'ss' },
    { label: 'SOCKS5', value: 'socks5' },
    { label: 'Hysteria2', value: 'hy2' },
    { label: 'Hysteria', value: 'hy' },
  ];

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      width={800}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          enabled: true,
          port: 443,
          security: 'tls',
          network: 'tcp',
          tls: true,
        }}
      >
        <Tabs defaultActiveKey="basic">
          <TabPane tab="基础配置" key="basic">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="节点名称"
                  name="name"
                  rules={[{ required: true, message: '请输入节点名称' }]}
                >
                  <Input placeholder="请输入节点名称" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="节点类型"
                  name="type"
                  rules={[{ required: true, message: '请选择节点类型' }]}
                >
                  <Select placeholder="请选择节点类型" options={nodeTypeOptions} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  label="服务器地址"
                  name="server"
                  rules={[{ required: true, message: '请输入服务器地址' }]}
                >
                  <Input placeholder="example.com" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  label="端口"
                  name="port"
                  rules={[{ required: true, message: '请输入端口' }]}
                >
                  <InputNumber
                    min={1}
                    max={65535}
                    style={{ width: '100%' }}
                    placeholder="443"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="启用状态" name="enabled" valuePropName="checked">
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="备注" name="remark">
              <TextArea rows={3} placeholder="节点备注信息（可选）" />
            </Form.Item>
          </TabPane>

          <TabPane tab="协议配置" key="protocol">
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.type !== currentValues.type
              }
            >
              {({ getFieldValue }) => {
                const nodeType = getFieldValue('type');
                
                if (nodeType === 'vless' || nodeType === 'vmess') {
                  return (
                    <>
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item label="UUID" name="uuid">
                            <Input placeholder="用户ID" />
                          </Form.Item>
                        </Col>
                        {nodeType === 'vmess' && (
                          <Col span={12}>
                            <Form.Item label="AlterID" name="alterId">
                              <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
                            </Form.Item>
                          </Col>
                        )}
                      </Row>
                      
                      <Row gutter={16}>
                        <Col span={12}>
                          <Form.Item label="加密方式" name="encryption">
                            <Select placeholder="none">
                              <Select.Option value="none">none</Select.Option>
                              <Select.Option value="auto">auto</Select.Option>
                              <Select.Option value="aes-128-gcm">aes-128-gcm</Select.Option>
                              <Select.Option value="chacha20-poly1305">chacha20-poly1305</Select.Option>
                            </Select>
                          </Form.Item>
                        </Col>
                        {nodeType === 'vless' && (
                          <Col span={12}>
                            <Form.Item label="Flow" name="flow">
                              <Input placeholder="xtls-rprx-vision" />
                            </Form.Item>
                          </Col>
                        )}
                      </Row>
                    </>
                  );
                }

                if (nodeType === 'trojan') {
                  return (
                    <Form.Item
                      label="密码"
                      name="password"
                      rules={[{ required: true, message: '请输入密码' }]}
                    >
                      <Input.Password placeholder="Trojan密码" />
                    </Form.Item>
                  );
                }

                if (nodeType === 'ss') {
                  return (
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          label="加密方式"
                          name="method"
                          rules={[{ required: true, message: '请选择加密方式' }]}
                        >
                          <Select placeholder="aes-256-gcm">
                            <Select.Option value="aes-256-gcm">aes-256-gcm</Select.Option>
                            <Select.Option value="aes-128-gcm">aes-128-gcm</Select.Option>
                            <Select.Option value="chacha20-ietf-poly1305">chacha20-ietf-poly1305</Select.Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          label="密码"
                          name="password"
                          rules={[{ required: true, message: '请输入密码' }]}
                        >
                          <Input.Password placeholder="SS密码" />
                        </Form.Item>
                      </Col>
                    </Row>
                  );
                }

                if (nodeType === 'socks5') {
                  return (
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item label="用户名" name="username">
                          <Input placeholder="用户名（可选）" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item label="密码" name="password">
                          <Input.Password placeholder="密码（可选）" />
                        </Form.Item>
                      </Col>
                    </Row>
                  );
                }

                return null;
              }}
            </Form.Item>
          </TabPane>

          <TabPane tab="传输配置" key="transport">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="传输协议" name="network">
                  <Select>
                    <Select.Option value="tcp">TCP</Select.Option>
                    <Select.Option value="ws">WebSocket</Select.Option>
                    <Select.Option value="h2">HTTP/2</Select.Option>
                    <Select.Option value="grpc">gRPC</Select.Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="TLS" name="tls" valuePropName="checked">
                  <Switch checkedChildren="启用" unCheckedChildren="禁用" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item label="SNI" name="sni">
              <Input placeholder="服务器名称指示（可选）" />
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.network !== currentValues.network
              }
            >
              {({ getFieldValue }) => {
                const network = getFieldValue('network');
                
                if (network === 'ws') {
                  return (
                    <Form.Item label="WebSocket路径" name="wsPath">
                      <Input placeholder="/path" />
                    </Form.Item>
                  );
                }

                if (network === 'h2') {
                  return (
                    <Form.Item label="HTTP/2路径" name="h2Path">
                      <Input placeholder="/path" />
                    </Form.Item>
                  );
                }

                if (network === 'grpc') {
                  return (
                    <Form.Item label="gRPC服务名" name="grpcServiceName">
                      <Input placeholder="service-name" />
                    </Form.Item>
                  );
                }

                return null;
              }}
            </Form.Item>
          </TabPane>
        </Tabs>
      </Form>
    </Modal>
  );
};
