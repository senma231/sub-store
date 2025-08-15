import React, { useState } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Space,
  Input,
  Tag,
  Tooltip,
  message,
  Modal,
  Form,
  Select,
  Switch,
  Divider,
  Tabs
} from 'antd';
import {
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined,
  SettingOutlined,
  QrcodeOutlined,
  LinkOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode.react';
import copy from 'copy-to-clipboard';
import { subscriptionService } from '../services/subscriptionService';
import { CustomSubscriptionManager } from '../components/CustomSubscriptionManager';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface SubscriptionOptions {
  token?: string;
  filename?: string;
  types?: string[];
  include?: string[];
  exclude?: string[];
  sort?: string;
  group?: boolean;
  groupBy?: string;
  rename?: Array<{ pattern: string; replacement: string }>;
}

const SubscriptionsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('standard');
  const [selectedFormat, setSelectedFormat] = useState<string>('v2ray');
  const [options, setOptions] = useState<SubscriptionOptions>({});
  const [previewVisible, setPreviewVisible] = useState(false);
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [previewContent, setPreviewContent] = useState('');

  // 获取支持的格式
  const { data: formatsData } = useQuery({
    queryKey: ['subscription-formats'],
    queryFn: subscriptionService.getFormats,
  });

  // 获取订阅信息
  const { data: subscriptionInfo } = useQuery({
    queryKey: ['subscription-info', selectedFormat],
    queryFn: () => subscriptionService.getSubscriptionInfo(selectedFormat),
    enabled: !!selectedFormat,
  });

  const formats = formatsData?.formats || [];
  const currentFormat = formats.find(f => f.format === selectedFormat);

  // 生成订阅链接
  const generateUrl = () => {
    return subscriptionService.generateSubscriptionUrl(selectedFormat, options);
  };

  // 复制链接
  const handleCopy = () => {
    const url = generateUrl();
    copy(url);
    message.success('订阅链接已复制到剪贴板');
  };

  // 下载订阅
  const handleDownload = async () => {
    try {
      await subscriptionService.downloadSubscription(selectedFormat, options);
      message.success('订阅文件下载成功');
    } catch (error) {
      message.error('下载失败');
    }
  };

  // 预览订阅内容
  const handlePreview = async () => {
    try {
      const content = await subscriptionService.previewSubscription(selectedFormat, options);
      setPreviewContent(content);
      setPreviewVisible(true);
    } catch (error) {
      message.error('预览失败');
    }
  };

  // 显示二维码
  const handleShowQRCode = () => {
    setQrCodeVisible(true);
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          订阅管理
        </Title>
        <Text type="secondary">生成和管理代理订阅链接</Text>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'standard',
            label: (
              <span>
                <AppstoreOutlined />
                标准订阅
              </span>
            ),
            children: (
              <Row gutter={[16, 16]}>
        {/* 格式选择 */}
        <Col span={24}>
          <Card title="选择订阅格式">
            <Row gutter={[16, 16]}>
              {formats.map((format) => (
                <Col xs={24} sm={12} md={8} lg={6} key={format.format}>
                  <Card
                    size="small"
                    hoverable
                    className={selectedFormat === format.format ? 'card-selected' : ''}
                    onClick={() => setSelectedFormat(format.format)}
                    style={{
                      border: selectedFormat === format.format ? '2px solid #1890ff' : '1px solid #d9d9d9',
                      cursor: 'pointer',
                      height: '120px',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                    bodyStyle={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center'
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <Title level={4} style={{ margin: '0 0 8px 0' }}>
                        {format.name}
                      </Title>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {format.description}
                      </Text>
                      <div style={{ marginTop: 8 }}>
                        <Tag color="blue">{format.extension}</Tag>
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        {/* 订阅链接生成 */}
        <Col xs={24} lg={16}>
          <Card 
            title={`${currentFormat?.name || ''} 订阅链接`}
            extra={
              <Button
                icon={<SettingOutlined />}
                onClick={() => setOptionsVisible(true)}
              >
                高级选项
              </Button>
            }
          >
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {/* 订阅链接 */}
              <div>
                <Text strong>订阅链接:</Text>
                <Input.Group compact style={{ marginTop: 8 }}>
                  <Input
                    value={generateUrl()}
                    readOnly
                    style={{ flex: 1 }}
                  />
                  <Tooltip title="复制链接">
                    <Button icon={<CopyOutlined />} onClick={handleCopy} />
                  </Tooltip>
                  <Tooltip title="显示二维码">
                    <Button icon={<QrcodeOutlined />} onClick={handleShowQRCode} />
                  </Tooltip>
                </Input.Group>
              </div>

              {/* 操作按钮 */}
              <Space wrap>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                >
                  下载订阅文件
                </Button>
                <Button
                  icon={<EyeOutlined />}
                  onClick={handlePreview}
                >
                  预览内容
                </Button>
                <Button
                  icon={<CopyOutlined />}
                  onClick={handleCopy}
                >
                  复制链接
                </Button>
              </Space>

              {/* 使用说明 */}
              <div>
                <Text strong>使用说明:</Text>
                <Paragraph style={{ marginTop: 8, marginBottom: 0 }}>
                  1. 复制上方的订阅链接
                  <br />
                  2. 在您的代理客户端中添加订阅
                  <br />
                  3. 客户端会自动获取和更新节点列表
                </Paragraph>
              </div>
            </Space>
          </Card>
        </Col>

        {/* 订阅信息 */}
        <Col xs={24} lg={8}>
          <Card title="订阅信息">
            {subscriptionInfo ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div>
                  <Text type="secondary">总节点数:</Text>
                  <br />
                  <Text strong style={{ fontSize: 18 }}>
                    {subscriptionInfo.statistics.totalNodes}
                  </Text>
                </div>
                
                <div>
                  <Text type="secondary">启用节点:</Text>
                  <br />
                  <Text strong style={{ fontSize: 18, color: '#52c41a' }}>
                    {subscriptionInfo.statistics.enabledNodes}
                  </Text>
                </div>

                <Divider />

                <div>
                  <Text type="secondary">节点类型分布:</Text>
                  <div style={{ marginTop: 8 }}>
                    {Object.entries(subscriptionInfo.statistics.nodeTypes).map(([type, count]) => (
                      <div key={type} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Tag className={`node-type-tag ${type}`}>
                          {type.toUpperCase()}
                        </Tag>
                        <Text>{count}</Text>
                      </div>
                    ))}
                  </div>
                </div>

                <Divider />

                <div>
                  <Text type="secondary">最后更新:</Text>
                  <br />
                  <Text>
                    {new Date(subscriptionInfo.lastUpdated).toLocaleString()}
                  </Text>
                </div>
              </Space>
            ) : (
              <Text type="secondary">加载中...</Text>
            )}
          </Card>
        </Col>
              </Row>
            ),
          },
          {
            key: 'custom',
            label: (
              <span>
                <LinkOutlined />
                自定义订阅
              </span>
            ),
            children: (
              <CustomSubscriptionManager />
            ),
          },
        ]}
      />

      {/* 高级选项模态框 */}
      <Modal
        title="高级选项"
        open={optionsVisible}
        onCancel={() => setOptionsVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          layout="vertical"
          initialValues={options}
          onValuesChange={(_, allValues) => setOptions(allValues)}
        >
          <Form.Item label="自定义文件名" name="filename">
            <Input placeholder="留空使用默认文件名" />
          </Form.Item>

          <Form.Item label="节点类型过滤" name="types">
            <Select
              mode="multiple"
              placeholder="选择要包含的节点类型"
              options={[
                { label: 'VLESS', value: 'vless' },
                { label: 'VMess', value: 'vmess' },
                { label: 'Trojan', value: 'trojan' },
                { label: 'Shadowsocks', value: 'ss' },
                { label: 'SOCKS5', value: 'socks5' },
                { label: 'Hysteria2', value: 'hy2' },
                { label: 'Hysteria', value: 'hy' },
              ]}
            />
          </Form.Item>

          <Form.Item label="包含关键词" name="include">
            <Select
              mode="tags"
              placeholder="输入要包含的关键词"
            />
          </Form.Item>

          <Form.Item label="排除关键词" name="exclude">
            <Select
              mode="tags"
              placeholder="输入要排除的关键词"
            />
          </Form.Item>

          <Form.Item label="排序方式" name="sort">
            <Select
              placeholder="选择排序方式"
              options={[
                { label: '按名称排序', value: 'name' },
                { label: '按类型排序', value: 'type' },
                { label: '按延迟排序', value: 'latency' },
              ]}
            />
          </Form.Item>

          <Form.Item label="启用分组" name="group" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="分组方式" name="groupBy">
            <Select
              placeholder="选择分组方式"
              disabled={!options.group}
              options={[
                { label: '按类型分组', value: 'type' },
                { label: '按地区分组', value: 'region' },
                { label: '按提供商分组', value: 'provider' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* 预览模态框 */}
      <Modal
        title="订阅内容预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={800}
      >
        <TextArea
          value={previewContent}
          readOnly
          rows={20}
          style={{ fontFamily: 'monospace' }}
        />
      </Modal>

      {/* 二维码模态框 */}
      <Modal
        title="订阅链接二维码"
        open={qrCodeVisible}
        onCancel={() => setQrCodeVisible(false)}
        footer={null}
        width={400}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <QRCode
            value={generateUrl()}
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
    </div>
  );
};

export default SubscriptionsPage;
